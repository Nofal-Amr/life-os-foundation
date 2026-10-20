package app.lifeos.wear;

import android.content.Context;
import android.content.SharedPreferences;

/** The watch's own settings: where it is, and how times are worked out. */
final class WearPrefs {
    private static final String FILE = "wear";

    final double latitude;
    final double longitude;
    /** When the place was last updated (epoch ms), 0 if never. */
    final long placeAt;
    /** A phone-app method name, e.g. "Egyptian". */
    final String method;
    /** "shafi" or "hanafi". */
    final String asrSchool;

    private WearPrefs(double latitude, double longitude, long placeAt, String method, String asrSchool) {
        this.latitude = latitude;
        this.longitude = longitude;
        this.placeAt = placeAt;
        this.method = method;
        this.asrSchool = asrSchool;
    }

    boolean hasPlace() {
        return placeAt > 0;
    }

    static WearPrefs load(Context context) {
        SharedPreferences prefs = prefs(context);
        return new WearPrefs(
            Double.longBitsToDouble(prefs.getLong("lat", 0)),
            Double.longBitsToDouble(prefs.getLong("lon", 0)),
            prefs.getLong("place_at", 0),
            prefs.getString("method", "Egyptian"),
            prefs.getString("asr", "shafi"));
    }

    static void savePlace(Context context, double latitude, double longitude) {
        prefs(context).edit()
            .putLong("lat", Double.doubleToRawLongBits(latitude))
            .putLong("lon", Double.doubleToRawLongBits(longitude))
            .putLong("place_at", System.currentTimeMillis())
            .apply();
    }

    static void saveMethod(Context context, String method) {
        prefs(context).edit().putString("method", method).apply();
    }

    static void saveAsrSchool(Context context, String school) {
        prefs(context).edit().putString("asr", school).apply();
    }

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(FILE, Context.MODE_PRIVATE);
    }
}
