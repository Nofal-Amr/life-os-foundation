package app.lifeos.kt.data.logic

import app.lifeos.kt.core.model.Goal
import app.lifeos.kt.core.model.HabitLog
import app.lifeos.kt.core.model.Task
import java.time.LocalDate

// Ported from src/data/habitCategories.ts, plans.ts and LinkedProgress.

/* ------------------------------- habits ------------------------------- */

val HABIT_CATEGORIES = listOf(
    "health" to "Health", "money" to "Money", "work" to "Work", "spirit" to "Spirit",
    "home" to "Home", "mind" to "Mind", "people" to "People", "other" to "Other",
)

// Checked in this order, so "Water the plants" is Home before "water" is Health.
private val KEYWORDS = listOf(
    "spirit" to listOf("pray", "prayer", "salah", "salat", "quran", "qur'an", "adhkar", "azkar", "dhikr", "dua", "fast", "fasting", "sadaqa", "charity", "tahajjud", "sunnah"),
    "home" to listOf("plant", "plants", "clean", "tidy", "dishes", "laundry", "cook", "cooking", "vacuum", "bed making", "make the bed", "declutter", "groceries"),
    "money" to listOf("save", "saving", "savings", "budget", "spend", "spending", "invest", "expense", "expenses", "money", "no-spend", "bills"),
    "people" to listOf("call", "family", "friend", "friends", "mom", "mum", "dad", "parents", "grandma", "grandpa", "visit", "kids", "wife", "husband"),
    "mind" to listOf("read", "reading", "book", "books", "journal", "journaling", "meditate", "meditation", "learn", "learning", "study", "language", "duolingo", "gratitude", "write", "writing", "course"),
    "work" to listOf("work", "code", "coding", "email", "emails", "inbox", "deep work", "focus", "plan the day", "plan my day", "portfolio", "project", "client", "clients"),
    "health" to listOf("walk", "walking", "run", "running", "gym", "workout", "exercise", "stretch", "stretching", "yoga", "water", "drink", "sleep", "bed", "steps", "vitamin", "vitamins", "medicine", "meds", "swim", "cycle", "cycling", "bike", "diet", "fruit", "vegetables", "protein", "weight", "push-ups", "pushups", "sugar"),
)

/** A best guess from the habit's name; "other" when nothing matches. Only ever a suggestion. */
fun guessHabitCategory(name: String): String {
    val text = name.lowercase()
    for ((category, words) in KEYWORDS) {
        if (words.any { Regex("(^|[^a-z])${Regex.escape(it)}([^a-z]|$)").containsMatchIn(text) }) return category
    }
    return "other"
}

/** The chosen category, or the guess while none is chosen. */
fun habitCategory(name: String, stored: String?): String = stored?.takeIf { s -> HABIT_CATEGORIES.any { it.first == s } } ?: guessHabitCategory(name)

/** The last [days] days of a habit, oldest first: whether each was logged. */
fun dayDots(logs: List<HabitLog>, habitId: String, today: LocalDate, days: Int = 14): List<Pair<LocalDate, Boolean>> {
    val logged = logs.filter { it.habitId == habitId }.map { it.logDate }.toSet()
    return (days - 1 downTo 0).map { back -> today.minusDays(back.toLong()).let { it to (it.toString() in logged) } }
}

/* --------------------------- linked progress --------------------------- */

/** A real done-of-total; nothing is drawn without a total. */
data class Count(val done: Int, val total: Int)

/** A project's own top-level tasks (cancelled ones don't count). */
fun projectProgress(tasks: List<Task>, projectId: String): Count {
    val own = tasks.filter { it.projectId == projectId && it.parentTaskId == null && it.status != "cancelled" }
    return Count(own.count { it.status == "completed" }, own.size)
}

/** Tasks linked to a goal (cancelled ones don't count). */
fun goalProgress(tasks: List<Task>, goalId: String): Count {
    val own = tasks.filter { it.goalId == goalId && it.parentTaskId == null && it.status != "cancelled" }
    return Count(own.count { it.status == "completed" }, own.size)
}

/** Goals reached through a project: the goal itself, or the goals of its tasks. */
fun projectGoals(tasks: List<Task>, goals: List<Goal>, projectId: String): List<Goal> {
    val viaTasks = tasks.filter { it.projectId == projectId }.mapNotNull { it.goalId }.toSet()
    return goals.filter { it.projectId == projectId || it.id in viaTasks }
}

