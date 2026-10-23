package app.lifeos.kt.core.network

import app.lifeos.kt.core.model.Task
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SessionCallbackTest {
    @Test
    fun readsTheSessionHandedBackAfterGoogleSignIn() {
        val payload = java.util.Base64.getUrlEncoder().withoutPadding()
            .encodeToString("""{"sub":"user-1","email":"a@b.c","exp":2000000000}""".toByteArray())
        val session = sessionFromCallbackFragment("access_token=h.$payload.s&refresh_token=r1&expires_in=3600&token_type=bearer")!!
        assertEquals("user-1", session.userId)
        assertEquals("a@b.c", session.email)
        assertEquals("r1", session.refreshToken)
    }

    @Test
    fun ignoresAnIncompleteHandBack() {
        assertNull(sessionFromCallbackFragment("error=access_denied"))
    }

    @Test
    fun readsServerRowsWithUnknownColumnsAndWritesNullsExplicitly() {
        val json = NetworkModule.json()
        val task = json.decodeFromString(Task.serializer(), """{"id":"t","title":"A","status":"todo","new_column":42,"due_date":null}""")
        assertEquals("A", task.title)
        val out = json.encodeToJsonElement(Task.serializer(), task).jsonObject
        // A cleared field must reach the server as null, not be left out.
        assertTrue(out.containsKey("due_date"))
        assertEquals("null", out["due_date"].toString())
    }

}
