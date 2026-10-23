package app.lifeos.kt.data

import app.lifeos.kt.core.common.nowIso
import app.lifeos.kt.core.database.RowDao
import app.lifeos.kt.core.database.RowEntity
import app.lifeos.kt.core.model.Row
import app.lifeos.kt.core.sync.SyncEngine
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.flow.map
import kotlinx.serialization.KSerializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject

/**
 * Typed reading and writing over the phone's copy of every table. Saved here
 * at once, sent when it can be. Saving merges onto the stored row, so columns
 * the app doesn't model yet are never lost.
 */
@Singleton
class LocalStore @Inject constructor(
    private val dao: RowDao,
    private val sync: SyncEngine,
    private val json: Json,
) {
    val pending: Flow<Int> = dao.observePending()

    fun <T> observe(table: String, serializer: KSerializer<T>): Flow<List<T>> = dao.observe(table)
        .map { rows -> rows.mapNotNull { row -> runCatching { json.decodeFromString(serializer, row.json) }.getOrNull() } }
        .flowOn(Dispatchers.Default)

    suspend fun <T : Row> save(table: String, serializer: KSerializer<T>, value: T) {
        val stored = dao.get(table, value.id)?.let { json.parseToJsonElement(it.json).jsonObject } ?: JsonObject(emptyMap())
        val merged = JsonObject(stored + json.encodeToJsonElement(serializer, value).jsonObject)
        dao.upsert(RowEntity(table, value.id, merged.toString(), dirty = true, stamp = nowIso()))
        sync.request()
    }

    suspend fun delete(table: String, id: String) {
        val stored = dao.get(table, id) ?: return
        dao.upsert(stored.copy(dirty = true, deleted = true, stamp = nowIso()))
        sync.request()
    }
}
