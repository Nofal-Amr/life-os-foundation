package app.lifeos;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import org.json.JSONObject;

/** Decline / Mute on a forwarded call, or Reply to a forwarded SMS: tells the SIM phone. */
public class ConnectActionReceiver extends BroadcastReceiver {
    private void reply(Context context, Intent intent, ConnectConfig config) {
        android.os.Bundle results = android.app.RemoteInput.getResultsFromIntent(intent);
        CharSequence text = results == null ? null : results.getCharSequence(SmsAlert.KEY_REPLY);
        String to = intent.getStringExtra("to");
        String who = intent.getStringExtra("who");
        if (text == null || text.length() == 0 || to == null) return;
        String body = text.toString();
        PendingResult pending = goAsync();
        try {
            ConnectSender.send(config, new JSONObject().put("type", "reply").put("to", to).put("body", body), ok -> {
                SmsAlert.replied(context, to, who == null ? to : who, body, ok);
                pending.finish();
            });
        } catch (Exception e) {
            pending.finish();
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (action == null || !action.startsWith("app.lifeos.CONNECT_")) return;
        String what = action.substring("app.lifeos.CONNECT_".length());
        ConnectConfig config = ConnectConfig.load(context);
        if (config == null || !"main".equals(config.role)) return;
        if ("reply".equals(what)) {
            reply(context, intent, config);
            return;
        }
        if (!"decline".equals(what) && !"mute".equals(what)) return;

        if ("decline".equals(what)) {
            context.getSystemService(NotificationManager.class).cancel(CallAlert.RING_ID);
            IncomingCallActivity.close();
        } else {
            CallAlert.silence(context, "Muted", "The call is still ringing on your SIM phone.");
        }
        PendingResult pending = goAsync();
        try {
            ConnectSender.send(config, new JSONObject().put("type", what), ok -> pending.finish());
        } catch (Exception e) {
            pending.finish();
        }
    }
}
