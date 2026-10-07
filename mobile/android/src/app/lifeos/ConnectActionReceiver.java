package app.lifeos;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import org.json.JSONObject;

/** Decline / Mute on the main phone's ringing notification: tells the SIM phone. */
public class ConnectActionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (action == null || !action.startsWith("app.lifeos.CONNECT_")) return;
        String what = action.substring("app.lifeos.CONNECT_".length());
        if (!"decline".equals(what) && !"mute".equals(what)) return;
        ConnectConfig config = ConnectConfig.load(context);
        if (config == null || !"main".equals(config.role)) return;

        if ("decline".equals(what)) {
            context.getSystemService(NotificationManager.class).cancel(CallAlert.RING_ID);
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
