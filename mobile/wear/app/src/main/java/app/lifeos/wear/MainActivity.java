package app.lifeos.wear;

import android.Manifest;
import android.app.Activity;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.location.Location;
import android.location.LocationManager;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.Handler;
import android.os.Looper;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import androidx.wear.tiles.TileService;
import androidx.wear.watchface.complications.datasource.ComplicationDataSourceUpdateRequester;

import java.util.Date;

/**
 * The watch app: the next prayer, today's times, and the Qibla. Times are
 * worked out on the watch from its saved place, so it works offline and
 * without signing in.
 */
public class MainActivity extends Activity {
    private static final int ASK_LOCATION = 1;
    static final int ACCENT = Color.rgb(48, 213, 200);
    private static final int DIM = Color.argb(160, 255, 255, 255);

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable tick = new Runnable() {
        @Override
        public void run() {
            render();
            handler.postDelayed(this, 30_000);
        }
    };
    private LinearLayout content;
    private String status;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(Color.BLACK);
        content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setGravity(Gravity.CENTER_HORIZONTAL);
        // Round screens: keep text away from the curved edge.
        int side = dp(22);
        content.setPadding(side, dp(28), side, dp(40));
        scroll.addView(content);
        setContentView(scroll);
        scroll.requestFocus(); // the crown / bezel scrolls it
    }

    @Override
    protected void onResume() {
        super.onResume();
        handler.post(tick);
    }

    @Override
    protected void onPause() {
        handler.removeCallbacks(tick);
        super.onPause();
    }

    private void render() {
        content.removeAllViews();
        Date now = new Date();
        WearPrefs prefs = WearPrefs.load(this);
        PrayerDay today = PrayerDay.on(this, now);

        if (today == null) {
            content.addView(text(getString(R.string.no_place), 15, Color.WHITE, false));
            if (status != null) content.addView(text(status, 13, DIM, false));
            content.addView(button(getString(R.string.use_location), true, v -> locate()));
            return;
        }

        PrayerDay.Slot next = PrayerDay.next(this, now);
        if (next != null) {
            content.addView(text(getString(R.string.next), 13, DIM, false));
            content.addView(text(Labels.name(this, next.key, next.at), 26, Color.WHITE, true));
            content.addView(text(Labels.time(this, next.at) + " · "
                + getString(R.string.in_time, Labels.until(this, next.at, now)), 15, ACCENT, false));
        }

        LinearLayout list = new LinearLayout(this);
        list.setOrientation(LinearLayout.VERTICAL);
        list.setPadding(0, dp(12), 0, dp(8));
        for (PrayerDay.Slot slot : today.slots) {
            boolean isNext = next != null && slot.key.equals(next.key) && slot.at.equals(next.at);
            list.addView(row(Labels.name(this, slot.key, slot.at), Labels.time(this, slot.at),
                slot.isPrayer() ? (isNext ? ACCENT : Color.WHITE) : DIM, isNext));
        }
        content.addView(list, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        content.addView(button(getString(R.string.qibla), true,
            v -> startActivity(new Intent(this, QiblaActivity.class))));
        content.addView(button(getString(R.string.method) + ": " + Labels.method(this, prefs.method), false, v -> {
            int index = 0;
            for (int i = 0; i < PrayerDay.METHODS.length; i++) {
                if (PrayerDay.METHODS[i].equals(prefs.method)) index = i;
            }
            WearPrefs.saveMethod(this, PrayerDay.METHODS[(index + 1) % PrayerDay.METHODS.length]);
            changed(this);
            render();
        }));
        content.addView(button(getString(R.string.asr_school) + ": "
            + getString("hanafi".equals(prefs.asrSchool) ? R.string.hanafi : R.string.shafi), false, v -> {
                WearPrefs.saveAsrSchool(this, "hanafi".equals(prefs.asrSchool) ? "shafi" : "hanafi");
                changed(this);
                render();
            }));
        content.addView(button(getString(R.string.update_location), false, v -> locate()));
        if (status != null) content.addView(text(status, 12, DIM, false));
        TextView footer = text(getString(R.string.on_watch) + "\n" + getString(R.string.place_updated,
            android.text.format.DateFormat.getMediumDateFormat(this).format(new Date(prefs.placeAt))), 11, DIM, false);
        footer.setPadding(0, dp(10), 0, 0);
        content.addView(footer);
    }

    /* ------------------------------------------------------------ location */

    private void locate() {
        if (checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[] {
                Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION,
            }, ASK_LOCATION);
            return;
        }
        status = getString(R.string.finding);
        render();
        LocationManager manager = getSystemService(LocationManager.class);
        String provider = pickProvider(manager);
        if (provider == null) {
            status = getString(R.string.no_fix);
            render();
            return;
        }
        CancellationSignal cancel = new CancellationSignal();
        handler.postDelayed(cancel::cancel, 30_000);
        try {
            manager.getCurrentLocation(provider, cancel, getMainExecutor(), this::gotLocation);
        } catch (SecurityException e) {
            status = getString(R.string.need_permission);
            render();
        }
    }

    private static String pickProvider(LocationManager manager) {
        for (String provider : new String[] { "fused", LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER }) {
            try {
                if (manager.getAllProviders().contains(provider) && manager.isProviderEnabled(provider)) return provider;
            } catch (Exception ignored) {
                // Try the next one.
            }
        }
        return null;
    }

    private void gotLocation(Location location) {
        if (location == null) {
            status = getString(R.string.no_fix);
        } else {
            WearPrefs.savePlace(this, location.getLatitude(), location.getLongitude());
            status = null;
            changed(this);
        }
        render();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode != ASK_LOCATION) return;
        if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) {
            locate();
        } else {
            status = getString(R.string.need_permission);
            render();
        }
    }

    /** Settings or place changed: the tile and the watch-face slot redraw. */
    static void changed(Context context) {
        try {
            TileService.getUpdater(context).requestUpdate(PrayerTileService.class);
        } catch (Exception ignored) {
            // The tile isn't added; nothing to redraw.
        }
        try {
            ComplicationDataSourceUpdateRequester.create(context,
                new ComponentName(context, NextPrayerComplicationService.class)).requestUpdateAll();
        } catch (Exception ignored) {
            // Not on a watch face.
        }
    }

    /* ---------------------------------------------------------------- views */

    private TextView text(String value, int sp, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextColor(color);
        view.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        view.setGravity(Gravity.CENTER);
        if (bold) view.setTypeface(Typeface.DEFAULT_BOLD);
        return view;
    }

    private View row(String name, String time, int color, boolean bold) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setPadding(dp(8), dp(5), dp(8), dp(5));
        TextView left = text(name, 15, color, bold);
        left.setGravity(Gravity.START);
        TextView right = text(time, 15, color, bold);
        right.setGravity(Gravity.END);
        row.addView(left, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        row.addView(right, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        return row;
    }

    private Button button(String label, boolean primary, View.OnClickListener onClick) {
        Button button = new Button(this);
        button.setText(label);
        button.setAllCaps(false);
        button.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        button.setTextColor(primary ? Color.BLACK : Color.WHITE);
        GradientDrawable shape = new GradientDrawable();
        shape.setColor(primary ? ACCENT : Color.rgb(32, 36, 44));
        shape.setCornerRadius(dp(24));
        button.setBackground(shape);
        button.setOnClickListener(onClick);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(48));
        params.setMargins(0, dp(6), 0, 0);
        button.setLayoutParams(params);
        return button;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
