package app.lifeos.kt.data

import com.batoulapps.adhan.CalculationMethod
import com.batoulapps.adhan.Coordinates
import com.batoulapps.adhan.Madhab
import com.batoulapps.adhan.PrayerTimes
import com.batoulapps.adhan.data.DateComponents
import java.time.LocalDate
import java.time.ZoneId
import java.util.Date
import org.json.JSONObject

/** The five prayers, as prayer_logs names them. */
val PRAYERS = listOf("fajr" to "Fajr", "dhuhr" to "Dhuhr", "asr" to "Asr", "maghrib" to "Maghrib", "isha" to "Isha")

/** How a prayer was prayed (prayer_logs.status), in the web app's words. */
val PRAYER_STATUSES = listOf("jamaah" to "In jamaah", "on_time" to "On time", "late" to "Late", "missed" to "Missed")

data class PrayerSlot(val key: String, val label: String, val at: Date)

/** The day's five times from prayer_settings, or null until a place is set. */
fun prayerTimes(settings: JSONObject?, day: LocalDate, zone: ZoneId = ZoneId.systemDefault()): List<PrayerSlot>? {
    if (settings == null || settings.isNull("latitude") || settings.isNull("longitude")) return null
    val params = method(settings.str("calc_method")).parameters
    params.madhab = if (settings.str("asr_school") == "hanafi") Madhab.HANAFI else Madhab.SHAFI
    val noon = Date.from(day.atTime(12, 0).atZone(zone).toInstant())
    val times = PrayerTimes(Coordinates(settings.getDouble("latitude"), settings.getDouble("longitude")), DateComponents.from(noon), params)
    val at = mapOf("fajr" to times.fajr, "dhuhr" to times.dhuhr, "asr" to times.asr, "maghrib" to times.maghrib, "isha" to times.isha)
    return PRAYERS.map { (key, label) -> PrayerSlot(key, label, at.getValue(key)) }
}

/** The status a log stands for, reading older rows that only have completed/on_time. */
fun prayerStatus(log: JSONObject?): String? {
    if (log == null) return null
    val status = log.str("status")
    if (status != null) return status
    if (!log.optBoolean("completed")) return "missed"
    return if (!log.isNull("on_time") && !log.getBoolean("on_time")) "late" else "on_time"
}

/** The web app's method names (adhan.js) to adhan-java's; the web app's default when unset. */
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
