package app.lifeos;

import android.content.Context;
import android.hardware.GeomagneticField;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.webkit.WebView;

import java.util.Locale;

/**
 * The phone's compass for the Qibla finder, read natively because the web's
 * orientation events point at magnetic north. This adds the magnetic
 * declination for where you are (Android's built-in World Magnetic Model,
 * no internet needed), so the heading is against true north — the north
 * the Qibla bearing is measured from.
 *
 * Calls window.__lifeOSCompass(heading, accuracyDegrees, calibration):
 * heading 0–360 from true north; accuracyDegrees from the sensor or -1;
 * calibration 0 (unreliable) to 3 (high).
 */
final class Compass implements SensorEventListener {
    private final SensorManager sensors;
    private final WebView webView;
    private final float[] rotation = new float[9];
    private final float[] remapped = new float[9];
    private final float[] orientation = new float[3];
    private float declination;
    private int calibration = 3;
    private long lastSent;
    private boolean running;
    /** "auto" picks by how the phone is held; "flat" or "upright" forces it. */
    private volatile String mode = "auto";

    Compass(Context context, WebView webView) {
        this.sensors = (SensorManager) context.getSystemService(Context.SENSOR_SERVICE);
        this.webView = webView;
    }

    /** Starts (or moves) the compass; false if the phone has no rotation sensor. */
    boolean start(double latitude, double longitude) {
        declination = new GeomagneticField(
            (float) latitude, (float) longitude, 0f, System.currentTimeMillis()).getDeclination();
        if (running) return true;
        Sensor rotationSensor = sensors.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);
        if (rotationSensor == null) return false;
        sensors.registerListener(this, rotationSensor, SensorManager.SENSOR_DELAY_GAME);
        Sensor magnet = sensors.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD);
        if (magnet != null) sensors.registerListener(this, magnet, SensorManager.SENSOR_DELAY_UI);
        running = true;
        return true;
    }

    void setMode(String mode) {
        if ("auto".equals(mode) || "flat".equals(mode) || "upright".equals(mode)) this.mode = mode;
    }

    void stop() {
        if (!running) return;
        sensors.unregisterListener(this);
        running = false;
    }

    float declination() {
        return declination;
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() == Sensor.TYPE_MAGNETIC_FIELD) {
            calibration = event.accuracy;
            return;
        }
        long now = System.currentTimeMillis();
        if (now - lastSent < 50) return;
        lastSent = now;

        SensorManager.getRotationMatrixFromVector(rotation, event.values);
        SensorManager.getOrientation(rotation, orientation);
        double pitch = Math.toDegrees(orientation[1]);
        float[] matrix = rotation;
        // Held up rather than lying flat: measure where the back of the phone
        // faces, which stays steady where the flat reading would swing.
        boolean upright = "upright".equals(mode) || ("auto".equals(mode) && Math.abs(pitch) > 50);
        if (upright) {
            SensorManager.remapCoordinateSystem(rotation, SensorManager.AXIS_X, SensorManager.AXIS_Z, remapped);
            SensorManager.getOrientation(remapped, orientation);
            matrix = remapped;
        }
        double azimuth = Math.toDegrees(orientation[0]);
        double heading = ((azimuth + declination) % 360 + 360) % 360;
        double accuracy = event.values.length > 4 && event.values[4] >= 0 ? Math.toDegrees(event.values[4]) : -1;
        String script = String.format(Locale.ROOT,
            "window.__lifeOSCompass&&window.__lifeOSCompass(%.1f,%.1f,%d,%s)",
            heading, accuracy, calibration, matrix == remapped ? "true" : "false");
        webView.post(() -> webView.evaluateJavascript(script, null));
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        if (sensor.getType() == Sensor.TYPE_MAGNETIC_FIELD) calibration = accuracy;
    }
}
