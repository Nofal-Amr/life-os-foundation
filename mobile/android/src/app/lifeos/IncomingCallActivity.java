package app.lifeos;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.lang.ref.WeakReference;

/**
 * Full-screen "incoming call" on the main phone (also over the lock screen),
 * like a real call: who's calling the SIM phone, with "Answer on …" (picks up
 * on the SIM phone, heard there or on earbuds connected to it), Decline and Mute.
 */
public class IncomingCallActivity extends Activity {
    private static volatile WeakReference<IncomingCallActivity> current = new WeakReference<>(null);

    /** The call was answered, ended or declined: close the screen if it's up. */
    static void close() {
        IncomingCallActivity activity = current.get();
        if (activity != null) activity.runOnUiThread(activity::finish);
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setShowWhenLocked(true);
        setTurnScreenOn(true);
        current = new WeakReference<>(this);

        Intent intent = getIntent();
        String who = intent.getStringExtra("who");
        String number = intent.getStringExtra("number");
        String device = intent.getStringExtra("device");

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER_HORIZONTAL);
        root.setBackgroundColor(Color.rgb(10, 12, 16));
        int pad = dp(28);
        root.setPadding(pad, dp(96), pad, dp(56));

        root.addView(text("Calling " + (device == null ? "your SIM phone" : device), 15, Color.argb(170, 255, 255, 255), false));
        TextView name = text(who == null ? "Unknown number" : who, 34, Color.WHITE, true);
        name.setPadding(0, dp(16), 0, dp(6));
        root.addView(name);
        if (number != null && !number.isEmpty() && !number.equals(who)) {
            root.addView(text(number, 17, Color.argb(170, 255, 255, 255), false));
        }

        LinearLayout spacer = new LinearLayout(this);
        root.addView(spacer, new LinearLayout.LayoutParams(1, 0, 1f));

        // Picks up on the SIM phone; talk there, or on earbuds connected to it.
        Button answer = button(CallAlert.answerLabel(device), Color.rgb(22, 92, 62));
        LinearLayout.LayoutParams wide = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(64));
        wide.setMargins(dp(8), 0, dp(8), 0);
        root.addView(answer, wide);
        root.addView(text("The sound comes from " + (device == null ? "your SIM phone" : device)
            + ", or earbuds connected to it.", 13, Color.argb(150, 255, 255, 255), false));

        LinearLayout buttons = new LinearLayout(this);
        buttons.setOrientation(LinearLayout.HORIZONTAL);
        buttons.setPadding(0, dp(20), 0, 0);
        Button decline = button("Decline", Color.rgb(64, 22, 26));
        Button mute = button("Mute", Color.rgb(36, 40, 48));
        LinearLayout.LayoutParams half = new LinearLayout.LayoutParams(0, dp(64), 1f);
        half.setMargins(dp(8), 0, dp(8), 0);
        buttons.addView(decline, half);
        buttons.addView(mute, new LinearLayout.LayoutParams(half));
        root.addView(buttons, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));

        answer.setOnClickListener(view -> {
            act("answer");
            finish();
        });
        decline.setOnClickListener(view -> {
            act("decline");
            finish();
        });
        mute.setOnClickListener(view -> {
            act("mute");
            mute.setText("Muted");
            mute.setEnabled(false);
        });
        setContentView(root);
    }

    private void act(String what) {
        sendBroadcast(new Intent(this, ConnectActionReceiver.class).setAction("app.lifeos.CONNECT_" + what));
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

    private Button button(String label, int background) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextColor(Color.WHITE);
        button.setTextSize(TypedValue.COMPLEX_UNIT_SP, 17);
        button.setAllCaps(false);
        GradientDrawable shape = new GradientDrawable();
        shape.setColor(background);
        shape.setCornerRadius(dp(32));
        button.setBackground(shape);
        return button;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onDestroy() {
        if (current.get() == this) current = new WeakReference<>(null);
        super.onDestroy();
    }
}
