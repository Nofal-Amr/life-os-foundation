package app.lifeos.kt.data.logic

import app.lifeos.kt.core.model.Person
import app.lifeos.kt.core.model.PersonInteraction
import app.lifeos.kt.core.model.RelationshipRule
import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** The website's relationship tests (src/data/relationships.test.ts), ported. */
class PeopleLogicTest {
    private fun person(id: String, name: String = id, relation: String = "friend", circle: String = "friends", month: Int? = null, day: Int? = null, every: Int? = null, year: Int? = null) =
        Person(id, name, relation = relation, circle = circle, birthdayMonth = month, birthdayDay = day, checkinEveryDays = every, birthYear = year, createdAt = "2026-10-01T10:00:00Z")
    private fun rule(scope: String = "everyone", value: String? = null, topic: String = "both", action: String = "remind", except: List<String> = emptyList(), created: String = "2026-11-01T00:00:00Z") =
        RelationshipRule(Math.random().toString(), scope, value, topic, action, except, created)
    private fun call(person: String, on: String, kind: String = "call") = PersonInteraction("$person-$on", person, kind, on)
    private fun d(text: String): LocalDate = LocalDate.parse(text)

    private val sara = person("sara", "Sara", "cousin", "relatives", 11, 14)
    private val mona = person("mona", "Mona", "cousin", "relatives", 11, 15)
    private val ahmed = person("ahmed", "Ahmed", "father", "closest", every = 3)
    private val noCousinBirthdays = rule("relation", "cousin", "birthday", "quiet", listOf("sara"))

    @Test fun rulesFollowTheWeb() {
        assertTrue(wantsReminder(emptyList(), mona, "birthday"))
        assertFalse(wantsReminder(listOf(noCousinBirthdays), mona, "birthday"))
        assertTrue(wantsReminder(listOf(noCousinBirthdays), sara, "birthday"))
        assertTrue(wantsReminder(listOf(noCousinBirthdays), mona.copy(checkinEveryDays = 7), "checkin"))
        assertTrue(wantsReminder(listOf(noCousinBirthdays, rule("person", "mona", "birthday", "remind", created = "2026-01-01T00:00:00Z")), mona, "birthday"))
        val quietRelatives = rule("circle", "relatives", action = "quiet")
        val remindCousins = rule("relation", "cousin", action = "remind")
        val quietAll = rule(action = "quiet")
        assertFalse(wantsReminder(listOf(quietAll), ahmed, "checkin"))
        assertTrue(wantsReminder(listOf(quietAll, quietRelatives, remindCousins), mona, "birthday"))
        assertFalse(wantsReminder(listOf(quietRelatives), mona, "birthday"))
        val older = rule("circle", "relatives", action = "quiet", created = "2026-01-01T00:00:00Z")
        val newer = rule("circle", "relatives", action = "remind", created = "2026-06-01T00:00:00Z")
        assertTrue(wantsReminder(listOf(older, newer), mona, "birthday"))
        assertTrue(wantsReminder(listOf(newer, older), mona, "birthday"))
        assertFalse(wantsReminder(listOf(quietAll, noCousinBirthdays), sara, "birthday"))
        assertEquals("Don't remind me of birthdays for cousins, except Sara.", describeRule(noCousinBirthdays, listOf(sara, mona)))
    }

    @Test fun birthdays() {
        assertEquals(d("2026-11-14"), nextBirthday(sara, d("2026-11-13")))
        assertEquals(d("2026-11-14"), nextBirthday(sara, d("2026-11-14")))
        assertEquals(d("2027-11-14"), nextBirthday(sara, d("2026-11-15")))
        assertNull(nextBirthday(person("x"), d("2026-11-13")))
        val leap = person("l", month = 2, day = 29)
        assertEquals(d("2027-02-28"), nextBirthday(leap, d("2026-11-13")))
        assertEquals(d("2028-02-29"), nextBirthday(leap, d("2027-03-01")))
        assertEquals(26, turningAge(sara.copy(birthYear = 2000), d("2026-11-13")))
        assertNull(turningAge(sara, d("2026-11-13")))
    }

    @Test fun checkIns() {
        val state = checkInState(ahmed, listOf(call("ahmed", "2026-11-01"), call("ahmed", "2026-10-20")), d("2026-11-13"))!!
        assertEquals(12L, state.daysSince)
        assertEquals(d("2026-11-04"), state.nextOn)
        assertTrue(state.due)
        assertFalse(checkInState(ahmed, listOf(call("ahmed", "2026-11-11")), d("2026-11-13"))!!.due)
        assertTrue(checkInState(ahmed, listOf(call("ahmed", "2026-11-10")), d("2026-11-13"))!!.due)
        assertNull(checkInState(sara, emptyList(), d("2026-11-13")))
        // A note isn't contact.
        assertNull(lastContact("ahmed", listOf(call("ahmed", "2026-11-12", "note"))))
    }

    @Test fun todayShowsBirthdaysThenAtMostThreeCheckIns() {
        val friends = (0..4).map { person("f$it", "F$it", every = 7) }
        val calls = friends.mapIndexed { i, f -> call(f.id, d("2026-10-10").plusDays(i * 3L).toString()) }
        val nudges = todaysNudges(listOf(sara) + friends, calls, emptyList(), d("2026-11-13"))
        assertEquals("birthday", nudges[0].kind)
        assertEquals("Tomorrow", nudges[0].detail)
        val checkins = nudges.filter { it.kind == "checkin" }
        assertEquals(listOf("f0", "f1", "f2"), checkins.map { it.person.id })
        assertEquals("Last call 34 days ago", checkins[0].detail)
    }
}
