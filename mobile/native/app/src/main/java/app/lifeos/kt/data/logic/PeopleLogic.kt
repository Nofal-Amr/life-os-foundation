package app.lifeos.kt.data.logic

import app.lifeos.kt.core.model.Person
import app.lifeos.kt.core.model.PersonInteraction
import app.lifeos.kt.core.model.RelationshipRule
import java.time.LocalDate
import java.time.temporal.ChronoUnit

/*
 * Relationships, ported from the website (src/data/relationships.ts): the
 * reminder rules, the check-in rhythm and birthdays. Nothing is scored;
 * "last contact" is only ever what was logged.
 */

data class Choice(val value: String, val label: String, val plural: String = label)

val CIRCLES = listOf(
    Choice("closest", "Closest", "closest people"), Choice("family", "Family", "family"), Choice("relatives", "Relatives", "relatives"),
    Choice("friends", "Friends", "friends"), Choice("work", "Work", "work people"),
)

val RELATIONS = listOf(
    Choice("father", "Father", "father"), Choice("mother", "Mother", "mother"), Choice("parent", "Parent", "parents"),
    Choice("sibling", "Sibling", "siblings"), Choice("spouse", "Spouse", "spouse"), Choice("child", "Child", "children"),
    Choice("grandparent", "Grandparent", "grandparents"), Choice("uncle_aunt", "Uncle or aunt", "uncles and aunts"),
    Choice("cousin", "Cousin", "cousins"), Choice("nephew_niece", "Nephew or niece", "nephews and nieces"),
    Choice("relative", "Relative", "relatives"), Choice("friend", "Friend", "friends"), Choice("colleague", "Colleague", "colleagues"),
    Choice("other", "Other", "others"),
)

/** value, label ("Called"), and the noun for "Last call 3 days ago". */
val INTERACTION_KINDS = listOf(
    Triple("call", "Called", "call"), Triple("message", "Messaged", "message"), Triple("visit", "Visited", "visit"),
    Triple("met", "Met", "meeting"), Triple("note", "Note", "note"),
)

val CADENCES: List<Pair<Int?, String>> = listOf(null to "No check-ins", 3 to "Every 3 days", 7 to "Every week", 14 to "Every 2 weeks", 30 to "Every month", 90 to "Every 3 months")

fun cadenceLabel(days: Int?): String = if (days == null || days < 1) "No check-ins" else CADENCES.firstOrNull { it.first == days }?.second ?: "Every $days days"
fun relationLabel(value: String) = if (value == "me") "Me" else RELATIONS.firstOrNull { it.value == value }?.label ?: value
fun circleLabel(value: String) = if (value == "me") "Me" else CIRCLES.firstOrNull { it.value == value }?.label ?: value

/** "12 days ago", "yesterday", "today". */
fun daysAgo(days: Long): String = when {
    days <= 0 -> "today"
    days == 1L -> "yesterday"
    else -> "$days days ago"
}

/* ---------------------------------- rules ---------------------------------- */

private val SPECIFICITY = mapOf("everyone" to 0, "circle" to 1, "relation" to 2, "person" to 3)

fun ruleApplies(rule: RelationshipRule, person: Person, topic: String): Boolean {
    if (rule.topic != "both" && rule.topic != topic) return false
    if (person.id in rule.exceptPersonIds) return false
    return when (rule.scopeType) {
        "everyone" -> true
        "circle" -> person.circle == rule.scopeValue
        "relation" -> person.relation == rule.scopeValue
        else -> person.id == rule.scopeValue
    }
}

/** The rule that decides: the most specific that applies (person, relation, circle, everyone); a tie goes to the newest. */
fun decidingRule(rules: List<RelationshipRule>, person: Person, topic: String): RelationshipRule? {
    var best: RelationshipRule? = null
    for (rule in rules) {
        if (!ruleApplies(rule, person, topic)) continue
        val b = best
        val mine = SPECIFICITY[rule.scopeType] ?: 0
        val theirs = b?.let { SPECIFICITY[it.scopeType] ?: 0 } ?: -1
        if (b == null || mine > theirs || (mine == theirs && (rule.createdAt ?: "") > (b.createdAt ?: ""))) best = rule
    }
    return best
}

/** No rule means remind. */
fun wantsReminder(rules: List<RelationshipRule>, person: Person, topic: String) = (decidingRule(rules, person, topic)?.action ?: "remind") == "remind"

private fun joinNames(names: List<String>) = if (names.size <= 1) names.joinToString("") else names.dropLast(1).joinToString(", ") + " and " + names.last()