val PROJECT_STATUSES = listOf("planning" to "Planning", "active" to "Active", "on_hold" to "On hold", "completed" to "Completed", "archived" to "Archived")
val GOAL_STATUSES = listOf("not_started" to "Not started", "active" to "Active", "completed" to "Completed", "archived" to "Archived")

/* -------------------------------- plans -------------------------------- */

/** A ready-made plan: a project with its tasks spread over the days from today. Starting one only creates ordinary tasks. */
data class Plan(val id: String, val name: String, val summary: String, val days: Int, val icon: String, val steps: List<Pair<Int, String>>)

private fun repeatSteps(from: Int, to: Int, every: Int, title: (Int) -> String): List<Pair<Int, String>> {
    val out = mutableListOf<Pair<Int, String>>()
    var day = from
    var n = 1
    while (day <= to) { out += day to title(n); day += every; n++ }
    return out
}

val PLANS: List<Plan> = listOf(
    Plan(
        "fit-30", "Get moving in 30 days", "Walks that grow, three short workouts a week, and a check at the end.", 30, "dumbbell",
        listOf(0 to "Note how you feel and your weight today") +
            repeatSteps(0, 29, 2) { n -> "Walk ${10 + minOf(n, 10) * 2} minutes" } +
            repeatSteps(1, 29, 3) { n -> "Short workout #$n (15 min)" } +
            listOf(29 to "Look back: what got easier?"),
    ),
    Plan(
        "language-60", "Language basics in 60 days", "15 minutes a day, a weekly review, and a short conversation at the end.", 60, "globe",
        listOf(0 to "Pick the app or book, and the 15-minute slot") +
            repeatSteps(0, 59, 1) { n -> "15 minutes practice (session $n)" }.filterIndexed { i, _ -> i % 7 != 6 } +
            repeatSteps(6, 59, 7) { n -> "Weekly review #$n: words and phrases" } +
            listOf(59 to "Have a 5-minute conversation"),
    ),
    Plan(
        "declutter-7", "Declutter the home in 7 days", "One area a day, with a bag to give away at the end.", 7, "home",
        listOf(
            0 to "Clear the entrance and shoes", 1 to "Clear the kitchen counters", 2 to "One wardrobe: give away what you didn't wear in a year",
            3 to "Bathroom cabinet: throw out expired things", 4 to "Papers: file or bin", 5 to "Desk and cables", 6 to "Drop off the give-away bag",
        ),
    ),
    Plan(
        "exam-14", "Exam prep in 14 days", "Topics split over the days, practice papers, and a rest day before.", 14, "graduation-cap",
        listOf(0 to "List every topic and what's weakest") +
            repeatSteps(1, 9, 1) { n -> "Study topic block $n (2 × 45 min)" } +
            listOf(10 to "Practice paper 1, timed", 11 to "Go over mistakes from paper 1", 12 to "Practice paper 2, timed", 13 to "Light review only, sleep early"),
    ),
    Plan(
        "ramadan", "Get ready for Ramadan (2 weeks)", "Shift sleep, ease into fasting, plan Quran and give early.", 14, "moon",
        listOf(
            0 to "Set a Quran plan (how many pages a day)", 1 to "Make up any missed fasts", 3 to "Fast a voluntary day (Monday or Thursday)",
            5 to "Move bedtime 30 minutes earlier", 7 to "Plan suhoor and iftar shopping", 9 to "Fast a voluntary day",
            11 to "Decide your sadaqah and give part now", 13 to "Clean and prepare the prayer space",
        ),
    ),
    Plan(
        "book-month", "Read a book in a month", "Pick it, then a little every day with a weekly check.", 30, "book-open",
        listOf(0 to "Choose the book and where you'll read") +
            repeatSteps(1, 28, 1) { n -> "Read 20 pages (day $n)" }.filterIndexed { i, _ -> i % 7 != 6 } +
            repeatSteps(7, 28, 7) { n -> "Week $n: write 3 lines on what stuck" } +
            listOf(29 to "Finish and note the one idea to keep"),
    ),
)

/** The dated tasks a plan creates from [start], in day order. */
fun planTasks(plan: Plan, start: LocalDate): List<Pair<String, String>> =
    plan.steps.sortedBy { it.first }.map { (day, title) -> title to start.plusDays(day.toLong()).toString() }
