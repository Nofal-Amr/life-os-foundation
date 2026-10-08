package app.lifeos;

import android.Manifest;
import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.app.NotificationManager;
import android.app.WallpaperColors;
import android.app.WallpaperManager;
import android.os.Build;
import android.provider.Settings;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.view.Window;
import android.util.Log;
import android.webkit.ConsoleMessage;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
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
    private static final int CONNECT_REQUEST = 6;
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
    /** The Qibla finder's compass, while it's open. */
    private Compass compass;

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
        // An app, not a web page: no pinch or double-tap zoom. Text size is a
        // setting inside the app instead.
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setTextZoom(100);
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

            /** No camera or microphone for web pages. */
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                request.deny();
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                if (hasLocationPermission()) {
                    callback.invoke(origin, true, false);
                    return;
                }
                pendingGeoOrigin = origin;
                pendingGeoCallback = callback;
                // Precise (GPS) works without internet, e.g. for the Qibla; the
                // phone still lets you choose approximate instead.
                requestPermissions(new String[] {
                    Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION
                }, LOCATION_REQUEST);
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
            String query = data.getEncodedQuery();
            return APP_URL + (path == null ? "" : path.replaceFirst("^/", ""))
                + (query == null ? "" : "?" + query);
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
        if (requestCode == CONNECT_REQUEST) {
            webView.evaluateJavascript("window.dispatchEvent(new Event('life-os-connect'))", null);
            return;
        }
        if (requestCode == NOTIFICATION_REQUEST || requestCode == HEALTH_REQUEST) {
            // Let the page re-check what it is now allowed to do.
            String event = requestCode == HEALTH_REQUEST ? "life-os-health-permissions" : "life-os-notification-permissions";
            webView.evaluateJavascript("window.dispatchEvent(new Event('" + event + "'))", null);
            return;
        }
        if (requestCode != LOCATION_REQUEST || pendingGeoCallback == null) return;
        boolean granted = hasLocationPermission();
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
    @Override
    protected void onPause() {
        super.onPause();
        // The compass only runs while the Qibla finder is on screen.
        if (compass != null) compass.stop();
    }

    /** What each Life Connect role needs from Android (SMS only in the Full build). */
    private String[] connectPermissions(String role) {
        if ("sim".equals(role)) {
            java.util.List<String> list = new java.util.ArrayList<>(java.util.Arrays.asList(
                Manifest.permission.READ_PHONE_STATE,
                Manifest.permission.READ_CALL_LOG,
                Manifest.permission.ANSWER_PHONE_CALLS,
                Manifest.permission.READ_CONTACTS,
                Manifest.permission.POST_NOTIFICATIONS));
            if (declares(Manifest.permission.RECEIVE_SMS)) {
                list.add(Manifest.permission.RECEIVE_SMS);
                list.add(Manifest.permission.SEND_SMS);
            }
            return list.toArray(new String[0]);
        }
        return new String[] { Manifest.permission.POST_NOTIFICATIONS };
    }

    /** Whether this build's manifest asks for a permission (the Full build has more). */
    private boolean declares(String permission) {
        try {
            String[] requested = getPackageManager()
                .getPackageInfo(getPackageName(), PackageManager.GET_PERMISSIONS).requestedPermissions;
            if (requested == null) return false;
            for (String item : requested) if (permission.equals(item)) return true;
        } catch (Exception ignored) {
            // Treat as not declared.
        }
        return false;
    }

    /** Whether this build has the notification listener (Full build only). */
    private boolean hasSpendingListener() {
        try {
            getPackageManager().getServiceInfo(new android.content.ComponentName(this, SpendingListener.class), 0);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private boolean granted(String permission) {
        return checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED;
    }

    private final class NativeBridge {
        /**
         * Life Connect settings from the web app: {role, secret, url, anonKey,
         * device}. Starts or stops the background connection to match.
         */
        @JavascriptInterface
        public boolean setConnect(String json) {
            if (!trusted() || json == null || json.length() > 4000) return false;
            if (!ConnectConfig.save(MainActivity.this, json)) return false;
            ConnectService.sync(MainActivity.this);
            return true;
        }

        /** Asks Android for what this phone's role needs. */
        @JavascriptInterface
        public void requestConnectPermissions() {
            if (!trusted()) return;
            String role = ConnectConfig.roleOf(MainActivity.this);
            java.util.List<String> missing = new java.util.ArrayList<>();
            for (String permission : connectPermissions(role)) {
                if (!granted(permission)) missing.add(permission);
            }
            if (missing.isEmpty()) return;
            runOnUiThread(() -> requestPermissions(missing.toArray(new String[0]), CONNECT_REQUEST));
        }

        @JavascriptInterface
        public String connectStatus() {
            if (!trusted()) return "{}";
            try {
                String role = ConnectConfig.roleOf(MainActivity.this);
                org.json.JSONObject status = new org.json.JSONObject()
                    .put("role", role)
                    .put("connected", ConnectService.connected)
                    .put("phone", granted(Manifest.permission.READ_PHONE_STATE))
                    .put("callLog", granted(Manifest.permission.READ_CALL_LOG))
                    .put("answer", granted(Manifest.permission.ANSWER_PHONE_CALLS))
                    .put("contacts", granted(Manifest.permission.READ_CONTACTS))
                    .put("notifications", granted(Manifest.permission.POST_NOTIFICATIONS))
                    .put("sms", granted(Manifest.permission.RECEIVE_SMS) && granted(Manifest.permission.SEND_SMS))
                    .put("fullScreen", android.os.Build.VERSION.SDK_INT < 34
                        || getSystemService(android.app.NotificationManager.class).canUseFullScreenIntent())
                    .put("battery", getSystemService(android.os.PowerManager.class)
                        .isIgnoringBatteryOptimizations(getPackageName()));
                return status.toString();
            } catch (Exception e) {
                return "{}";
            }
        }

        /** Sends a test to the other phone; true if the relay took it. */
        @JavascriptInterface
        public void connectTest() {
            if (!trusted()) return;
            ConnectConfig config = ConnectConfig.load(MainActivity.this);
            if (config == null) return;
            try {
                ConnectSender.send(config,
                    new org.json.JSONObject().put("type", "test").put("device", config.device),
                    ok -> runOnUiThread(() -> webView.evaluateJavascript(
                        "window.dispatchEvent(new CustomEvent('life-os-connect-test',{detail:" + ok + "}))", null)));
            } catch (Exception ignored) {
                // Nothing sent.
            }
        }

        /* ----------------------------- spending from bank notifications */

        /** Which optional features this build has: {sms, spending}. */
        @JavascriptInterface
        public String buildFeatures() {
            if (!trusted()) return "{}";
            try {
                return new org.json.JSONObject()
                    .put("sms", declares(Manifest.permission.RECEIVE_SMS))
                    .put("spending", hasSpendingListener())
                    .toString();
            } catch (Exception e) {
                return "{}";
            }
        }

        @JavascriptInterface
        public String spendingStatus() {
            if (!trusted()) return "{}";
            try {
                String enabled = android.provider.Settings.Secure.getString(
                    getContentResolver(), "enabled_notification_listeners");
                boolean access = enabled != null && enabled.contains(getPackageName() + "/");
                return new org.json.JSONObject()
                    .put("access", access)
                    .put("watch", SpendingStore.watch(MainActivity.this))
                    .put("seen", SpendingStore.seen(MainActivity.this))
                    .toString();
            } catch (Exception e) {
                return "{}";
            }
        }

        @JavascriptInterface
        public void setSpendingWatch(String json) {
            if (!trusted() || json == null || json.length() > 20_000) return;
            SpendingStore.setWatch(MainActivity.this, json);
        }

        @JavascriptInterface
        public void openNotificationAccess() {
            if (!trusted()) return;
            runOnUiThread(() -> startActivity(new Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS")));
        }

        /** Spending waiting for an answer or for the app to write it to Money. */
        @JavascriptInterface
        public String pendingSpending() {
            return trusted() ? SpendingStore.pending(MainActivity.this) : "[]";
        }

        /** status: "log", "dismiss" or "done". */
        @JavascriptInterface
        public void resolveSpending(String id, String status) {
            if (!trusted() || id == null || status == null) return;
            if (!status.matches("log|dismiss|done")) return;
            SpendingStore.resolve(MainActivity.this, id, status);
        }

        /** Android 14+: let the call screen show over the lock screen. */
        @JavascriptInterface
        public void openFullScreenSettings() {
            if (!trusted()) return;
            runOnUiThread(() -> {
                try {
                    startActivity(new Intent("android.settings.MANAGE_APP_USE_FULL_SCREEN_INTENT")
                        .setData(Uri.parse("package:" + getPackageName())));
                } catch (Exception e) {
                    startActivity(new Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                        .putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, getPackageName()));
                }
            });
        }

        /** Lets Life Connect keep its connection while the phone sleeps. */
        @JavascriptInterface
        public void openBatterySettings() {
            if (!trusted()) return;
            runOnUiThread(() -> {
                try {
                    startActivity(new Intent(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
                        .setData(Uri.parse("package:" + getPackageName())));
                } catch (Exception e) {
                    startActivity(new Intent(android.provider.Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
                }
            });
        }

        /** Qibla finder: true-north heading from the phone's sensors (see Compass). */
        @JavascriptInterface
        public boolean startCompass(double latitude, double longitude, String mode) {
            if (!trusted()) return false;
            if (Double.isNaN(latitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return false;
            if (compass == null) compass = new Compass(MainActivity.this, webView);
            compass.setMode(mode);
            return compass.start(latitude, longitude);
        }

        @JavascriptInterface
        public void setCompassMode(String mode) {
            if (trusted() && compass != null) compass.setMode(mode);
        }

        @JavascriptInterface
        public float compassDeclination() {
            return compass == null ? 0f : compass.declination();
        }

        @JavascriptInterface
        public void stopCompass() {
            if (compass != null) compass.stop();
        }

        private boolean trusted() {
            return APP_HOST.equals(currentHost);
        }

        /**
         * Saves an export (Excel or CSV) the web app built into Downloads.
         * Only the app's own pages may call it, only export file types, and
         * at most 20 MB. Returns where it went, or "" if it couldn't.
         */
        @JavascriptInterface
        public String saveFile(String name, String base64, String mime) {
            if (!trusted() || name == null || base64 == null || mime == null) return "";
            if (!mime.equals("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                && !mime.equals("text/csv")) return "";
            String safe = name.replaceAll("[^A-Za-z0-9._ -]", "_");
            if (safe.isEmpty() || safe.length() > 100 || safe.startsWith(".")) safe = "life-os-export";
            byte[] bytes;
            try {
                bytes = Base64.decode(base64, Base64.DEFAULT);
            } catch (IllegalArgumentException e) {
                return "";
            }
            if (bytes.length == 0 || bytes.length > 20 * 1024 * 1024) return "";
            try {
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Downloads.DISPLAY_NAME, safe);
                    values.put(MediaStore.Downloads.MIME_TYPE, mime);
                    values.put(MediaStore.Downloads.IS_PENDING, 1);
                    Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri == null) return "";
                    try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                        if (out == null) return "";
                        out.write(bytes);
                    }
                    values.clear();
                    values.put(MediaStore.Downloads.IS_PENDING, 0);
                    getContentResolver().update(uri, values, null, null);
                    return "Downloads/" + safe;
                }
                // Android 8-9: the app's own Downloads folder needs no permission.
                File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                if (dir == null) return "";
                File file = new File(dir, safe);
                try (FileOutputStream out = new FileOutputStream(file)) {
                    out.write(bytes);
                }
                return file.getAbsolutePath();
            } catch (Exception e) {
                Log.w("LifeOS", "saveFile failed", e);
                return "";
            }
        }

/**
         * Two sets of phone colours as JSON: "wallpaper" (the picture own
         * colours) and "system" (Android Material You palette). The web app
         * picks the most colourful of each and fits it to the theme.
         */
        @JavascriptInterface
        public String systemAccent() {
            if (!trusted()) return "";
            StringBuilder wallpaper = new StringBuilder();
            StringBuilder system = new StringBuilder();
            try {
                if (Build.VERSION.SDK_INT >= 27) {
                    WallpaperManager manager = WallpaperManager.getInstance(MainActivity.this);
                    WallpaperColors colors = manager.getWallpaperColors(WallpaperManager.FLAG_SYSTEM);
                    if (colors == null) colors = manager.getWallpaperColors(WallpaperManager.FLAG_LOCK);
                    if (colors != null) {
                        append(wallpaper, colors.getPrimaryColor());
                        append(wallpaper, colors.getSecondaryColor());
                        append(wallpaper, colors.getTertiaryColor());
                    }
                }
                if (Build.VERSION.SDK_INT >= 31) {
                    append(system, getColor(android.R.color.system_accent1_400));
                    append(system, getColor(android.R.color.system_accent2_400));
                    append(system, getColor(android.R.color.system_accent3_400));
                }
            } catch (Exception e) {
                // Whatever was collected is still usable.
            }
            return "{\"wallpaper\":\"" + wallpaper + "\",\"system\":\"" + system + "\"}";
        }

        private void append(StringBuilder out, android.graphics.Color color) {
            if (color != null) append(out, color.toArgb());
        }

        private void append(StringBuilder out, int color) {
            if (out.length() > 0) out.append(",");
            out.append(String.format("#%06X", 0xFFFFFF & color));
        }

        /** What the home-screen prayer widget shows (see src/data/prayerWidget.ts). */
        @JavascriptInterface
        public void setWidgetData(String json) {
            if (!trusted() || json == null || json.length() > 200_000) return;
            getSharedPreferences(PrayerWidget.PREFS, MODE_PRIVATE)
                .edit().putString(PrayerWidget.KEY_DATA, json).apply();
            PrayerWidget.refresh(MainActivity.this);
        }

        /** Prayers logged from notification buttons; handing them over clears them. */
        @JavascriptInterface
        public String takePendingPrayerLogs() {
            if (!trusted()) return "[]";
            return PrayerActionReceiver.take(MainActivity.this);
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
