package app.lifeos.wear;

import android.app.Activity;

import android.graphics.Color;
import android.graphics.Typeface;
import android.hardware.GeomagneticField;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.TypedValue;
import android.view.Gravity;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.batoulapps.adhan.Coordinates;
import com.batoulapps.adhan.Qibla;

/**
 * The Qibla on the wrist: an arrow that points to it while the watch is held
 * flat, using the watch's compass corrected to true north. For reference only.
 */
public class QiblaActivity extends Activity implements SensorEventListener {
    private SensorManager sensors;
    private Sensor rotation;
    private TextView arrow;
    private TextView hint;
    private double qibla;
    private float declination;
    private boolean facing;
    private final float[] matrix = new float[9];
    private final float[] angles = new float[3];

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setBackgroundColor(Color.BLACK);
        int pad = Math.round(24 * getResources().getDisplayMetrics().density);
        root.setPadding(pad, pad, pad, pad);

        arrow = text("↑", 64, MainActivity.ACCENT, true);
        hint = text("", 15, Color.WHITE, true);
        root.addView(text(getString(R.string.qibla), 13, Color.argb(160, 255, 255, 255), false));
        root.addView(arrow);
        root.addView(hint);
        TextView notice = text(getString(R.string.qibla_notice) + "\n" + getString(R.string.qibla_calibrate),
            10, Color.argb(150, 255, 255, 255), false);
        notice.setPadding(0, pad / 2, 0, 0);
        root.addView(notice);
        setContentView(root);

        WearPrefs prefs = WearPrefs.load(this);
        if (!prefs.hasPlace()) {
            hint.setText(R.string.no_place);
            arrow.setText("");
            return;
        }
        qibla = new Qibla(new Coordinates(prefs.latitude, prefs.longitude)).direction;
        declination = new GeomagneticField((float) prefs.latitude, (float) prefs.longitude, 0,
            System.currentTimeMillis()).getDeclination();
        sensors = getSystemService(SensorManager.class);
        rotation = sensors.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);
        if (rotation == null) {
            hint.setText(R.string.qibla_no_sensor);
            arrow.setText("");
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (rotation != null) sensors.registerListener(this, rotation, SensorManager.SENSOR_DELAY_UI);
    }

    @Override
    protected void onPause() {
        if (rotation != null) sensors.unregisterListener(this);
        super.onPause();
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        SensorManager.getRotationMatrixFromVector(matrix, event.values);
        SensorManager.getOrientation(matrix, angles);
        double heading = (Math.toDegrees(angles[0]) + declination + 360) % 360;
        // How far to turn, -180..180: positive means turn right.
        double turn = ((qibla - heading + 540) % 360) - 180;
        arrow.setRotation((float) turn);
        int degrees = (int) Math.round(Math.abs(turn));
        boolean nowFacing = degrees <= 5;
        if (nowFacing) {
            hint.setText(R.string.qibla_facing);
        } else {
            hint.setText(getString(turn > 0 ? R.string.qibla_turn_right : R.string.qibla_turn_left, degrees));
        }
        if (nowFacing && !facing) buzz();
        facing = nowFacing;
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        // The calibration hint is always shown.
    }

    private void buzz() {
        Vibrator vibrator = getSystemService(Vibrator.class);
        if (vibrator != null && vibrator.hasVibrator()) {
            vibrator.vibrate(VibrationEffect.createOneShot(60, VibrationEffect.DEFAULT_AMPLITUDE));
        }
    }

    private TextView text(String value, int sp, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextColor(color);
        view.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        view.setGravity(Gravity.CENTER);
        if (bold) view.setTypeface(Typeface.DEFAULT_BOLD);
        return view;
    }

}
