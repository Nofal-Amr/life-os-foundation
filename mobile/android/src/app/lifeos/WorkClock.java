package app.lifeos;

import android.Manifest;
import android.app.Activity;
import android.app.KeyguardManager;
import android.content.pm.PackageManager;
import android.hardware.biometrics.BiometricManager;
import android.hardware.biometrics.BiometricPrompt;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.CancellationSignal;
import android.os.Handler;
import android.os.Looper;

import org.json.JSONObject;

/**
 * Clocking in or out at work: the phone's fingerprint (or its screen lock)
 * confirms it's the owner, then one location reading. Android only tells us
 * "it was the owner"; no fingerprint data ever reaches the app. Location is
 * read only here, at the moment of clocking, never in the background.
 */
final class WorkClock {
    static final int LOCATION_REQUEST = 7801;
    private static final long LOCATION_TIMEOUT_MS = 20_000;

    interface Reply {
        void send(String json);
    }

    private WorkClock() {}

    static void check(Activity activity, String title, Reply reply) {
        if (activity.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED
            && activity.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            activity.requestPermissions(new String[] {
                Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION,
            }, LOCATION_REQUEST);
            reply.send(failure("no-permission"));
            return;
        }
        if (Build.VERSION.SDK_INT < 29) {
            reply.send(failure("unsupported"));
            return;
        }
        KeyguardManager keyguard = activity.getSystemService(KeyguardManager.class);
        if (keyguard == null || !keyguard.isDeviceSecure()) {
            reply.send(failure("no-lock"));
            return;
        }
        BiometricPrompt.Builder builder = new BiometricPrompt.Builder(activity).setTitle(title);
        if (Build.VERSION.SDK_INT >= 30) {
            builder.setAllowedAuthenticators(
                BiometricManager.Authenticators.BIOMETRIC_STRONG | BiometricManager.Authenticators.DEVICE_CREDENTIAL);
        } else {
            builder.setDeviceCredentialAllowed(true);
        }
        builder.build().authenticate(new CancellationSignal(), activity.getMainExecutor(),
            new BiometricPrompt.AuthenticationCallback() {
                @Override
                public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                    String verified = "biometric";
                    if (Build.VERSION.SDK_INT >= 30
                        && result.getAuthenticationType() == BiometricPrompt.AUTHENTICATION_RESULT_TYPE_DEVICE_CREDENTIAL) {
                        verified = "credential";
                    }
                    locate(activity, verified, reply);
                }

                @Override
                public void onAuthenticationError(int code, CharSequence message) {
                    reply.send(failure(code == BiometricPrompt.BIOMETRIC_ERROR_NO_DEVICE_CREDENTIAL ? "no-lock" : "cancelled"));
                }
            });
    }

    /** One fresh reading: fused, then GPS, then network; gives up after 20 s. */
    @SuppressWarnings({ "MissingPermission", "deprecation" })
    private static void locate(Activity activity, String verified, Reply reply) {
        LocationManager manager = activity.getSystemService(LocationManager.class);
        String provider = null;
        for (String candidate : new String[] { "fused", LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER }) {
            try {
                if (manager.getAllProviders().contains(candidate) && manager.isProviderEnabled(candidate)) {
                    provider = candidate;
                    break;
                }
            } catch (Exception ignored) {
                // Try the next one.
            }
        }
        if (provider == null) {
            reply.send(failure("no-location"));
            return;
        }
        Handler handler = new Handler(Looper.getMainLooper());
        boolean[] done = { false };
        Runnable timeout = () -> {
            if (done[0]) return;
            done[0] = true;
            reply.send(failure("no-location"));
        };
        handler.postDelayed(timeout, LOCATION_TIMEOUT_MS);
        java.util.function.Consumer<Location> got = location -> {
            if (done[0]) return;
            done[0] = true;
            handler.removeCallbacks(timeout);
            reply.send(location == null ? failure("no-location") : success(location, verified));
        };
        try {
            if (Build.VERSION.SDK_INT >= 30) {
                CancellationSignal cancel = new CancellationSignal();
                handler.postDelayed(cancel::cancel, LOCATION_TIMEOUT_MS);
                manager.getCurrentLocation(provider, cancel, activity.getMainExecutor(), got::accept);
            } else {
                manager.requestSingleUpdate(provider, new LocationListener() {
                    @Override
                    public void onLocationChanged(Location location) {
                        got.accept(location);
                    }
                }, Looper.getMainLooper());
            }
        } catch (Exception e) {
            got.accept(null);
        }
    }

    @SuppressWarnings("deprecation")
    private static String success(Location location, String verified) {
        try {
            boolean mock = Build.VERSION.SDK_INT >= 31 ? location.isMock() : location.isFromMockProvider();
            return new JSONObject()
                .put("ok", true)
                .put("verified", verified)
                .put("latitude", location.getLatitude())
                .put("longitude", location.getLongitude())
                .put("accuracy", location.hasAccuracy() ? location.getAccuracy() : 9999)
                .put("mock", mock)
                .put("at", System.currentTimeMillis())
                .toString();
        } catch (Exception e) {
            return failure("no-location");
        }
    }

    private static String failure(String reason) {
        return "{\"ok\":false,\"reason\":\"" + reason + "\"}";
    }
}
