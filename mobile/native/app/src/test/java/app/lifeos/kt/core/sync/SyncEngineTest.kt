package app.lifeos.kt.core.sync

import app.lifeos.kt.core.database.RowDao
import app.lifeos.kt.core.database.RowEntity
import app.lifeos.kt.core.datastore.Session
import app.lifeos.kt.core.datastore.SessionSource
import app.lifeos.kt.core.datastore.SyncClock
import app.lifeos.kt.core.network.AuthApi
import app.lifeos.kt.core.network.NetworkModule
import app.lifeos.kt.core.network.RestApi
import app.lifeos.kt.core.network.TokenProvider
import java.util.concurrent.CopyOnWriteArrayList
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory

/** The phone's database, in memory. */
class FakeRowDao : RowDao() {
    val rows = linkedMapOf<Pair<String, String>, RowEntity>()
    override fun observe(tbl: String): Flow<List<RowEntity>> = flowOf(rows.values.filter { it.tbl == tbl && !it.deleted })
    override suspend fun get(tbl: String, id: String) = rows[tbl to id]
    override fun observePending(): Flow<Int> = flowOf(rows.values.count { it.dirty })
    override suspend fun pending(tbl: String) = rows.values.filter { it.tbl == tbl && it.dirty }
    override suspend fun upsert(row: RowEntity) { rows[row.tbl to row.id] = row }
    override suspend fun upsertAll(rows: List<RowEntity>) = rows.forEach { upsert(it) }
    override suspend fun markSent(tbl: String, id: String, stamp: String) {
        rows[tbl to id]?.takeIf { it.stamp == stamp }?.let { rows[tbl to id] = it.copy(dirty = false) }
    }
    override suspend fun remove(tbl: String, id: String) { rows.remove(tbl to id) }
    override suspend fun removeAll(tbl: String, ids: List<String>) = ids.forEach { remove(tbl, it) }
    override suspend fun dirtyIds(tbl: String) = rows.values.filter { it.tbl == tbl && it.dirty }.map { it.id }
    override suspend fun cleanIds(tbl: String) = rows.values.filter { it.tbl == tbl && !it.dirty }.map { it.id }
    override suspend fun clear() = rows.clear()
}

class FakeSession(var session: Session?) : SessionSource {
    var cleared = false
    override fun current() = session
    override suspend fun save(session: Session) { this.session = session }
    override suspend fun clear() { session = null; cleared = true }
}

class FakeClock : SyncClock {
    override val lastSynced = MutableStateFlow<Long?>(null)
    override suspend fun setLastSynced(millis: Long) { lastSynced.value = millis }
}

private val json = NetworkModule.json()
private fun retrofit(server: MockWebServer) = Retrofit.Builder()
    .baseUrl(server.url("/"))
    .client(OkHttpClient())
    .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
    .build()

private fun signedIn() = Session("access", "refresh", System.currentTimeMillis() / 1000 + 3600, "user-1", "a@b.c")

class SyncEngineTest {
    private val server = MockWebServer()
    private val requests = CopyOnWriteArrayList<RecordedRequest>()
    /** What the server holds per table, as JSON arrays. */
    private val serverRows = mutableMapOf<String, String>()
    private val failing = mutableSetOf<String>()
    private val dao = FakeRowDao()
    private val clock = FakeClock()
    private lateinit var engine: SyncEngine

