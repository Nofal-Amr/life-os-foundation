package app.lifeos.kt.data

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.Transaction
import androidx.room.Upsert
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import kotlinx.coroutines.flow.Flow

/** A row of public.tasks, as stored on the phone. Dates are ISO text, as the server sends them. */
@Entity(tableName = "tasks")
data class TaskEntity(
    @PrimaryKey val id: String,
    val title: String,
    val description: String?,
    val status: String,
    val priority: String,
    /** yyyy-MM-dd */
    val dueDate: String?,
    /** HH:mm:ss */
    val dueTime: String?,
    val parentTaskId: String?,
    val completedAt: String?,
    val updatedAt: String,
    /** Changed on this phone and not yet on the server. */
    val dirty: Boolean = false,
    /** Deleted on this phone; removed from the server on the next sync. */
    val deleted: Boolean = false,
)

@Dao
abstract class TaskDao {
    @Query("SELECT * FROM tasks WHERE deleted = 0")
    abstract fun observe(): Flow<List<TaskEntity>>

    @Query("SELECT COUNT(*) FROM tasks WHERE dirty = 1")
    abstract fun observePending(): Flow<Int>

    @Query("SELECT * FROM tasks WHERE dirty = 1")
    abstract suspend fun pending(): List<TaskEntity>

    @Upsert
    abstract suspend fun upsert(task: TaskEntity)

    @Upsert
    abstract suspend fun upsertAll(tasks: List<TaskEntity>)

    /** Clean again, unless it was changed while it was being sent. */
    @Query("UPDATE tasks SET dirty = 0 WHERE id = :id AND updatedAt = :updatedAt")
    abstract suspend fun markSent(id: String, updatedAt: String)

    @Query("DELETE FROM tasks WHERE id = :id")
    abstract suspend fun remove(id: String)

    @Query("DELETE FROM tasks WHERE id IN (:ids)")
    abstract suspend fun removeAll(ids: List<String>)

    @Query("SELECT id FROM tasks WHERE dirty = 1")
    abstract suspend fun dirtyIds(): List<String>

    @Query("SELECT id FROM tasks WHERE dirty = 0")
    abstract suspend fun cleanIds(): List<String>

    @Query("DELETE FROM tasks")
    abstract suspend fun clear()

    /** The server's rows win, except over changes this phone hasn't sent yet. */
    @Transaction
    open suspend fun replaceFromServer(rows: List<TaskEntity>) {
        val dirty = dirtyIds().toSet()
        upsertAll(rows.filter { it.id !in dirty })
        val onServer = rows.mapTo(HashSet()) { it.id }
        cleanIds().filter { it !in onServer }.chunked(500).forEach { removeAll(it) }
    }
}

@Database(entities = [TaskEntity::class, RowEntity::class], version = 2, exportSchema = false)
abstract class LifeOsDb : RoomDatabase() {
    abstract fun tasks(): TaskDao
    abstract fun rows(): RowDao

    companion object {
        /** Version 2 adds the other tables; tasks waiting to be sent are kept. */
        private val ADD_ROWS = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    "CREATE TABLE IF NOT EXISTS `synced_rows` (`tbl` TEXT NOT NULL, `id` TEXT NOT NULL, " +
                        "`json` TEXT NOT NULL, `dirty` INTEGER NOT NULL, `deleted` INTEGER NOT NULL, " +
                        "`stamp` TEXT NOT NULL, PRIMARY KEY(`tbl`, `id`))",
                )
            }
        }

        fun open(context: Context): LifeOsDb =
            Room.databaseBuilder(context, LifeOsDb::class.java, "lifeos.db").addMigrations(ADD_ROWS).build()
    }
}
