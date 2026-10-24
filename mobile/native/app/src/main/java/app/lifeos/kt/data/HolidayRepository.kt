package app.lifeos.kt.data

import android.content.Context
import app.lifeos.kt.data.logic.Holiday
import app.lifeos.kt.data.logic.islamicDays
import dagger.hilt.android.qualifiers.ApplicationContext
import java.time.LocalDate
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request

@Serializable
data class HolidaySettings(val country: String? = null, val islamic: Boolean = false, val hidden: List<String> = emptyList())

@Serializable
private data class Nager(val date: String, val name: String, val localName: String? = null)

@Serializable
data class Country(val countryCode: String, val name: String)

@Serializable
private data class Cached(val date: String, val name: String, val localName: String? = null, val kind: String)

/**
 * Holidays, opt-in and kept on this phone, as the web keeps them per device:
 * public holidays for a chosen country from the free Nager.Date service (only
 * the country code and year are sent, with no account data), cached so they
 * show offline; Islamic occasions worked out on the phone.
 */
@Singleton
class HolidayRepository @Inject constructor(@ApplicationContext context: Context) {
    private val prefs = context.getSharedPreferences("holidays", Context.MODE_PRIVATE)
    private val json = Json { ignoreUnknownKeys = true }
    // A plain client: nothing from the Life OS session goes to a third party.
    private val http = OkHttpClient.Builder().callTimeout(10, TimeUnit.SECONDS).build()

    private val _settings = MutableStateFlow(readSettings())
    val settings: StateFlow<HolidaySettings> = _settings
    private val _holidays = MutableStateFlow<List<Holiday>>(emptyList())
    val holidays: StateFlow<List<Holiday>> = _holidays

    private fun readSettings(): HolidaySettings =
        runCatching { json.decodeFromString(HolidaySettings.serializer(), prefs.getString("settings", null)!!) }.getOrDefault(HolidaySettings())

    suspend fun update(change: (HolidaySettings) -> HolidaySettings) {
        val next = change(_settings.value)
        prefs.edit().putString("settings", json.encodeToString(HolidaySettings.serializer(), next)).apply()
        _settings.value = next
        refresh()
    }

    /** This year's and next year's, hidden ones left out. Offline and uncached, Islamic days still show. */
    suspend fun refresh(year: Int = LocalDate.now().year) {
        val s = _settings.value
        val list = mutableListOf<Holiday>()
        for (y in listOf(year, year + 1)) {
            s.country?.let { list += runCatching { publicHolidays(y, it) }.getOrDefault(emptyList()) }
            if (s.islamic) list += withContext(Dispatchers.Default) { islamicDays(y) }
        }
        val hidden = s.hidden.toSet()
        _holidays.value = list.filter { "${it.date}|${it.name}" !in hidden }.sortedBy { it.date }
    }

    /** Every holiday for the settings, hidden ones included, for the settings list. */
    suspend fun all(year: Int = LocalDate.now().year): List<Holiday> {
        val s = _settings.value
        val list = mutableListOf<Holiday>()
        for (y in listOf(year, year + 1)) {
            s.country?.let { list += runCatching { publicHolidays(y, it) }.getOrDefault(emptyList()) }
            if (s.islamic) list += withContext(Dispatchers.Default) { islamicDays(y) }
        }
        return list.sortedBy { it.date }
    }

    private suspend fun publicHolidays(year: Int, country: String): List<Holiday> {
        val key = "cache:$country:$year"
        prefs.getString(key, null)?.let { cached ->
            return json.decodeFromString(ListSerializer(Cached.serializer()), cached).map { Holiday(LocalDate.parse(it.date), it.name, it.localName, it.kind) }
        }
        val body = withContext(Dispatchers.IO) {
            http.newCall(Request.Builder().url("https://date.nager.at/api/v3/PublicHolidays/$year/$country").build()).execute().use { if (it.isSuccessful) it.body?.string() else null }
        } ?: return emptyList()
        val list = json.decodeFromString(ListSerializer(Nager.serializer()), body).map {
            Cached(it.date, it.name, it.localName?.takeIf { local -> local != it.name }, "public")
        }
        prefs.edit().putString(key, json.encodeToString(ListSerializer(Cached.serializer()), list)).apply()
        return list.map { Holiday(LocalDate.parse(it.date), it.name, it.localName, it.kind) }
    }

    suspend fun countries(): List<Country> = withContext(Dispatchers.IO) {
        prefs.getString("countries", null)?.let { return@withContext json.decodeFromString(ListSerializer(Country.serializer()), it).sortedBy { c -> c.name } }
        val body = http.newCall(Request.Builder().url("https://date.nager.at/api/v3/AvailableCountries").build()).execute().use { if (it.isSuccessful) it.body?.string() else null }
            ?: return@withContext emptyList()
        prefs.edit().putString("countries", body).apply()
        json.decodeFromString(ListSerializer(Country.serializer()), body).sortedBy { it.name }
    }
}