    @Before
    fun start() {
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                requests += request
                val table = request.requestUrl!!.pathSegments.last()
                if (table in failing) return MockResponse().setResponseCode(400).setBody("""{"message":"column missing"}""")
                return when (request.method) {
                    "GET" -> MockResponse().setBody(serverRows[table] ?: "[]")
                    "POST" -> MockResponse().setResponseCode(201)
                    "DELETE" -> MockResponse().setResponseCode(204)
                    else -> MockResponse().setResponseCode(405)
                }
            }
        }
        server.start()
        engine = SyncEngine(retrofit(server).create(RestApi::class.java), dao, FakeSession(signedIn()), clock, json, CoroutineScope(Dispatchers.Unconfined))
    }

    @After
    fun stop() = server.shutdown()

    private fun dirty(tbl: String, id: String, body: String, deleted: Boolean = false) =
        RowEntity(tbl, id, body, dirty = true, deleted = deleted, stamp = "s1")

    @Test
    fun sendsChangesWithTheUserAndWithoutServerColumnsThenMarksThemSent() = runBlocking {
        dao.upsert(dirty("tasks", "t1", """{"id":"t1","title":"Pay rent","status":"todo","created_at":"x","updated_at":"y","user_id":"someone-else"}"""))
        // The server now has it, so the pull keeps it.
        serverRows["tasks"] = """[{"id":"t1","title":"Pay rent","status":"todo"}]"""
        assertTrue(engine.run())

        val post = requests.first { it.method == "POST" }
        assertEquals("/rest/v1/tasks?on_conflict=id", post.path)
        assertEquals("resolution=merge-duplicates,return=minimal", post.getHeader("Prefer"))
        val sent = json.parseToJsonElement(post.body.readUtf8()).jsonArray.single().jsonObject
        assertEquals("user-1", sent["user_id"]!!.jsonPrimitive.content)
        assertFalse(sent.containsKey("created_at"))
        assertFalse(sent.containsKey("updated_at"))
        assertFalse(dao.rows["tasks" to "t1"]!!.dirty)
        assertNotNull(clock.lastSynced.value)
        assertNull(engine.state.value.error)
    }

    @Test
    fun aRowMadeOfflineForTheSameDayMatchesOnTheTablesUniqueKey() = runBlocking {
        dao.upsert(dirty("prayer_logs", "p1", """{"id":"p1","prayer_date":"2026-10-23","prayer_name":"fajr","status":"jamaah"}"""))
        engine.run()
        val post = requests.first { it.method == "POST" }
        assertEquals("/rest/v1/prayer_logs?on_conflict=user_id%2Cprayer_date%2Cprayer_name", post.path)
    }

    @Test
    fun deletesOnTheServerThenForgetsLocally() = runBlocking {
        dao.upsert(dirty("notes", "n1", """{"id":"n1","title":"Old"}""", deleted = true))
        engine.run()
        val delete = requests.first { it.method == "DELETE" }
        assertEquals("/rest/v1/notes?id=eq.n1", delete.path)
        assertNull(dao.rows["notes" to "n1"])
    }

    @Test
    fun takesTheServersCopyButNeverOverwritesAnUnsentChange() = runBlocking {
        dao.upsert(RowEntity("tasks", "clean", """{"id":"clean","title":"Old title"}"""))
        dao.upsert(RowEntity("tasks", "gone", """{"id":"gone","title":"Deleted on the website"}"""))
        dao.upsert(dirty("tasks", "mine", """{"id":"mine","title":"Edited offline"}"""))
        dao.replaceFromServer(
            "tasks",
            listOf(RowEntity("tasks", "clean", """{"id":"clean","title":"New title"}"""), RowEntity("tasks", "mine", """{"id":"mine","title":"Server version"}""")),
        )
        assertTrue(dao.rows["tasks" to "clean"]!!.json.contains("New title"))
        assertTrue(dao.rows["tasks" to "mine"]!!.json.contains("Edited offline"))
        assertNull(dao.rows["tasks" to "gone"])
    }

    @Test
    fun aRowEditedWhileBeingSentStaysUnsent() = runBlocking {
        dao.upsert(dirty("tasks", "t1", """{"id":"t1","title":"First"}"""))
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                // The person edits the task while the first version is on its way.
                if (request.method == "POST") runBlocking { dao.upsert(dirty("tasks", "t1", """{"id":"t1","title":"Second"}""").copy(stamp = "s2")) }
                return if (request.method == "GET") MockResponse().setBody("[]") else MockResponse().setResponseCode(201)
            }
        }
        engine.run()
        assertTrue(dao.rows["tasks" to "t1"]!!.dirty)
        assertTrue(dao.rows["tasks" to "t1"]!!.json.contains("Second"))
    }

    @Test
    fun oneRefusedTableDoesNotStopTheOthersAndIsReported() = runBlocking {
        failing += "habits"
        serverRows["tasks"] = """[{"id":"t1","title":"From the server"}]"""
        engine.run()
        assertNotNull(dao.rows["tasks" to "t1"])
        assertTrue(engine.state.value.error!!.contains("habits"))
        assertFalse(engine.state.value.offline)
    }

    @Test
    fun offlineKeepsEverythingAndSaysSo() = runBlocking {
        dao.upsert(dirty("tasks", "t1", """{"id":"t1","title":"Offline"}"""))
        server.shutdown()
        assertFalse(engine.run())
        assertTrue(engine.state.value.offline)
        assertTrue(dao.rows["tasks" to "t1"]!!.dirty)
    }

    @Test
    fun pagesThroughLargeTables() = runBlocking {
        val first = (1..1000).joinToString(",", "[", "]") { """{"id":"a$it","amount":-1,"account_id":"c","date":"2026-10-01"}""" }
        var calls = 0
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                val url = request.requestUrl!!
                if (url.pathSegments.last() != "transactions") return MockResponse().setBody("[]")
                calls++
                return MockResponse().setBody(if (url.queryParameter("offset") == "0") first else """[{"id":"last","amount":-1,"account_id":"c","date":"2026-10-02"}]""")
            }
        }
        engine.run()
        assertEquals(2, calls)
        assertEquals(1001, dao.rows.keys.count { it.first == "transactions" })
    }
}

