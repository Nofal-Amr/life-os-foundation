package app.lifeos.kt.data.logic

import app.lifeos.kt.core.model.PrayerLog
import app.lifeos.kt.core.model.PrayerSettings
import com.batoulapps.adhan.CalculationMethod
import com.batoulapps.adhan.CalculationParameters
import com.batoulapps.adhan.PrayerAdjustments
import com.batoulapps.adhan.Coordinates
import com.batoulapps.adhan.Madhab
import com.batoulapps.adhan.PrayerTimes
import com.batoulapps.adhan.data.DateComponents
import java.time.LocalDate
import java.time.ZoneId
import java.util.Date

/** The five prayers, as prayer_logs names them. */
val PRAYERS = listOf("fajr" to "Fajr", "dhuhr" to "Dhuhr", "asr" to "Asr", "maghrib" to "Maghrib", "isha" to "Isha")

/** How a prayer was prayed (prayer_logs.status), in the web app's words and order. */
val PRAYER_STATUSES = listOf("jamaah" to "In jamaah", "on_time" to "On time", "clutch" to "Clutch", "late" to "Late", "missed" to "Missed")

/** The two sunnah prayers logged beside the five: before Fajr, and Witr after Isha. */
val SUNNAH = listOf("sunnah_fajr" to "Sunnah", "witr" to "Witr")

/** The day's order: the sunnah of Fajr first, Witr last. */
val DAY_ORDER = listOf(SUNNAH[0]) + PRAYERS + listOf(SUNNAH[1])

fun isSunnah(name: String) = name == "sunnah_fajr" || name == "witr"

/** A prayer's name on a given day: Dhuhr on a Friday is Jumu'ah. */
fun prayerLabel(name: String, day: LocalDate): String =
    if (name == "dhuhr" && day.dayOfWeek == java.time.DayOfWeek.FRIDAY) "Jumu'ah" else (DAY_ORDER.firstOrNull { it.first == name }?.second ?: name)

/** When to show a prayer's time: the sunnah of Fajr with Fajr's, Witr with Isha's. */
fun timeKeyOf(name: String) = when (name) {
    "sunnah_fajr" -> "fajr"
    "witr" -> "isha"
    else -> name
}

data class PrayerSlot(val key: String, val label: String, val at: Date)

/** The day's five times from prayer settings, or null until a place is set. */
fun prayerTimes(settings: PrayerSettings?, day: LocalDate, zone: ZoneId = ZoneId.systemDefault()): List<PrayerSlot>? {
    val times = times(settings, day, zone) ?: return null
    val at = mapOf("fajr" to times.fajr, "dhuhr" to times.dhuhr, "asr" to times.asr, "maghrib" to times.maghrib, "isha" to times.isha)
    return PRAYERS.map { (key, label) -> PrayerSlot(key, label, at.getValue(key)) }
}

/**
 * The day's prayer windows beyond the five start times: sunrise (when Fajr's
 * time ends), and suggested points for Isha measured across the time from
 * Isha to the next Fajr, as the owner asked: best within the first third,
 * by halfway if needed, and until Fajr only if absolutely necessary.
 */
data class PrayerWindows(val sunrise: Date, val ishaFirstThird: Date, val ishaHalf: Date, val nextFajr: Date)

fun prayerWindows(settings: PrayerSettings?, day: LocalDate, zone: ZoneId = ZoneId.systemDefault()): PrayerWindows? {
    val today = times(settings, day, zone) ?: return null
    val tomorrow = times(settings, day.plusDays(1), zone) ?: return null
    val isha = today.isha.time
    val span = tomorrow.fajr.time - isha
    return PrayerWindows(today.sunrise, Date(isha + span / 3), Date(isha + span / 2), tomorrow.fajr)
}

private fun times(settings: PrayerSettings?, day: LocalDate, zone: ZoneId): PrayerTimes? {
    val latitude = settings?.latitude ?: return null
    val longitude = settings.longitude ?: return null
    val params = parameters(settings.calcMethod)
    params.madhab = if (settings.asrSchool == "hanafi") Madhab.HANAFI else Madhab.SHAFI
    return PrayerTimes(Coordinates(latitude, longitude), DateComponents.from(Date.from(day.atTime(12, 0).atZone(zone).toInstant())), params)
}

/** The status a log stands for, reading older rows that only have completed/on_time. */
fun prayerStatus(log: PrayerLog?): String? = when {
    log == null -> null
    log.status != null -> log.status
    !log.completed -> "missed"
    log.onTime == false -> "late"
    else -> "on_time"
}

/** The web app's method names (adhan.js) to adhan-java's; the web app's default when unset. */
/**
 * The web's method, by its adhan-js name. adhan-java 1.2.1 has no Turkey or
 * Tehran: Turkey is rebuilt exactly (18 degrees/17 degrees with its minute adjustments);
 * Tehran gets its angles (17.7 degrees/14 degrees) but this library can't set its 4.5 degrees
 * Maghrib angle, so its Maghrib shows at sunset, a little earlier than the web.
 */
private fun parameters(name: String?): CalculationParameters = when (name) {
    "Turkey" -> CalculationParameters(18.0, 17.0, CalculationMethod.OTHER).withMethodAdjustments(PrayerAdjustments(0, -7, 5, 4, 7, 0))
    "Tehran" -> CalculationParameters(17.7, 14.0, CalculationMethod.OTHER)
    else -> method(name).parameters
}

private fun method(name: String?): CalculationMethod = when (name) {
    "Egyptian" -> CalculationMethod.EGYPTIAN
    "Karachi" -> CalculationMethod.KARACHI
    "UmmAlQura" -> CalculationMethod.UMM_AL_QURA
    "Dubai" -> CalculationMethod.DUBAI
    "MoonsightingCommittee" -> CalculationMethod.MOON_SIGHTING_COMMITTEE
    "NorthAmerica" -> CalculationMethod.NORTH_AMERICA
    "Kuwait" -> CalculationMethod.KUWAIT
    "Qatar" -> CalculationMethod.QATAR
    "Singapore" -> CalculationMethod.SINGAPORE
    else -> CalculationMethod.MUSLIM_WORLD_LEAGUE
}
