package app.lifeos;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.app.NotificationManager;
import android.os.Build;
import android.provider.Settings;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.util.Log;
import android.webkit.ConsoleMessage;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

import org.json.JSONObject;

/**
 * Life OS for Android: a WebView that runs the same React app as the website.
 *
 * The web bundle ships inside the APK (assets/www) and is served from a private
 * https origin, so it loads instantly and needs no server. Data syncs because
 * the app talks to the same Supabase backend as the website.
 */
public class MainActivity extends Activity {
    private static final String APP_HOST = "app.lifeos.local";
    private static final String APP_URL = "https://" + APP_HOST + "/";
    private static final int LOCATION_REQUEST = 1;
    private static final int NOTIFICATION_REQUEST = 2;
    private static final int HEALTH_REQUEST = 3;
    private static final int FILE_REQUEST = 4;
    /** Lets the web app know it runs inside this shell (see src/routes/auth.tsx). */
    private static final String UA_MARKER = "LifeOSAndroid";
    private static final String CALLBACK_SCHEME = "lifeos";

    private WebView webView;
    private String pendingGeoOrigin;
    private GeolocationPermissions.Callback pendingGeoCallback;
    /** The host of the page on screen; the bridge only answers the app's own pages. */
    private volatile String currentHost = APP_HOST;
    /** Pending <input type="file"> request from the page. */
    private ValueCallback<Uri[]> fileCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        applySystemBars();

        webView = new WebView(this);
        webView.setBackgroundColor(isNightMode() ? Color.rgb(10, 12, 16) : Color.rgb(248, 249, 251));
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setUserAgentString(settings.getUserAgentString() + " " + UA_MARKER);

