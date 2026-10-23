package app.lifeos.kt.data

import android.content.Context
import java.io.IOException
import java.time.Instant
import java.util.UUID
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONArray
import org.json.JSONObject

data class SyncState(
    val running: Boolean = false,
    /** Epoch millis of the last finished sync, kept across launches. */
    val lastSynced: Long? = null,
    /** The last try couldn't reach the server. */
    val offline: Boolean = false,
    /** The server refused something; shown so it never fails silently. */
    val error: String? = null,
)

/**
 * Sends this phone's changes, then takes the server's copy. The screens only
 * ever read the phone's database, so they never wait on the network.
 */
class Sync(
    context: Context,
    private val api: Supabase,
    private val session: SessionStore,
    private val tasks: TaskDao,
    private val scope: CoroutineScope,
) {
    private val prefs = context.getSharedPreferences("sync", Context.MODE_PRIVATE)
    private val lock = Mutex()
    private val _state = MutableStateFlow(SyncState(lastSynced = prefs.getLong("lastSynced", 0).takeIf { it > 0 }))
    val state: StateFlow<SyncState> = _state

    @Volatile private var again = false

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

    suspend fun run() = lock.withLock {
        _state.value = _state.value.copy(running = true)
        try {
            try {
                exchange()
            } catch (e: ServerError) {
                if (e.code != 401) throw e
                // Token refused: refresh once and retry. A refused refresh signs out.
                session.expire()
                exchange()
            }
            val now = System.currentTimeMillis()
            prefs.edit().putLong("lastSynced", now).apply()
            _state.value = SyncState(lastSynced = now)
        } catch (e: ServerError) {
            _state.value = _state.value.copy(offline = false, error = "The server refused a change (${e.code}).")
        } catch (e: IOException) {
            _state.value = _state.value.copy(offline = true, error = null)
        } finally {
            _state.value = _state.value.copy(running = false)
        }
    }

    private suspend fun exchange() {
        val token = session.token() ?: return
        val userId = session.current.value?.userId ?: return
        push(token, userId)
        pull(token)
    }

    private suspend fun push(token: String, userId: String) {
        val pending = tasks.pending()
        for (task in pending.filter { it.deleted }) {
            api.delete("tasks", task.id, token)
            tasks.remove(task.id)
        }
        val changed = pending.filter { !it.deleted }
        if (changed.isEmpty()) return
        val rows = JSONArray()
        changed.forEach { rows.put(it.toRow(userId)) }
        api.upsert("tasks", rows, token)
        changed.forEach { tasks.markSent(it.id, it.updatedAt) }
    }

    private suspend fun pull(token: String) {
        val rows = mutableListOf<TaskEntity>()
        var offset = 0
        while (true) {
            val page = api.select(
                "tasks",
                "select=id,title,description,status,priority,due_date,due_time,parent_task_id,completed_at,updated_at" +
                    "&order=id&limit=$PAGE&offset=$offset",
                token,
            )
            for (i in 0 until page.length()) rows += page.getJSONObject(i).toTask()
            if (page.length() < PAGE) break
            offset += PAGE
        }
        tasks.replaceFromServer(rows)
    }

    private companion object {
        const val PAGE = 1000
    }
}

/** Everything a person does to tasks on this phone: saved here at once, sent when it can be. */
class TaskRepo(private val dao: TaskDao, private val sync: Sync) {
    val tasks = dao.observe()
    val pending = dao.observePending()

    suspend fun add(title: String, dueDate: String?) {
        dao.upsert(
            TaskEntity(
                id = UUID.randomUUID().toString(),
                title = title.trim(),
                description = null,
                status = "inbox",
                priority = "medium",
                dueDate = dueDate,
                dueTime = null,
                parentTaskId = null,
                completedAt = null,
                updatedAt = now(),
                dirty = true,
            ),
        )
        sync.request()
    }

    suspend fun setDone(task: TaskEntity, done: Boolean) {
        dao.upsert(
            task.copy(
                status = if (done) "completed" else "todo",
                completedAt = if (done) now() else null,
                updatedAt = now(),
                dirty = true,
            ),
        )
        sync.request()
    }

    suspend fun delete(task: TaskEntity) {
        dao.upsert(task.copy(deleted = true, dirty = true, updatedAt = now()))
        sync.request()
    }

    private fun now() = Instant.now().toString()
}

private fun TaskEntity.toRow(userId: String): JSONObject = JSONObject()
    .put("id", id)
    .put("user_id", userId)
    .put("title", title)
    .put("description", description ?: JSONObject.NULL)
    .put("status", status)
    .put("priority", priority)
    .put("due_date", dueDate ?: JSONObject.NULL)
    .put("due_time", dueTime ?: JSONObject.NULL)
    .put("parent_task_id", parentTaskId ?: JSONObject.NULL)
    .put("completed_at", completedAt ?: JSONObject.NULL)

private fun JSONObject.toTask() = TaskEntity(
    id = getString("id"),
    title = getString("title"),
    description = str("description"),
    status = getString("status"),
    priority = getString("priority"),
    dueDate = str("due_date"),
    dueTime = str("due_time"),
    parentTaskId = str("parent_task_id"),
    completedAt = str("completed_at"),
    updatedAt = getString("updated_at"),
)
