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
class MoneyFormatter(currencyCode: String?, private val locale: java.util.Locale = java.util.Locale.getDefault()) {
    private val code = currencyCode?.takeIf { it.isNotBlank() }

    /**
     * As the web's formatMoney: decimals only when there's a fraction, and
     * then always two; a code without a symbol is spaced from the number
     * ("EGP 13,439", "-EGP 600").
     */
    fun format(value: Double): String {
        val rounded = Math.round(value * 100) / 100.0
        val digits = if (rounded % 1.0 == 0.0) 0 else 2
        val format = if (code != null) {
            NumberFormat.getCurrencyInstance(locale).apply { runCatching { currency = Currency.getInstance(code) } }
        } else {
            NumberFormat.getNumberInstance(locale)
        }
        format.minimumFractionDigits = digits
        format.maximumFractionDigits = digits
        return format.format(rounded).replace(Regex("^(-?)([A-Z]{3})(?=\\d)"), "$1$2" + NBSP)
    }

    /** The same, kept for older call sites. */
    fun short(value: Double): String = format(value)

    private companion object {
        const val NBSP = ' '
    }
}
