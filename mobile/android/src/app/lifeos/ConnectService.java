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
    /** Whether the service is running in this process (it ends with the process). */
    private static volatile boolean running;

    private RealtimeSocket socket;
    private ConnectConfig config;
    private ConnectivityManager.NetworkCallback networkCallback;
    private android.content.BroadcastReceiver screenOn;
    /** Who's on the channel: tells whether the other phone is online. */
    private final PeerPresence presence = new PeerPresence();
    private static final String KEY_PEER_ONLINE = "peer_online";
    private static final String KEY_PEER_SINCE = "peer_since";
    private static final String KEY_PEER_SEEN = "peer_seen";
    /** SIM phone: follows the battery, to show it on the main phone. */
    private android.content.BroadcastReceiver battery;

    /** Starts or stops the service to match the saved role. */
    static void sync(Context context) {
        if (!inBuild(context)) return;
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

    /**
     * Opening the app: start Life Connect if it should run and isn't (after an
     * update, or if Android stopped it). A running connection is left alone.
     */
    static void ensureRunning(Context context) {
        if (running) return;
        sync(context);
    }

    /** False in the Global (Play Store) build, which leaves Life Connect out. */
    static boolean inBuild(Context context) {
        try {
            context.getPackageManager().getServiceInfo(
                new android.content.ComponentName(context, ConnectService.class), 0);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        running = true;
        CrashLog.install(this);
        NotificationManager manager = getSystemService(NotificationManager.class);
        NotificationChannel status = new NotificationChannel(
            CHANNEL_STATUS, "Life Connect", NotificationManager.IMPORTANCE_MIN);
        status.setDescription("Shown while Life Connect is on.");
        status.setShowBadge(false);
        manager.createNotificationChannel(status);
        CallAlert.ensureChannels(this);
        FindPhone.ensureChannel(this);
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
        socket = new RealtimeSocket(config.url, config.anonKey, config.topic(), config.role, new RealtimeSocket.Listener() {
            @Override
            public void onMessage(String sealed) {
                handle(sealed);
            }

            @Override
            public void onPresence(String event, JSONObject payload) {
                ConnectService.this.onPresence(event, payload);
            }

            @Override
            public void onConnected(boolean isConnected) {
                boolean changed = connected != isConnected;
                connected = isConnected;
                // Disconnected: who else is there is unknown until the next full list.
                if (!isConnected) presence.reset();
                if (changed) refreshStatus();
                // Just (re)connected: the main phone gets the battery straight away.
                ConnectConfig current = config;
                if (isConnected && current != null && "sim".equals(current.role)) {
                    PeerBattery.sendNow(ConnectService.this, current);
                }
            }
        });
        socket.start();
        refreshStatus();
        watchBattery();
        watchNetwork();
        watchScreen();
        return START_STICKY;
    }

    /** The relay's list of who's on the channel changed. */
    private void onPresence(String event, JSONObject payload) {
        ConnectConfig current = config;
        if (current == null) return;
        if ("presence_state".equals(event)) {
            presence.reset();
            addAll(payload, true);
        } else {
            addAll(payload.optJSONObject("joins"), true);
            addAll(payload.optJSONObject("leaves"), false);
        }
        peerIs(this, presence.online(PeerPresence.peerOf(current.role)));
    }

    private void addAll(JSONObject byKey, boolean join) {
        if (byKey == null) return;
        java.util.Iterator<String> keys = byKey.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            JSONObject entry = byKey.optJSONObject(key);
            org.json.JSONArray metas = entry == null ? null : entry.optJSONArray("metas");
            if (metas == null) continue;
            for (int i = 0; i < metas.length(); i++) {
                JSONObject meta = metas.optJSONObject(i);
                String ref = meta == null ? "" : meta.optString("phx_ref", "");
                if (join) presence.join(key, ref);
                else presence.leave(key, ref);
            }
        }
    }

    /** Saves the other phone's state when it changes, and updates the notification. */
    private void peerIs(Context context, boolean online) {
        android.content.SharedPreferences prefs = context.getSharedPreferences(ConnectConfig.PREFS, MODE_PRIVATE);
        boolean seen = prefs.getBoolean(KEY_PEER_SEEN, false);
        // An older app on the other phone never shows up: say nothing rather than "offline".
        if (!seen && !online) return;
        if (seen && prefs.getBoolean(KEY_PEER_ONLINE, false) == online) return;
        prefs.edit()
            .putBoolean(KEY_PEER_SEEN, true)
            .putBoolean(KEY_PEER_ONLINE, online)
            .putLong(KEY_PEER_SINCE, System.currentTimeMillis())
            .apply();
        refreshStatus();
    }

    /** The other phone, for the page: {seen, online, since} (online only means something once seen). */
    static JSONObject peerLink(Context context) {
        android.content.SharedPreferences prefs = context.getSharedPreferences(ConnectConfig.PREFS, MODE_PRIVATE);
        JSONObject link = new JSONObject();
        try {
            boolean seen = prefs.getBoolean(KEY_PEER_SEEN, false);
            link.put("seen", seen && connected);
            link.put("online", prefs.getBoolean(KEY_PEER_ONLINE, false));
            link.put("since", prefs.getLong(KEY_PEER_SINCE, 0));
        } catch (Exception ignored) {
            // Empty then.
        }
        return link;
    }

    private Notification statusNotification() {
        Intent open = new Intent(this, MainActivity.class)
            .setAction(Intent.ACTION_VIEW)
            .setData(Uri.parse("lifeos://open/settings"));
        PendingIntent tap = PendingIntent.getActivity(this, 7203, open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        boolean main = "main".equals(config.role);
        String peerName = main ? ConnectConfig.peer(this) : "";
        if (peerName.isEmpty()) peerName = main ? "SIM phone" : "Main phone";
        String title = "Life Connect is on";
        String text = main
            ? "Rings here when your SIM phone gets a call."
            : "Sends this phone's calls to your main phone.";
        JSONObject link = peerLink(this);
        if (!connected) {
            title = "Life Connect: connecting";
            text = "This phone isn't reaching the relay yet (no internet, or reconnecting).";
        } else if (link.optBoolean("seen") && !link.optBoolean("online")) {
            String since = android.text.format.DateFormat.getTimeFormat(this)
                .format(new java.util.Date(link.optLong("since")));
            text = peerName + " offline since " + since + ". "
                + (main ? "Its calls and texts can't reach this phone until it's back online."
                        : "Calls won't ring there until it's back online.");
        } else if (link.optBoolean("seen")) {
            String battery = main ? PeerBattery.summary(this) : null;
            text = peerName + " online" + (battery == null ? "" : ", battery " + battery) + ". " + text;
        } else {
            String battery = main ? PeerBattery.summary(this) : null;
            if (battery != null) text = peerName + " battery " + battery + ". " + text;
        }
        Notification.Builder builder = new Notification.Builder(this, CHANNEL_STATUS)
            .setSmallIcon(R.drawable.ic_stat_prayer)
            .setContentTitle(title)
            .setOnlyAlertOnce(true)
            .setContentText(text)
            .setContentIntent(tap)
            .setOngoing(true);
        if ("main".equals(config.role)) {
            // One tap to bring up the music remote for the SIM phone.
            Intent music = new Intent(this, ConnectActionReceiver.class).setAction("app.lifeos.CONNECT_media_status");
            builder.addAction(new Notification.Action.Builder(null, "Music on SIM phone",
                PendingIntent.getBroadcast(this, 7240, music, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE)).build());
        }
        return builder.build();
    }

    /** SIM phone: send the battery to the main phone whenever it changes. */
    private void watchBattery() {
        stopBattery();
        if (config == null || !"sim".equals(config.role)) return;
        try {
            battery = PeerBattery.watch(this, config);
        } catch (Exception e) {
            battery = null;
        }
    }

    private void stopBattery() {
        if (battery == null) return;
        try {
            unregisterReceiver(battery);
        } catch (Exception ignored) {
            // Already gone.
        }
        battery = null;
    }

    /** Main phone: the Life Connect notification shows the SIM phone's battery. */
    private void refreshStatus() {
        if (config == null) return;
        try {
            getSystemService(NotificationManager.class).notify(STATUS_ID, statusNotification());
        } catch (Exception ignored) {
            // Shown again on the next start.
        }
    }

    /** Screen turned on: if the connection dropped while asleep, reconnect now. */
    private void watchScreen() {
        if (screenOn != null) return;
        screenOn = new android.content.BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (socket != null && !connected) socket.kick();
            }
        };
        android.content.IntentFilter filter = new android.content.IntentFilter(Intent.ACTION_SCREEN_ON);
        filter.addAction(Intent.ACTION_USER_PRESENT);
        try {
            if (Build.VERSION.SDK_INT >= 33) {
                registerReceiver(screenOn, filter, Context.RECEIVER_NOT_EXPORTED);
            } else {
                registerReceiver(screenOn, filter);
            }
        } catch (Exception e) {
            screenOn = null;
        }
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
        if (message == null || !fresh(message.optString("n"))) return;
        // The relay sends this phone's own messages back too: leave those alone.
        String role = ConnectEcho.senderRole(message.optString(ConnectEcho.FIELD, ""), message.optString("from", ""));
        if (ConnectEcho.isOwn(role, current.role)) return;
        // Wake the CPU long enough to ring or act.
        PowerManager.WakeLock lock = getSystemService(PowerManager.class)
            .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "lifeos:connect");
        lock.acquire(10_000);
        try {
            String type = message.optString("type");
            // Remember the other phone's name, for "Find POCO".
            String peer = message.optString("device", "");
            if ("main".equals(current.role) && !peer.isEmpty()) ConnectConfig.savePeer(this, peer);
            // Find my phone works both ways.
            if ("find".equals(type)) {
                FindPhone.start(this, message.optBoolean("ring", true), message.optBoolean("flash", false),
                    "main".equals(current.role) ? peer : "your main phone");
                return;
            }
            if ("find_stop".equals(type)) {
                FindPhone.stop(this);
                return;
            }
            if ("main".equals(current.role)) {
                switch (type) {
                    case "ring": CallAlert.ring(this, message); break;
                    case "answered": CallAlert.answered(this, message); break;
                    case "ended": CallAlert.ended(this, message); break;
                    case "test": CallAlert.test(this, message); break;
                    case "sms": SmsAlert.show(this, message); break;
                    case "media_state": MediaAlert.show(this, message); break;
                    case "battery":
                        PeerBattery.received(this, message);
                        refreshStatus();
                        break;
                    case "spend":
                        SpendingStore.add(this, message.optDouble("amount"), message.optString("currency"),
                            message.optString("merchant"), message.optString("source"),
                            message.optLong("spentAt", System.currentTimeMillis()));
                        break;
                    default: break;
                }
            } else {
                switch (type) {
                    case "answer": CallControl.answer(this); break;
                    case "decline": CallControl.decline(this); break;
                    case "mute": CallControl.mute(this); break;
                    case "reply": SmsAlert.send(this, message); break;
                    case "media": MediaRemote.handle(this, current, message); break;
                    default: break;
                }
            }
        } finally {
            if (lock.isHeld()) lock.release();
        }
    }

    /** Ids seen in the last few minutes; a repeat is a replay and is ignored. */
    private final java.util.LinkedHashSet<String> seenIds = new java.util.LinkedHashSet<>();

    private synchronized boolean fresh(String id) {
        if (id == null || id.isEmpty()) return false;
        if (!seenIds.add(id)) return false;
        while (seenIds.size() > 200) seenIds.remove(seenIds.iterator().next());
        return true;
    }

    @Override
    public void onDestroy() {
        running = false;
        if (socket != null) socket.stop();
        socket = null;
        connected = false;
        stopBattery();
        if (screenOn != null) {
            try {
                unregisterReceiver(screenOn);
            } catch (Exception ignored) {
                // Already gone.
            }
            screenOn = null;
        }
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