        webView.setWebViewClient(new AppClient());
        webView.addJavascriptInterface(new NativeBridge(), "LifeOSNative");
        Reminders.ensureChannel(this);
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage message) {
                // Visible with: adb logcat -s LifeOS
                Log.i("LifeOS", message.messageLevel() + " " + message.message());
                return true;
            }

            /** Lets <input type="file"> open the phone's file picker (e.g. Samsung Health downloads). */
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent intent = params.createIntent();
                if (params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) {
                    intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                }
                try {
                    startActivityForResult(intent, FILE_REQUEST);
                } catch (Exception noPicker) {
                    fileCallback = null;
                    callback.onReceiveValue(null);
                    return false;
                }
                return true;
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                if (hasLocationPermission()) {
                    callback.invoke(origin, true, false);
                    return;
                }
                pendingGeoOrigin = origin;
                pendingGeoCallback = callback;
                requestPermissions(new String[] { Manifest.permission.ACCESS_COARSE_LOCATION }, LOCATION_REQUEST);
            }
        });

        // Debug builds can be inspected from chrome://inspect on a PC.
        if ((getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        String callback = callbackUrl(getIntent());
        if (callback != null) webView.loadUrl(callback);
        else if (savedInstanceState != null) webView.restoreState(savedInstanceState);
        else webView.loadUrl(APP_URL);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        String callback = callbackUrl(intent);
        Log.i("LifeOS", "callback intent: " + (intent.getData() == null ? "none" : redact(intent.getData().toString())));
        if (callback != null) webView.loadUrl(callback);
    }

    /** Keeps tokens out of the log. */
    private static String redact(String url) {
        return url.replaceAll("(access_token|refresh_token|provider_token|provider_refresh_token|code)=[^&#]+", "$1=…");
    }

    /**
     * Google/Apple sign-in finishes in the phone's browser and returns to
     * lifeos://auth-callback?code=...#access_token=... . Hand the query and
     * fragment to the web app's /auth page, which completes the session.
     */
    private static String callbackUrl(Intent intent) {
        if (intent == null || intent.getData() == null) return null;
        Uri data = intent.getData();
        if (!CALLBACK_SCHEME.equals(data.getScheme())) return null;
        if ("open".equals(data.getHost())) {
            String path = data.getEncodedPath();
            return APP_URL + (path == null ? "" : path.replaceFirst("^/", ""));
        }
        String query = data.getEncodedQuery();
        String fragment = data.getEncodedFragment();
        // A unique query forces a full page load. The app is usually already on
        // /auth, and a URL that differs only in its #fragment would just scroll
        // the page, so Supabase would never read the returned tokens.
        return APP_URL + "auth?return=" + System.currentTimeMillis()
            + (query != null ? "&" + query : "")
            + (fragment != null ? "#" + fragment : "");
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_REQUEST || fileCallback == null) return;
        Uri[] picked = null;
        if (resultCode == RESULT_OK && data != null) {
            if (data.getClipData() != null) {
                picked = new Uri[data.getClipData().getItemCount()];
                for (int i = 0; i < picked.length; i++) picked[i] = data.getClipData().getItemAt(i).getUri();
            } else if (data.getData() != null) {
                picked = new Uri[] { data.getData() };
            }
        }
        fileCallback.onReceiveValue(picked);
        fileCallback = null;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        if (requestCode == NOTIFICATION_REQUEST || requestCode == HEALTH_REQUEST) {
            // Let the page re-check what it is now allowed to do.
            String event = requestCode == HEALTH_REQUEST ? "life-os-health-permissions" : "life-os-notification-permissions";
            webView.evaluateJavascript("window.dispatchEvent(new Event('" + event + "'))", null);
            return;
        }
        if (requestCode != LOCATION_REQUEST || pendingGeoCallback == null) return;
        boolean granted = results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED;
        pendingGeoCallback.invoke(pendingGeoOrigin, granted, false);
        pendingGeoCallback = null;
        pendingGeoOrigin = null;
    }

    private boolean hasLocationPermission() {
        return checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean isNightMode() {
        int mode = getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
        return mode == Configuration.UI_MODE_NIGHT_YES;
    }

    /** Status and navigation bars match the canvas of the device theme. */
    @SuppressWarnings("deprecation")
    private void applySystemBars() {
        Window window = getWindow();
        boolean night = isNightMode();
        int canvas = night ? Color.rgb(10, 12, 16) : Color.rgb(248, 249, 251);
        window.setStatusBarColor(canvas);
        window.setNavigationBarColor(canvas);
        int flags = 0;
        if (!night) flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        window.getDecorView().setSystemUiVisibility(flags);
    }

    private final class AppClient extends WebViewClient {
        @Override
        public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
            currentHost = Uri.parse(url).getHost();
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri url = request.getUrl();
            if (APP_HOST.equals(url.getHost())) return false;
            // Links that leave the app open in the browser.
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, url));
            } catch (Exception ignored) {
                // No app can handle it; stay put.
            }
            return true;
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri url = request.getUrl();
            if (!APP_HOST.equals(url.getHost())) return null;

            String path = url.getPath();
            if (path == null || path.isEmpty() || path.equals("/")) path = "/index.html";
            WebResourceResponse asset = openAsset(path);
            // Client-side routes (e.g. /tasks) fall back to the app shell.
            if (asset == null && !lastSegment(path).contains(".")) asset = openAsset("/index.html");
            return asset;
        }
    }

    private WebResourceResponse openAsset(String path) {
        try {
            InputStream stream = getAssets().open("www" + path);
            WebResourceResponse response = new WebResourceResponse(mimeType(path), "utf-8", stream);
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", path.startsWith("/assets/") ? "max-age=31536000, immutable" : "no-cache");
            response.setResponseHeaders(headers);
            return response;
        } catch (IOException missing) {
            return null;
        }
    }

    private static String lastSegment(String path) {
        int slash = path.lastIndexOf('/');
        return slash >= 0 ? path.substring(slash + 1) : path;
    }

    private static String mimeType(String path) {
        String p = path.toLowerCase();
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js") || p.endsWith(".mjs")) return "text/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".json") || p.endsWith(".map")) return "application/json";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".webp")) return "image/webp";
        if (p.endsWith(".ico")) return "image/x-icon";
        if (p.endsWith(".woff2")) return "font/woff2";
        if (p.endsWith(".woff")) return "font/woff";
        if (p.endsWith(".txt")) return "text/plain";
        return "application/octet-stream";
    }

    /** Called from the web app via window.LifeOSNative (see src/lib/native.ts). */
    private final class NativeBridge {
        private boolean trusted() {
            return APP_HOST.equals(currentHost);
        }

        @JavascriptInterface
        public boolean canNotify() {
            if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                return false;
            }
            return getSystemService(NotificationManager.class).areNotificationsEnabled();
        }

        @JavascriptInterface
        public void requestNotifications() {
            if (!trusted()) return;
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= 33
                    && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, NOTIFICATION_REQUEST);
                } else {
                    startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                        .putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName()));
                }
            });
        }

        /** Ongoing notification with a live clock while a timer runs; empty title clears it. */
        @JavascriptInterface
        public void showTimer(String title, double startedAt) {
            if (!trusted()) return;
            if (title == null || title.isEmpty()) TimerNotice.clear(MainActivity.this);
            else TimerNotice.show(MainActivity.this, title, (long) startedAt);
        }

        @JavascriptInterface
        public void scheduleReminders(String json) {
            if (!trusted()) return;
            Reminders.replaceAll(MainActivity.this, json);
        }

        @JavascriptInterface
        public String healthStatus() {
            return HealthReader.status(MainActivity.this);
        }

        /** Opens Health Connect: "home" for its main screen, "app" for Life OS's permissions. */
        @JavascriptInterface
        public void openHealthSettings(String which) {
            if (!trusted() || !HealthReader.supported()) return;
            Intent intent = "app".equals(which)
                ? new Intent("android.health.connect.action.MANAGE_HEALTH_PERMISSIONS")
                    .putExtra(Intent.EXTRA_PACKAGE_NAME, getPackageName())
                : new Intent("android.health.connect.action.HEALTH_HOME_SETTINGS");
            runOnUiThread(() -> {
                try {
                    startActivity(intent);
                } catch (Exception missing) {
                    startActivity(new Intent("android.health.connect.action.HEALTH_HOME_SETTINGS"));
                }
            });
        }

        @JavascriptInterface
        public void requestHealth() {
            if (!trusted() || !HealthReader.supported()) return;
            runOnUiThread(() -> requestPermissions(HealthReader.PERMISSIONS, HEALTH_REQUEST));
        }

        @JavascriptInterface
        public void readHealth(String json) {
            if (!trusted()) return;
            String id;
            int days;
            try {
                JSONObject args = new JSONObject(json);
                id = args.getString("id");
                days = Math.max(1, Math.min(365, args.optInt("days", 30)));
            } catch (Exception bad) {
                return;
            }
            HealthReader.read(MainActivity.this, days, result -> runOnUiThread(() ->
                webView.evaluateJavascript(
                    "window.__lifeOSNativeCallback && window.__lifeOSNativeCallback("
                        + JSONObject.quote(id) + "," + JSONObject.quote(result.toString()) + ")",
                    null)));
        }
    }
}
