package app.lifeos.kt.data

import java.time.LocalDate
import java.time.ZoneOffset
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class TaskGroupsTest {
    private val today = LocalDate.parse("2026-10-23")

    private fun task(title: String, due: String? = null, status: String = "todo", completedAt: String? = null, parent: String? = null, time: String? = null) =
        TaskEntity(title, title, null, status, "medium", due, time, parent, completedAt, "2026-10-23T00:00:00Z")

    @Test
    fun groupsInOrderAndSkipsStepsAndOldDone() {
        val groups = groupTasks(
            listOf(
                task("Later", "2026-10-30"),
                task("Late", "2026-10-20"),
                task("Now", "2026-10-23"),
                task("Whenever"),
                task("Step", "2026-10-23", parent = "x"),
                task("Done now", status = "completed", completedAt = "2026-10-23T06:00:00+00:00"),
                task("Done before", status = "completed", completedAt = "2026-10-01T06:00:00+00:00"),
                task("Dropped", "2026-10-23", status = "cancelled"),
            ),
            today,
            ZoneOffset.UTC,
        )
        assertEquals(
            listOf(
                TaskGroup.Late to listOf("Late"),
                TaskGroup.Today to listOf("Now"),
                TaskGroup.Upcoming to listOf("Later"),
                TaskGroup.NoDate to listOf("Whenever"),
                TaskGroup.DoneToday to listOf("Done now"),
            ),
            groups.map { (group, rows) -> group to rows.map { it.title } },
        )
    }

    @Test
    fun detailSaysHowLateOrWhen() {
        assertEquals("3 days late", dueDetail(task("a", "2026-10-20"), today))
        assertEquals("1 day late", dueDetail(task("a", "2026-10-22"), today))
        assertEquals("11:00", dueDetail(task("a", "2026-10-23", time = "11:00:00"), today))
        assertEquals("Today", dueDetail(task("a", "2026-10-23"), today))
        assertEquals("Tomorrow · 09:30", dueDetail(task("a", "2026-10-24", time = "09:30:00"), today))
        assertNull(dueDetail(task("a"), today))
    }

    @Test
    fun readsTheSessionHandedBackAfterGoogleSignIn() {
        // {"sub":"user-1","email":"a@b.c","exp":2000000000}
        val payload = java.util.Base64.getUrlEncoder().withoutPadding()
            .encodeToString("""{"sub":"user-1","email":"a@b.c","exp":2000000000}""".toByteArray())
        val session = SessionData.fromCallbackFragment("access_token=h.$payload.s&refresh_token=r1&expires_in=3600&token_type=bearer")!!
        assertEquals("user-1", session.userId)
        assertEquals("a@b.c", session.email)
        assertEquals("r1", session.refreshToken)
    }
}
