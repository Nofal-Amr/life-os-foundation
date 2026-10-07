package app.lifeos;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import org.json.JSONObject;

/**
 * Life Connect, always on while a role is set: keeps one Realtime connection
 * open so the main phone rings when the SIM phone gets a call, and the SIM
 * phone hears "decline" / "mute" back. Shows a quiet ongoing notification,
 * as Android requires for anything that keeps running.
 */
public class ConnectService extends Service {
    static final String CHANNEL_STATUS = "connect_status";
    private static final int STATUS_ID = 7200;

    static volatile boolean connected;

    private RealtimeSocket socket;
    private ConnectConfig config;
    private ConnectivityManager.NetworkCallback networkCallback;

    /** Starts or stops the service to match the saved role. */
    static void sync(Context context) {
        Intent intent = new Intent(context, ConnectService.class);
        if (ConnectConfig.load(context) == null) {
            context.stopService(intent);
            return;
        }
        try {
            context.startForegroundService(intent);
        } catch (Exception e) {
            // Not allowed from the background right now; it starts with the app or after a reboot.
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        NotificationManager manager = getSystemService(NotificationManager.class);
        NotificationChannel status = new NotificationChannel(
            CHANNEL_STATUS, "Life Connect", NotificationManager.IMPORTANCE_MIN);
        status.setDescription("Shown while Life Connect is on.");
        status.setShowBadge(false);
        manager.createNotificationChannel(status);
        CallAlert.ensureChannels(this);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        config = ConnectConfig.load(this);
        if (config == null) {
            stopSelf();
            return START_NOT_STICKY;
        }
        Notification notification = statusNotification();
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(STATUS_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_REMOTE_MESSAGING);
        } else {
            startForeground(STATUS_ID, notification);
        }
        if (socket != null) socket.stop();
        socket = new RealtimeSocket(config.url, config.anonKey, config.topic(), new RealtimeSocket.Listener() {
            @Override
            public void onMessage(String sealed) {
                handle(sealed);
            }

            @Override
            public void onConnected(boolean isConnected) {
                connected = isConnected;
            }
        });
        socket.start();
        watchNetwork();
        return START_STICKY;
    }

    private Notification statusNotification() {
        Intent open = new Intent(this, MainActivity.class)
            .setAction(Intent.ACTION_VIEW)
            .setData(Uri.parse("lifeos://open/settings"));
        PendingIntent tap = PendingIntent.getActivity(this, 7203, open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        String text = "main".equals(config.role)
            ? "Rings here when your SIM phone gets a call."
            : "Sends this phone's calls to your main phone.";
        return new Notification.Builder(this, CHANNEL_STATUS)
            .setSmallIcon(R.drawable.ic_stat_prayer)
            .setContentTitle("Life Connect is on")
            .setContentText(text)
            .setContentIntent(tap)
            .setOngoing(true)
            .build();
    }

    /** Network came back: reconnect now instead of waiting out the pause. */
    private void watchNetwork() {
        if (networkCallback != null) return;
        ConnectivityManager connectivity = getSystemService(ConnectivityManager.class);
        networkCallback = new ConnectivityManager.NetworkCallback() {
            @Override
            public void onAvailable(Network network) {
                if (socket != null && !connected) socket.kick();
            }
        };
        try {
            connectivity.registerDefaultNetworkCallback(networkCallback);
        } catch (Exception ignored) {
            networkCallback = null;
        }
    }

    private void handle(String sealed) {
        ConnectConfig current = config;
        if (current == null) return;
        JSONObject message = current.open(sealed);
        if (message == null) return;
        // Wake the CPU long enough to ring or act.
        PowerManager.WakeLock lock = getSystemService(PowerManager.class)
            .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "lifeos:connect");
        lock.acquire(10_000);
        try {
            String type = message.optString("type");
            if ("main".equals(current.role)) {
                switch (type) {
                    case "ring": CallAlert.ring(this, message); break;
                    case "answered": CallAlert.answered(this, message); break;
                    case "ended": CallAlert.ended(this, message); break;
                    case "test": CallAlert.test(this, message); break;
                    default: break;
                }
            } else {
                switch (type) {
                    case "decline": CallControl.decline(this); break;
                    case "mute": CallControl.mute(this); break;
                    default: break;
                }
            }
        } finally {
            if (lock.isHeld()) lock.release();
        }
    }

    @Override
    public void onDestroy() {
        if (socket != null) socket.stop();
        socket = null;
        connected = false;
        if (networkCallback != null) {
            try {
                getSystemService(ConnectivityManager.class).unregisterNetworkCallback(networkCallback);
            } catch (Exception ignored) {
                // Already gone.
            }
            networkCallback = null;
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
