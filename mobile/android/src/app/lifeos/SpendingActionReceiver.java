package app.lifeos;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** "Log it" / "Not spending" on a spending notification. */
public class SpendingActionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String id = intent.getStringExtra("id");
        String status = intent.getStringExtra("status");
        if (id == null || !("log".equals(status) || "dismiss".equals(status))) return;
        SpendingStore.resolve(context, id, status);
    }
}
