package app.lifeos.kt.core.notify

import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import app.lifeos.kt.MainActivity
import app.lifeos.kt.R
import app.lifeos.kt.core.notify.ReminderScheduler.Companion.EXTRA_ACTIONS
import app.lifeos.kt.core.notify.ReminderScheduler.Companion.EXTRA_BODY
import app.lifeos.kt.core.notify.ReminderScheduler.Companion.EXTRA_CHANNEL
import app.lifeos.kt.core.notify.ReminderScheduler.Companion.EXTRA_GROUP
import app.lifeos.kt.core.notify.ReminderScheduler.Companion.EXTRA_ID
import app.lifeos.kt.core.notify.ReminderScheduler.Companion.EXTRA_OPEN
import app.lifeos.kt.core.notify.ReminderScheduler.Companion.EXTRA_PRAYER_DATE
import app.lifeos.kt.core.notify.ReminderScheduler.Companion.EXTRA_PRAYER_NAME
import app.lifeos.kt.core.notify.ReminderScheduler.Companion.EXTRA_TITLE
import app.lifeos.kt.data.SpiritRepository
import app.lifeos.kt.data.logic.azkarDone
import app.lifeos.kt.data.logic.prayerLabel
import app.lifeos.kt.data.logic.prayerStatus
import app.lifeos.kt.feature.today.statusLabel
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent
import java.time.LocalDate
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

/** Statuses a notification button may log, and the names it may log them for. */
private val ACTION_STATUSES = setOf("jamaah", "on_time", "clutch", "late", "read")
private val ACTION_NAMES = setOf("fajr", "dhuhr", "asr", "maghrib", "isha", "azkar_morning", "azkar_evening")

private val receiverScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

/** Runs [block] off the main thread while keeping the broadcast alive until it's done. */
private fun BroadcastReceiver.work(block: suspend () -> Unit) {
    val pending = goAsync()
    receiverScope.launch {
        try { block() } finally { pending.finish() }
    }
}

/** Opens the app on [open] ("spirit", "do", "task:<id>", "reminders", "azkar", "today"). */
internal fun openApp(context: Context, open: String, requestCode: Int): PendingIntent =
    PendingIntent.getActivity(
        context,
        requestCode,
        Intent(context, MainActivity::class.java)
            .putExtra(MainActivity.EXTRA_OPEN, open)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

private fun actionLabel(status: String) = if (status == "read") "Read them" else statusLabel(status)

private fun labelFor(name: String, date: String) = when (name) {
    "azkar_morning" -> "Morning azkar"
    "azkar_evening" -> "Evening azkar"
    else -> runCatching { prayerLabel(name, LocalDate.parse(date)) }.getOrDefault(name)
}

/** How a receiver reaches the app's repositories (receivers get no constructor injection). */
@EntryPoint
@InstallIn(SingletonComponent::class)
interface ReceiverEntryPoint {
    fun spirit(): SpiritRepository
}

private fun spiritOf(context: Context) = EntryPointAccessors.fromApplication(context.applicationContext, ReceiverEntryPoint::class.java).spirit()

/** Shows one reminder when its alarm rings. A prayer logged since then stays quiet. */
class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) = work {
        val spirit = spiritOf(context)
        val id = intent.getStringExtra(EXTRA_ID) ?: return@work
        val date = intent.getStringExtra(EXTRA_PRAYER_DATE)
        val name = intent.getStringExtra(EXTRA_PRAYER_NAME)
        if (date != null && name != null) {
            val done = when (name) {
                "azkar_morning" -> azkarDone(spirit.dhikr.first(), date, "morning")
                "azkar_evening" -> azkarDone(spirit.dhikr.first(), date, "evening")
                else -> spirit.logs.first().any { it.prayerDate == date && it.prayerName == name && prayerStatus(it) != null }
            }
            if (done) return@work
        }
        Channels.ensure(context)
        val group = intent.getStringExtra(EXTRA_GROUP) ?: id
        val notificationId = group.hashCode()
        val channel = intent.getStringExtra(EXTRA_CHANNEL) ?: Channels.TASKS
        val builder = Notification.Builder(context, channel)
            .setSmallIcon(R.drawable.ic_stat_prayer)
            .setContentTitle(intent.getStringExtra(EXTRA_TITLE))
            .setContentText(intent.getStringExtra(EXTRA_BODY))
            .setCategory(Notification.CATEGORY_REMINDER)
            .setContentIntent(openApp(context, intent.getStringExtra(EXTRA_OPEN) ?: "today", notificationId))
            .setAutoCancel(true)
        val actions = intent.getStringExtra(EXTRA_ACTIONS)?.split(",")?.filter { it in ACTION_STATUSES }.orEmpty()
        if (date != null && name != null) {
            actions.take(3).forEachIndexed { index, status ->
                val log = Intent(context, PrayerActionReceiver::class.java)
                    .putExtra(PrayerActionReceiver.DATE, date)
                    .putExtra(PrayerActionReceiver.NAME, name)
                    .putExtra(PrayerActionReceiver.STATUS, status)
                    .putExtra(PrayerActionReceiver.NOTIFICATION, notificationId)
                val pending = PendingIntent.getBroadcast(context, notificationId * 4 + index, log, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
                builder.addAction(Notification.Action.Builder(null, actionLabel(status), pending).build())
            }
        }
        context.getSystemService(NotificationManager::class.java).notify(notificationId, builder.build())
    }
}

/**
 * "In jamaah" / "On time" / "Clutch" / "Read them" on a notification: saved to
 * the phone's database straight away (it syncs like any other change), and the
 * reminder becomes a short confirmation that clears itself.
 */
class PrayerActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) = work {
        val spirit = spiritOf(context)
        val date = intent.getStringExtra(DATE) ?: return@work
        val name = intent.getStringExtra(NAME) ?: return@work
        val status = intent.getStringExtra(STATUS) ?: return@work
        if (status !in ACTION_STATUSES || name !in ACTION_NAMES) return@work
        if (runCatching { LocalDate.parse(date) }.isFailure) return@work
        if (name.startsWith("azkar_")) {
            val kind = name.removePrefix("azkar_")
            if (!azkarDone(spirit.dhikr.first(), date, kind)) spirit.logDhikr(date, kind, 0)
        } else if (status != "read") {
            spirit.setStatus(date, name, status, spirit.logs.first())
        }
        val notificationId = intent.getIntExtra(NOTIFICATION, 0)
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.cancel(notificationId)
        Channels.ensure(context)
        manager.notify(
            notificationId,
            Notification.Builder(context, Channels.PRAYERS)
                .setSmallIcon(R.drawable.ic_stat_prayer)
                .setContentTitle("${labelFor(name, date)} logged")
                .setContentText(actionLabel(status).let { if (status == "read") "Read" else it })
                .setOnlyAlertOnce(true)
                .setTimeoutAfter(4_000)
                .setAutoCancel(true)
                .build(),
        )
    }

    companion object {
        const val DATE = "date"
        const val NAME = "name"
        const val STATUS = "status"
        const val NOTIFICATION = "notification"
    }
}

/**
 * After the phone restarts or the app updates, alarms are gone. Receiving this
 * starts the app's process, and the app plans the week again on start.
 */
class RestartReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) = Unit
}
