package app.lifeos.kt.data

import androidx.room.Dao
import androidx.room.Entity
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Upsert
import java.time.Instant
import java.util.UUID
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import org.json.JSONObject

/**
 * A server table copied to the phone. [conflict] is the unique key an
 * upsert matches on, so a row made here offline and one made on the website
 * for the same day (a prayer, a health log) become one row, not an error.
 */
data class SyncedTable(val name: String, val conflict: String = "id")

/** Every table the native app keeps on the phone, besides tasks. */
val SYNCED_TABLES = listOf(
    SyncedTable("user_preferences", "user_id"),
    SyncedTable("accounts"),
    SyncedTable("finance_categories"),
    SyncedTable("transactions"),
    SyncedTable("payday_config"),
    SyncedTable("prayer_settings", "user_id"),
    SyncedTable("prayer_logs", "user_id,prayer_date,prayer_name"),
    SyncedTable("health_logs", "user_id,log_date"),
    SyncedTable("medications"),
    SyncedTable("habits"),
    SyncedTable("habit_logs", "habit_id,log_date"),
    SyncedTable("notes"),
    SyncedTable("reminders"),
    SyncedTable("events"),
    SyncedTable("projects"),
    SyncedTable("goals"),
)

/** One row of any synced table, kept as the server's JSON. */
@Entity(tableName = "synced_rows", primaryKeys = ["tbl", "id"])
data class RowEntity(
    val tbl: String,
    val id: String,
    val json: String,
    /** Changed on this phone and not yet on the server. */
    val dirty: Boolean = false,
    /** Deleted on this phone; removed from the server on the next sync. */
    val deleted: Boolean = false,
    /** When it last changed here; a row edited mid-send stays dirty. */
    val stamp: String = "",
)

@Dao
abstract class RowDao {
    @Query("SELECT * FROM synced_rows WHERE tbl = :tbl AND deleted = 0")
    abstract fun observe(tbl: String): Flow<List<RowEntity>>

    @Query("SELECT COUNT(*) FROM synced_rows WHERE dirty = 1")
    abstract fun observePending(): Flow<Int>

    @Query("SELECT * FROM synced_rows WHERE tbl = :tbl AND dirty = 1")
    abstract suspend fun pending(tbl: String): List<RowEntity>

    @Upsert
    abstract suspend fun upsert(row: RowEntity)

    @Upsert
    abstract suspend fun upsertAll(rows: List<RowEntity>)

    @Query("UPDATE synced_rows SET dirty = 0 WHERE tbl = :tbl AND id = :id AND stamp = :stamp")
    abstract suspend fun markSent(tbl: String, id: String, stamp: String)

    @Query("DELETE FROM synced_rows WHERE tbl = :tbl AND id = :id")
    abstract suspend fun remove(tbl: String, id: String)

    @Query("DELETE FROM synced_rows WHERE tbl = :tbl AND id IN (:ids)")
    abstract suspend fun removeAll(tbl: String, ids: List<String>)

    @Query("SELECT id FROM synced_rows WHERE tbl = :tbl AND dirty = 1")
    abstract suspend fun dirtyIds(tbl: String): List<String>

    @Query("SELECT id FROM synced_rows WHERE tbl = :tbl AND dirty = 0")
    abstract suspend fun cleanIds(tbl: String): List<String>

    @Query("DELETE FROM synced_rows")
    abstract suspend fun clear()

    /** The server's rows win, except over changes this phone hasn't sent yet. */
    @Transaction
    open suspend fun replaceFromServer(tbl: String, rows: List<RowEntity>) {
        val dirty = dirtyIds(tbl).toSet()
        upsertAll(rows.filter { it.id !in dirty })
        val onServer = rows.mapTo(HashSet()) { it.id }
        cleanIds(tbl).filter { it !in onServer }.chunked(500).forEach { removeAll(tbl, it) }
    }
}

/** Reading and writing any synced table: saved on the phone at once, sent when it can be. */
class Rows(private val dao: RowDao, private val sync: Sync) {
    val pending = dao.observePending()

    fun observe(table: String): Flow<List<JSONObject>> =
        dao.observe(table).map { rows -> rows.map { JSONObject(it.json) } }

    /** Saves a new or changed row; a new one gets an id. Returns the id. */
    suspend fun save(table: String, row: JSONObject): String {
        val id = row.optString("id").ifEmpty { UUID.randomUUID().toString() }
        row.put("id", id)
        dao.upsert(RowEntity(table, id, row.toString(), dirty = true, stamp = Instant.now().toString()))
        sync.request()
        return id
    }

    suspend fun delete(table: String, row: JSONObject) {
        val id = row.optString("id").ifEmpty { return }
        dao.upsert(RowEntity(table, id, row.toString(), dirty = true, deleted = true, stamp = Instant.now().toString()))
        sync.request()
    }
}
