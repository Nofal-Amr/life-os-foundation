package app.lifeos.kt.core.notify

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import androidx.test.core.app.ApplicationProvider
import app.lifeos.kt.data.logic.prayerStatus
import dagger.hilt.android.EntryPointAccessors
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

/** A ringing reminder shows with its log buttons; a button logs the prayer on the phone. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class ReceiversTest {
    private val context: Context = ApplicationProvider.getApplicationContext()
    private val manager get() = context.getSystemService(NotificationManager::class.java)

    private fun waitFor(check: () -> Boolean) {
        repeat(50) {
            shadowOf(android.os.Looper.getMainLooper()).idle()
            if (check()) return
            Thread.sleep(50)
        }
    }

    @Test fun aPrayerReminderShowsWithLogButtons() {
        val intent = Intent(context, ReminderReceiver::class.java)
            .putExtra(ReminderScheduler.EXTRA_ID, "2026-11-19-asr-now")
            .putExtra(ReminderScheduler.EXTRA_TITLE, "It's time for Asr")
            .putExtra(ReminderScheduler.EXTRA_BODY, "Asr · 14:37. Log it right here.")
            .putExtra(ReminderScheduler.EXTRA_CHANNEL, Channels.PRAYERS)
            .putExtra(ReminderScheduler.EXTRA_OPEN, "spirit")
            .putExtra(ReminderScheduler.EXTRA_GROUP, "2026-11-19-asr")
            .putExtra(ReminderScheduler.EXTRA_PRAYER_DATE, "2026-11-19")
            .putExtra(ReminderScheduler.EXTRA_PRAYER_NAME, "asr")
            .putExtra(ReminderScheduler.EXTRA_ACTIONS, "jamaah,on_time")
        context.sendBroadcast(intent)
        waitFor { shadowOf(manager).allNotifications.isNotEmpty() }
        val shown = shadowOf(manager).allNotifications.single()
        assertEquals("It's time for Asr", shadowOf(shown).contentTitle)
        assertEquals(listOf("In jamaah", "On time"), shown.actions.map { it.title.toString() })
    }

    @Test fun aButtonLogsThePrayer() {
        context.sendBroadcast(
            Intent(context, PrayerActionReceiver::class.java)
                .putExtra(PrayerActionReceiver.DATE, "2026-11-19")
                .putExtra(PrayerActionReceiver.NAME, "asr")
                .putExtra(PrayerActionReceiver.STATUS, "on_time")
                .putExtra(PrayerActionReceiver.NOTIFICATION, 7),
        )
        val spirit = EntryPointAccessors.fromApplication(context, ReceiverEntryPoint::class.java).spirit()
        waitFor { runBlocking { spirit.logs.first().any { it.prayerName == "asr" } } }
        val log = runBlocking { spirit.logs.first() }.single { it.prayerDate == "2026-11-19" && it.prayerName == "asr" }
        assertEquals("on_time", prayerStatus(log))
        assertNotNull(shadowOf(manager).getNotification(7))
    }
}