class TokenProviderTest {
    private val server = MockWebServer()

    @Before fun start() = server.start()
    @After fun stop() = server.shutdown()

    private fun provider(session: FakeSession) = TokenProvider(session, retrofit(server).create(AuthApi::class.java))

    @Test
    fun aValidTokenIsUsedWithoutAsking() {
        val session = FakeSession(signedIn())
        assertEquals("access", provider(session).token())
        assertEquals(0, server.requestCount)
    }

    @Test
    fun anExpiringTokenIsRefreshedAndKept() {
        val session = FakeSession(signedIn().copy(expiresAt = 0))
        server.enqueue(MockResponse().setBody("""{"access_token":"new","refresh_token":"r2","expires_in":3600,"user":{"id":"user-1","email":"a@b.c"}}"""))
        assertEquals("new", provider(session).token())
        assertEquals("r2", session.session!!.refreshToken)
        assertTrue(server.takeRequest().path!!.contains("grant_type=refresh_token"))
    }

    @Test
    fun aRefusedRefreshSignsOut() {
        val session = FakeSession(signedIn().copy(expiresAt = 0))
        server.enqueue(MockResponse().setResponseCode(400).setBody("""{"error":"invalid_grant"}"""))
        assertNull(provider(session).token())
        assertTrue(session.cleared)
    }

    @Test
    fun noConnectionDoesNotSignOut() {
        val session = FakeSession(signedIn().copy(expiresAt = 0))
        server.shutdown()
        runCatching { provider(session).token() }
        assertFalse(session.cleared)
        assertNotNull(session.session)
    }

    @Test
    fun a401IsRetriedOnceWithARefreshedToken() {
        val session = FakeSession(signedIn())
        server.enqueue(MockResponse().setBody("""{"access_token":"after-401","refresh_token":"r3","expires_in":3600,"user":{"id":"user-1"}}"""))
        assertEquals("after-401", provider(session).token(rejected = "access"))
        // A second caller holding the old token gets the new one without another refresh.
        assertEquals("after-401", provider(session).token(rejected = "access"))
        assertEquals(1, server.requestCount)
    }
}
