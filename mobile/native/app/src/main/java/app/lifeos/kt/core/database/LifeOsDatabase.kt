package app.lifeos.kt.core.database

import android.content.ContentValues
import android.database.sqlite.SQLiteDatabase
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Query
import androidx.room.RoomDatabase
import androidx.room.Transaction
import androidx.room.Upsert
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import kotlinx.coroutines.flow.Flow
import org.json.JSONObject

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

    @Query("SELECT * FROM synced_rows WHERE tbl = :tbl AND id = :id")
    abstract suspend fun get(tbl: String, id: String): RowEntity?

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

@Database(entities = [RowEntity::class], version = 3, exportSchema = false)
abstract class LifeOsDatabase : RoomDatabase() {
    abstract fun rows(): RowDao

    companion object {
        const val NAME = "lifeos.db"

        /** 0.1 → 0.1.1: the other tables arrive. */
        val ADD_ROWS = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    "CREATE TABLE IF NOT EXISTS `synced_rows` (`tbl` TEXT NOT NULL, `id` TEXT NOT NULL, " +
                        "`json` TEXT NOT NULL, `dirty` INTEGER NOT NULL, `deleted` INTEGER NOT NULL, " +
                        "`stamp` TEXT NOT NULL, PRIMARY KEY(`tbl`, `id`))",
                )
            }
        }

        /** 0.1.1 → 0.2: tasks move into the shared store, unsent changes and all. */
        val TASKS_INTO_ROWS = object : Migration(2, 3) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.query(
                    "SELECT id, title, description, status, priority, dueDate, dueTime, parentTaskId, " +
                        "completedAt, updatedAt, dirty, deleted FROM tasks",
                ).use { c ->
                    while (c.moveToNext()) {
                        fun text(i: Int): Any = if (c.isNull(i)) JSONObject.NULL else c.getString(i)
                        val json = JSONObject()
                            .put("id", c.getString(0))
                            .put("title", c.getString(1))
                            .put("description", text(2))
                            .put("status", c.getString(3))
                            .put("priority", c.getString(4))
                            .put("due_date", text(5))
                            .put("due_time", text(6))
                            .put("parent_task_id", text(7))
                            .put("completed_at", text(8))
                            .put("updated_at", c.getString(9))
                        val values = ContentValues().apply {
                            put("tbl", "tasks")
                            put("id", c.getString(0))
                            put("json", json.toString())
                            put("dirty", c.getInt(10))
                            put("deleted", c.getInt(11))
                            put("stamp", c.getString(9))
                        }
                        db.insert("synced_rows", SQLiteDatabase.CONFLICT_REPLACE, values)
                    }
                }
                db.execSQL("DROP TABLE IF EXISTS tasks")
            }
        }
    }
}
