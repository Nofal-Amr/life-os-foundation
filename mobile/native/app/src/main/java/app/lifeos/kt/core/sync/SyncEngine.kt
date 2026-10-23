package app.lifeos.kt.core.sync

import app.lifeos.kt.core.common.ApplicationScope
import app.lifeos.kt.core.database.RowDao
import app.lifeos.kt.core.database.RowEntity
import app.lifeos.kt.core.datastore.SessionSource
import app.lifeos.kt.core.datastore.SyncClock
import app.lifeos.kt.core.network.RestApi
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import retrofit2.HttpException
import retrofit2.Response

/**
 * A server table copied to the phone. [conflict] is the unique key an upsert
 * matches on, so a row made here offline and one made on the website for the
 * same day (a prayer, a health log) become one row, not an error.
 */
data class SyncedTable(val name: String, val conflict: String = "id")

/** Every table the app keeps on the phone. Add one here to have it offline. */
val SYNCED_TABLES = listOf(
    SyncedTable("user_preferences", "user_id"),
    SyncedTable("tasks"),
    SyncedTable("projects"),
    SyncedTable("goals"),
    SyncedTable("habits"),
    SyncedTable("habit_logs", "habit_id,log_date"),
    SyncedTable("accounts"),
    SyncedTable("finance_categories"),
    SyncedTable("transactions"),
    SyncedTable("payday_config"),
    SyncedTable("prayer_settings", "user_id"),
    SyncedTable("prayer_logs", "user_id,prayer_date,prayer_name"),
    SyncedTable("health_logs", "user_id,log_date"),
    SyncedTable("medications"),
    SyncedTable("notes"),
    SyncedTable("reminders"),
    SyncedTable("events"),
)

data class SyncState(
    val running: Boolean = false,
    /** Epoch millis of the last finished sync, kept across launches. */
    val lastSynced: Long? = null,
    /** The last try couldn't reach the server. */
    val offline: Boolean = false,
    /** The server refused something; shown so it never fails silently. */
    val error: String? = null,
)

class ServerRefused(val code: Int, message: String) : IOException(message)

/**
 * Sends this phone's changes, then takes the server's copy. Screens only ever
 * read the phone's database, so they never wait on the network.
 */
@Singleton
class SyncEngine @Inject constructor(
    private val api: RestApi,
    private val rows: RowDao,
    private val session: SessionSource,
    private val settings: SyncClock,
    private val json: Json,
    @ApplicationScope private val scope: CoroutineScope,
) {
    private val lock = Mutex()
    private val _state = MutableStateFlow(SyncState())
    val state: StateFlow<SyncState> = _state
    @Volatile private var again = false

    init {
        scope.launch { _state.value = _state.value.copy(lastSynced = settings.lastSynced.first()) }
    }

    /** Starts a sync; asked during one, it runs once more right after. */
    fun request() {
        if (lock.isLocked) {
            again = true
            return
        }
        scope.launch(Dispatchers.IO) {
            do {
                again = false
                run()
            } while (again && !_state.value.offline)
        }
    }

    /** One full sync. Returns false when it couldn't reach the server. */
    suspend fun run(): Boolean = lock.withLock {
        val userId = session.current()?.userId ?: return@withLock true
        _state.value = _state.value.copy(running = true)
        try {
            // One table failing (a column the server doesn't have yet) doesn't stop the others.
            var refused: ServerRefused? = null
            for (table in SYNCED_TABLES) {
                try {
                    push(table, userId)
                    pull(table)
                } catch (e: HttpException) {
                    if (e.code() == 401) throw e
                    refused = ServerRefused(e.code(), "The server refused ${table.name} (${e.code()}).")
                } catch (e: ServerRefused) {
                    if (e.code == 401) throw e
                    refused = e
                }
            }
            val now = System.currentTimeMillis()
            settings.setLastSynced(now)
            _state.value = SyncState(lastSynced = now, error = refused?.message)
            true
        } catch (e: HttpException) {
            _state.value = _state.value.copy(offline = false, error = "Sign-in needed again (${e.code()}).")
            true
        } catch (e: IOException) {
            _state.value = _state.value.copy(offline = true, error = null)
            false
        } finally {
            _state.value = _state.value.copy(running = false)
        }
    }

    private suspend fun push(table: SyncedTable, userId: String) {
        val pending = rows.pending(table.name)
        for (row in pending.filter { it.deleted }) {
            api.delete(table.name, "eq.${row.id}", "return=minimal").orThrow()
            rows.remove(table.name, row.id)
        }
        val changed = pending.filter { !it.deleted }.map { row ->
            val body = json.parseToJsonElement(row.json).jsonObject.toMutableMap()
            body.remove("created_at")
            body.remove("updated_at")
            body["user_id"] = JsonPrimitive(userId)
            row to JsonObject(body)
        }
        // PostgREST wants the same keys on every row of one request.
        for (group in changed.groupBy { (_, body) -> body.keys.sorted().joinToString(",") }.values) {
            api.upsert(table.name, table.conflict, "resolution=merge-duplicates,return=minimal", JsonArray(group.map { it.second })).orThrow()
            group.forEach { (row, _) -> rows.markSent(table.name, row.id, row.stamp) }
        }
    }

    private suspend fun pull(table: SyncedTable) {
        val all = mutableListOf<RowEntity>()
        var offset = 0
        while (true) {
            val page = api.select(table.name, mapOf("select" to "*", "order" to "id", "limit" to "$PAGE", "offset" to "$offset"))
            for (element in page) {
                val id = element.jsonObject["id"]?.jsonPrimitive?.content ?: continue
                all += RowEntity(table.name, id, element.toString())
            }
            if (page.size < PAGE) break
            offset += PAGE
        }
        rows.replaceFromServer(table.name, all)
    }

    private fun Response<Unit>.orThrow() {
        if (!isSuccessful) throw ServerRefused(code(), "The server refused a change (${code()}).")
    }

    private companion object {
        const val PAGE = 1000
    }
}
