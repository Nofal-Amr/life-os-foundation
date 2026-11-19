package app.lifeos.kt.data

import app.lifeos.kt.core.common.nowIso
import app.lifeos.kt.core.database.RowDao
import app.lifeos.kt.core.model.BodyStats
import app.lifeos.kt.core.model.Profile
import app.lifeos.kt.core.model.UserPreferences
import app.lifeos.kt.core.network.RestApi
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject

/** The areas a person can switch on or off (the web's src/data/modules.ts). Off never deletes anything. */
val MODULES = listOf(
    Triple("do", "Do", "Tasks, projects and goals in one place."),
    Triple("money", "Money", "Accounts, spending and what is left before payday."),
    Triple("body", "Body", "Health log, weight and medication."),
    Triple("spirit", "Spirit", "The five daily prayers, logged in a tap."),
    Triple("resources", "Resources", "Electricity, water and internet usage."),
    Triple("food", "Food", "What you ate and the calories in it."),
    Triple("habits", "Habits", "Small things you want to keep doing."),
    Triple("notes", "Notes", "Quick thoughts you do not want to lose."),
    Triple("calendar", "Calendar", "Everything with a date, on one month view."),
    Triple("study", "Study", "Courses, timetable, tasks and exams."),
    Triple("work", "Work", "Work tasks, notes and clocking in, in their own space."),
    Triple("relationships", "Relationships", "Your people, check-ins you choose, and birthdays."),
)

/** Areas that start off, even for "everything on" (the web's OPT_IN_MODULES). */
val OPT_IN_MODULES = setOf("relationships", "work")

/**
 * Whether an area is on. An empty list is "never chosen", which the web treats as
 * everything on except the opt-in areas.
 */
fun moduleOn(enabled: List<String>?, key: String): Boolean =
    if (enabled.isNullOrEmpty()) key !in OPT_IN_MODULES else key in enabled

/** The list after switching one area, starting from the effective set when nothing was chosen yet. */
fun toggleModule(enabled: List<String>?, key: String, on: Boolean): List<String> {
    val current = if (enabled.isNullOrEmpty()) MODULES.map { it.first }.filter { it !in OPT_IN_MODULES } else enabled
    return if (on) (current + key).distinct() else current - key
}

/** Account-wide settings: the ones the website's Settings page also shows. */
@Singleton
class SettingsRepository @Inject constructor(
    private val store: LocalStore,
    private val rows: RowDao,
    private val api: RestApi,
    private val account: AccountRepository,
) {
    val preferences: Flow<UserPreferences?> = store.observe("user_preferences", UserPreferences.serializer()).map { it.firstOrNull() }
    val profile: Flow<Profile?> = store.observe("profiles", Profile.serializer()).map { it.firstOrNull() }
    val bodyStats: Flow<BodyStats?> = store.observe("body_stats", BodyStats.serializer()).map { it.firstOrNull() }

    suspend fun savePreferences(current: UserPreferences?, change: (UserPreferences) -> UserPreferences) =
        store.save("user_preferences", UserPreferences.serializer(), change(current ?: UserPreferences(newId())))

    suspend fun saveName(current: Profile?, name: String) =
        store.save("profiles", Profile.serializer(), (current ?: Profile(newId())).copy(displayName = name.trim().ifEmpty { null }))

    suspend fun saveBody(current: BodyStats?, heightCm: Double?, targetKg: Double?) =
        store.save("body_stats", BodyStats.serializer(), (current ?: BodyStats(newId())).copy(heightCm = heightCm, targetWeightKg = targetKg, updatedAt = nowIso()))

    /** Everything on this phone as one JSON file: { exported_at, tables: { name: [rows] } }. */
    suspend fun exportJson(): String {
        val json = Json { prettyPrint = true }
        val byTable = rows.all().groupBy { it.tbl }.mapValues { (_, list) ->
            JsonArray(list.mapNotNull { runCatching { json.parseToJsonElement(it.json).jsonObject }.getOrNull() })
        }
        val root = JsonObject(mapOf("exported_at" to JsonPrimitive(nowIso()), "app" to JsonPrimitive("Life OS"), "tables" to JsonObject(byTable)))
        return json.encodeToString(JsonObject.serializer(), root)
    }

    /** Deletes the account on the server (the web's delete_my_account), then forgets it here. Needs internet. */
    suspend fun deleteAccount() {
        api.rpc("delete_my_account", JsonObject(emptyMap()))
        account.signOut()
    }

    val isDemo: Boolean get() = account.isDemo
}
