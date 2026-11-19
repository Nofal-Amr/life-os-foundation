package app.lifeos.kt.core.notify

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.core.content.ContextCompat
import app.lifeos.kt.core.datastore.AppSettings
import app.lifeos.kt.core.datastore.SessionState
import app.lifeos.kt.core.datastore.SessionStore
import app.lifeos.kt.data.DemoSeed
import app.lifeos.kt.data.PlannerRepository
import app.lifeos.kt.data.PreferencesRepository
import app.lifeos.kt.data.SpiritRepository
import app.lifeos.kt.data.TaskRepository
import app.lifeos.kt.data.logic.Channel
import app.lifeos.kt.data.logic.Planned
import app.lifeos.kt.data.logic.ReminderSettings
import app.lifeos.kt.data.logic.reminderPlan
import app.lifeos.kt.data.moduleOn
import dagger.hilt.android.qualifiers.ApplicationContext
import java.time.LocalDate
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json

/** The two notification channels, as in the old app: prayers ring loud, tasks are ordinary. */
object Channels {
    const val PRAYERS = "prayers"
    const val TASKS = "tasks"

    fun ensure(context: Context) {
        val manager = context.getSystemService(NotificationManager::class.java)
        if (manager.getNotificationChannel(PRAYERS) == null) {
            manager.createNotificationChannel(
                NotificationChannel(PRAYERS, "Prayer reminders", NotificationManager.IMPORTANCE_HIGH).apply {
                    description = "Before and at each prayer you haven't logged yet, and the azkar."
                },
            )
        }
        if (manager.getNotificationChannel(TASKS) == null) {
            manager.createNotificationChannel(
                NotificationChannel(TASKS, "Tasks and reminders", NotificationManager.IMPORTANCE_DEFAULT).apply {
                    description = "What's due, tasks with a time, your own reminders and water."
                },
            )
        }
    }

    fun id(channel: Channel) = if (channel == Channel.Prayers) PRAYERS else TASKS
}

private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

fun readReminderSettings(raw: String?): ReminderSettings =
    raw?.let { runCatching { json.decodeFromString(ReminderSettings.serializer(), it) }.getOrNull() } ?: ReminderSettings()

fun writeReminderSettings(settings: ReminderSettings): String = json.encodeToString(ReminderSettings.serializer(), settings)

/** Whether the phone lets the app show notifications at all (Android 13+ asks). */
fun canNotify(context: Context): Boolean =
    Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

/** Whether reminders can ring on the minute (Android 12+ lets people switch this off). */
fun canRingOnTime(context: Context): Boolean =
    Build.VERSION.SDK_INT < 31 || context.getSystemService(AlarmManager::class.java).canScheduleExactAlarms()

/**
 * Keeps the phone's alarms in step with the data: the next week of prayer,
 * task, azkar, water and personal reminders. Started with the app; it plans
 * again whenever a log, task, reminder or setting changes. Each alarm that
 * rings starts the app's process, which plans again, so the week keeps rolling.
 */
@Singleton
class ReminderScheduler @Inject constructor(
    @ApplicationContext private val context: Context,
    private val settings: AppSettings,
    private val session: SessionStore,
    private val spirit: SpiritRepository,
    private val tasks: TaskRepository,
    private val planner: PlannerRepository,
    private val prefs: PreferencesRepository,
) {
    private val ids = Json

    @OptIn(FlowPreview::class)
    fun start(scope: CoroutineScope) {
        val data: Flow<List<Planned>> = combine(
            combine(spirit.settings, spirit.logs, spirit.dhikr) { a, b, c -> Triple(a, b, c) },
            combine(tasks.tasks, planner.reminders) { a, b -> a to b },
            prefs.preferences,
            settings.reminders.map(::readReminderSettings),
            session.state,
        ) { (place, logs, dhikr), (taskList, reminders), p, reminderSettings, state ->
            val signedIn = state as? SessionState.SignedIn
            // Signed out, or sample data in demo: nothing should ring.
            if (signedIn == null || signedIn.session.userId == DemoSeed.USER) emptyList()
            else reminderPlan(
                reminderSettings, { moduleOn(p?.enabledModules, it) }, place, logs, dhikr, taskList, reminders,
                LocalDate.now(), System.currentTimeMillis(), twentyFour = (p?.timeFormat ?: "24h") == "24h",
            )
        }
        scope.launch {
            data.debounce(1_500).collect { plan -> replace(plan.take(MAX_ALARMS)) }
        }
    }

    /** Cancels last time's alarms and sets these. */
    private suspend fun replace(plan: List<Planned>) {
        Channels.ensure(context)
        val alarms = context.getSystemService(AlarmManager::class.java)
        val previous = settings.scheduledAlarms.first()?.let { runCatching { ids.decodeFromString(ListSerializer(String.serializer()), it) }.getOrNull() }.orEmpty()
        for (id in previous) alarms.cancel(pending(id, null))
        val exact = canRingOnTime(context)
        for (item in plan) {
            val intent = pending(item.id, item)
            if (exact) alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, item.at, intent)
            else alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, item.at, intent)
        }
        settings.setScheduledAlarms(ids.encodeToString(ListSerializer(String.serializer()), plan.map { it.id }))
    }

    /** The alarm for one reminder; the id is in the data URI, so each one is distinct. */
    private fun pending(id: String, item: Planned?): PendingIntent {
        val intent = Intent(context, ReminderReceiver::class.java).setData(Uri.parse("lifeos-alarm://ring/${Uri.encode(id)}"))
        if (item != null) {
            intent.putExtra(EXTRA_ID, item.id)
                .putExtra(EXTRA_TITLE, item.title)
                .putExtra(EXTRA_BODY, item.body)
                .putExtra(EXTRA_CHANNEL, Channels.id(item.channel))
                .putExtra(EXTRA_OPEN, item.open)
                .putExtra(EXTRA_GROUP, item.group)
            item.prayer?.let {
                intent.putExtra(EXTRA_PRAYER_DATE, it.date).putExtra(EXTRA_PRAYER_NAME, it.name).putExtra(EXTRA_ACTIONS, it.actions.joinToString(","))
            }
        }
        return PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    companion object {
        /** Android allows an app about 500 alarms; a week rarely needs 150. */
        const val MAX_ALARMS = 400
        const val EXTRA_ID = "id"
        const val EXTRA_TITLE = "title"
        const val EXTRA_BODY = "body"
        const val EXTRA_CHANNEL = "channel"
        const val EXTRA_OPEN = "open"
        const val EXTRA_GROUP = "group"
        const val EXTRA_PRAYER_DATE = "prayer_date"
        const val EXTRA_PRAYER_NAME = "prayer_name"
        const val EXTRA_ACTIONS = "actions"
    }
}
