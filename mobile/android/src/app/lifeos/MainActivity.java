package app.lifeos;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.GeolocationPermissions;
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
    /** Lets the web app know it runs inside this shell (see src/routes/auth.tsx). */
    private static final String UA_MARKER = "LifeOSAndroid";
    private static final String CALLBACK_SCHEME = "lifeos";

    private WebView webView;
    private String pendingGeoOrigin;
    private GeolocationPermissions.Callback pendingGeoCallback;

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
        webView.setWebChromeClient(new WebChromeClient() {
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

        String callback = callbackUrl(getIntent());
        if (callback != null) webView.loadUrl(callback);
        else if (savedInstanceState != null) webView.restoreState(savedInstanceState);
        else webView.loadUrl(APP_URL);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        String callback = callbackUrl(intent);
        if (callback != null) webView.loadUrl(callback);
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
        String query = data.getEncodedQuery();
        String fragment = data.getEncodedFragment();
        return APP_URL + "auth"
            + (query != null ? "?" + query : "")
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
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
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
}
