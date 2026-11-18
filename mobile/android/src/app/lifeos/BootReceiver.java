package app.lifeos;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Alarms are cleared on reboot; put the stored reminders back, and Life Connect.
 * An app update stops Life Connect too, so it is started again after one.
 */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action)) {
            Reminders.restore(context);
            ConnectService.sync(context);
        } else if (Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            ConnectService.sync(context);
        }
    }
}
