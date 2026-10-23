package app.lifeos.kt.core.common

import java.text.NumberFormat
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Currency
import javax.inject.Qualifier

/** The coroutine scope that lives as long as the app (sync, session). */
@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class ApplicationScope

fun nowIso(): String = Instant.now().toString()

/** A server timestamp (timestamptz) as a date on this phone, or null. */
fun localDateOf(timestamp: String?, zone: ZoneId = ZoneId.systemDefault()): LocalDate? = runCatching {
    OffsetDateTime.parse(timestamp).atZoneSameInstant(zone).toLocalDate()
}.getOrNull()

fun instantOf(timestamp: String?): Instant? = runCatching { OffsetDateTime.parse(timestamp).toInstant() }.getOrNull()

/** "Today", "Yesterday", "Tomorrow", "Mon 27 Oct", or with the year when it isn't this one. */
fun friendlyDate(date: LocalDate, today: LocalDate = LocalDate.now()): String = when (date) {
    today -> "Today"
    today.minusDays(1) -> "Yesterday"
    today.plusDays(1) -> "Tomorrow"
    else -> date.format(DateTimeFormatter.ofPattern(if (date.year == today.year) "EEE d MMM" else "d MMM yyyy"))
}

fun friendlyDate(iso: String?, today: LocalDate = LocalDate.now()): String? =
    iso?.let { runCatching { LocalDate.parse(it.take(10)) }.getOrNull() }?.let { friendlyDate(it, today) }

/**
 * Money in the account's currency (Settings on the website), or a plain
 * number when none is set. Negative values keep their minus sign.
 */
class MoneyFormatter(currencyCode: String?) {
    private val code = currencyCode?.takeIf { it.isNotBlank() }
    private val format: NumberFormat = if (code != null) {
        NumberFormat.getCurrencyInstance().apply {
            runCatching { currency = Currency.getInstance(code) }
            maximumFractionDigits = 2
        }
    } else {
        NumberFormat.getNumberInstance().apply { maximumFractionDigits = 2 }
    }

    fun format(value: Double): String = format.format(value)

    /** Without fractions when they're zero: 1,250 instead of 1,250.00. */
    fun short(value: Double): String {
        val copy = format.clone() as NumberFormat
        if (value % 1.0 == 0.0) copy.minimumFractionDigits = 0
        copy.maximumFractionDigits = if (value % 1.0 == 0.0) 0 else 2
        return copy.format(value)
    }
}