/** "Don't remind me of birthdays for cousins, except Sara." */
fun describeRule(rule: RelationshipRule, people: List<Person>): String {
    val what = when (rule.topic) { "birthday" -> "birthdays"; "checkin" -> "check-ins"; else -> "birthdays or check-ins" }
    val who = when (rule.scopeType) {
        "everyone" -> "anyone"
        "circle" -> CIRCLES.firstOrNull { it.value == rule.scopeValue }?.plural ?: rule.scopeValue
        "relation" -> RELATIONS.firstOrNull { it.value == rule.scopeValue }?.plural ?: rule.scopeValue
        else -> people.firstOrNull { it.id == rule.scopeValue }?.name ?: "someone removed"
    }
    val names = rule.exceptPersonIds.mapNotNull { id -> people.firstOrNull { it.id == id }?.name }
    val except = if (names.isNotEmpty()) ", except ${joinNames(names)}" else ""
    return "${if (rule.action == "quiet") "Don't remind me of" else "Remind me of"} $what for $who$except."
}

/* -------------------------------- birthdays -------------------------------- */

private fun isLeap(year: Int) = (year % 4 == 0 && year % 100 != 0) || year % 400 == 0

/** The next birthday on or after [today]; 29 Feb falls on 28 Feb in other years. */
fun nextBirthday(person: Person, today: LocalDate): LocalDate? {
    val month = person.birthdayMonth ?: return null
    val day = person.birthdayDay ?: return null
    for (year in listOf(today.year, today.year + 1)) {
        val real = if (month == 2 && day == 29 && !isLeap(year)) 28 else day
        val date = runCatching { LocalDate.of(year, month, real) }.getOrNull() ?: continue
        if (!date.isBefore(today)) return date
    }
    return null
}

fun daysUntilBirthday(person: Person, today: LocalDate): Long? = nextBirthday(person, today)?.let { ChronoUnit.DAYS.between(today, it) }

/** The age they turn on their next birthday, when the year is known. */
fun turningAge(person: Person, today: LocalDate): Int? {
    val next = nextBirthday(person, today) ?: return null
    return person.birthYear?.let { next.year - it }
}

/* --------------------------------- check-ins -------------------------------- */

/** The latest logged contact (a note isn't contact). */
fun lastContact(personId: String, interactions: List<PersonInteraction>): PersonInteraction? =
    interactions.filter { it.personId == personId && it.kind != "note" }.maxByOrNull { it.occurredOn }

data class CheckIn(val daysSince: Long, val nextOn: LocalDate, val due: Boolean, val last: PersonInteraction?)

fun checkInState(person: Person, interactions: List<PersonInteraction>, today: LocalDate): CheckIn? {
    val every = person.checkinEveryDays?.takeIf { it >= 1 } ?: return null
    val last = lastContact(person.id, interactions)
    val from = (last?.occurredOn ?: person.checkinSince ?: person.createdAt ?: today.toString()).take(10).let(LocalDate::parse)
    val next = from.plusDays(every.toLong())
    return CheckIn(maxOf(0, ChronoUnit.DAYS.between(from, today)), next, !next.isAfter(today), last)
}

/* ------------------------------ what shows today ----------------------------- */

const val BIRTHDAY_LEAD_DAYS = 3
const val MAX_CHECKINS_TODAY = 3

data class Nudge(val kind: String, val key: String, val person: Person, val title: String, val detail: String, val order: Long)

/** Birthdays in the next few days (all), then at most three check-ins, longest since contact first. Rules decide who's included. */
fun todaysNudges(people: List<Person>, interactions: List<PersonInteraction>, rules: List<RelationshipRule>, today: LocalDate, snoozed: (String) -> Boolean = { false }): List<Nudge> {
    val birthdays = mutableListOf<Nudge>()
    val checkins = mutableListOf<Nudge>()
    for (person in people) {
        if (person.isMe) continue
        val inDays = daysUntilBirthday(person, today)
        if (inDays != null && inDays <= BIRTHDAY_LEAD_DAYS && wantsReminder(rules, person, "birthday")) {
            val key = "birthday-${person.id}-${nextBirthday(person, today)}"
            if (!snoozed(key)) {
                val age = turningAge(person, today)
                birthdays += Nudge(
                    "birthday", key, person,
                    if (inDays == 0L) "${person.name}'s birthday is today" else "${person.name}'s birthday",
                    (if (inDays == 0L) "Today" else if (inDays == 1L) "Tomorrow" else "In $inDays days") + (age?.let { " · turns $it" } ?: ""),
                    inDays,
                )
            }
        }
        val state = checkInState(person, interactions, today)
        if (state?.due == true && wantsReminder(rules, person, "checkin")) {
            val key = "checkin-${person.id}"
            if (!snoozed(key)) {
                val past = state.last?.let { l -> INTERACTION_KINDS.firstOrNull { it.first == l.kind }?.third }
                checkins += Nudge(
                    "checkin", key, person, "Check in with ${person.name}",
                    if (past != null) "Last $past ${daysAgo(state.daysSince)}" else "No contact logged yet · ${cadenceLabel(person.checkinEveryDays).lowercase()}",
                    state.daysSince,
                )
            }
        }
    }
    return birthdays.sortedBy { it.order } + checkins.sortedByDescending { it.order }.take(MAX_CHECKINS_TODAY)
}
