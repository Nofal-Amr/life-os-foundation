package app.lifeos.kt.data

import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZonedDateTime
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/**
 * Sample data for demo mode, ported from the website's src/data/demoSeed.ts
 * so both show the same believable month, dated around today. It stays on
 * the phone; demo mode never syncs.
 */
object DemoSeed {
    const val USER = "00000000-0000-4000-8000-00000000de30"

    private var counter = 0
    private fun id(prefix: String) = "${prefix.padEnd(8, '0').take(8)}-0000-4000-8000-${(++counter).toString().padStart(12, '0')}"

    private fun json(value: Any?): JsonElement = when (value) {
        null -> JsonNull
        is JsonElement -> value
        is String -> JsonPrimitive(value)
        is Number -> JsonPrimitive(value)
        is Boolean -> JsonPrimitive(value)
        is List<*> -> JsonArray(value.map(::json))
        is Map<*, *> -> JsonObject(value.entries.associate { (k, v) -> k.toString() to json(v) })
        else -> JsonPrimitive(value.toString())
    }

    fun seed(today: LocalDate = LocalDate.now(), zone: ZoneId = ZoneId.systemDefault()): Map<String, List<JsonObject>> {
        counter = 0
        val now = ZonedDateTime.now(zone)
        fun day(offset: Long) = today.plusDays(offset).toString()
        fun iso(offset: Long, time: String) = LocalDateTime.parse("${day(offset)}T$time:00").atZone(zone).toOffsetDateTime().toString()
        fun stamp(offset: Long = 0) = now.plusDays(offset).toOffsetDateTime().toString()
        fun base(vararg fields: Pair<String, Any?>): JsonObject =
            JsonObject(mapOf("user_id" to json(USER), "created_at" to json(stamp(-40)), "updated_at" to json(stamp(-1))) + fields.associate { it.first to json(it.second) })

        val work = id("project")
        val home = id("project")
        val fit = id("goal")

        val taskDefaults = mapOf(
            "status" to "todo", "priority" to "medium", "postponed_count" to 0, "description" to null, "due_date" to null, "due_time" to null,
            "energy" to null, "estimated_minutes" to null, "estimate_unit" to null, "project_id" to null, "goal_id" to null, "capability_id" to null,
            "parent_task_id" to null, "repeat" to null, "start_date" to null, "max_date" to null, "original_due_date" to null, "last_postponed_at" to null,
            "completed_at" to null,
        )
        val taskSpecs: List<Map<String, Any?>> = listOf(
            mapOf("title" to "Send the quarterly report to Ahmed", "due_date" to day(0), "due_time" to "11:00", "priority" to "high", "project_id" to work, "energy" to 2),
            mapOf("title" to "Renew car licence", "due_date" to day(2), "priority" to "medium", "project_id" to home),
            mapOf("title" to "Book dentist appointment", "due_date" to day(-3), "priority" to "medium", "energy" to 1),
            mapOf("title" to "Prepare slides for Sunday meeting", "due_date" to day(3), "due_time" to "09:00", "priority" to "high", "project_id" to work, "energy" to 3),
            mapOf("title" to "Call the electricity company about the meter", "status" to "inbox"),
            mapOf("title" to "Buy a birthday gift for Mona", "due_date" to day(5), "priority" to "low"),
            // A task that has waited over a month (the stuck-task helper picks it up).
            mapOf("title" to "Finish the kaitech proposal", "priority" to "high", "project_id" to work, "created_at" to stamp(-38), "updated_at" to stamp(-30), "postponed_count" to 3, "original_due_date" to day(-30), "due_date" to day(-6)),
            mapOf("title" to "Pay the internet bill", "status" to "completed", "completed_at" to stamp(-1), "due_date" to day(-1)),
            mapOf("title" to "Clean the desk", "status" to "completed", "completed_at" to stamp(0), "due_date" to day(0)),
        )
        val tasks = taskSpecs.mapIndexed { index, spec ->
            base(*(taskDefaults + mapOf("id" to id("task"), "position" to index) + spec).toList().toTypedArray())
        }.toMutableList()
        // Two small steps under the report.
        val report = tasks[0]
        fun step(vararg fields: Pair<String, Any?>) = JsonObject(report + fields.associate { it.first to json(it.second) })
        tasks += step("id" to id("task"), "title" to "Pull last quarter's numbers", "parent_task_id" to report["id"], "status" to "completed", "completed_at" to stamp(0), "due_time" to null, "position" to 0)
        tasks += step("id" to id("task"), "title" to "Write the summary paragraph", "parent_task_id" to report["id"], "due_time" to null, "position" to 1)

        val wallet = id("account")
        val bank = id("account")
        val food = id("categry")
        val transport = id("categry")
        val bills = id("categry")
        val salary = id("categry")
        val moves = mutableListOf<Map<String, Any?>>()
        for (back in 0 until 25) {
            if (back % 2 == 0) moves += mapOf("kind" to "expense", "amount" to 85 + (back * 37) % 140, "category_id" to food, "account_id" to wallet, "description" to if (back % 4 != 0) "Lunch" else "Groceries", "date" to day(-back.toLong()))
            if (back % 3 == 0) moves += mapOf("kind" to "expense", "amount" to 40 + (back * 13) % 60, "category_id" to transport, "account_id" to wallet, "description" to "Uber", "date" to day(-back.toLong()))
        }
        moves += mapOf("kind" to "income", "amount" to 9500, "category_id" to salary, "account_id" to bank, "description" to "Salary", "date" to day(-20))
        moves += mapOf("kind" to "expense", "amount" to 650, "category_id" to bills, "account_id" to bank, "description" to "Electricity", "date" to day(-12))
        // Stored like the app stores them: spending is negative.
        val transactions = moves.map { row ->
            val amount = (row["amount"] as Number).toDouble()
            base(*(mapOf("id" to id("txn"), "occurred_time" to null, "pocket_id" to null) + row + mapOf("amount" to if (row["kind"] == "expense") -amount else amount)).toList().toTypedArray())
        }

        val habits = listOf(
            Triple("Read 10 pages", "book-open", "chart-2"),
            Triple("Walk 30 minutes", "footprints", "chart-1"),
            Triple("No phone after 11pm", "moon", "chart-3"),
        ).map { (name, icon, color) -> base("id" to id("habit"), "active" to true, "frequency" to "daily", "target" to 1, "category" to null, "description" to null, "name" to name, "icon" to icon, "color" to color) }
        val habitLogs = mutableListOf<JsonObject>()
        habits.forEachIndexed { index, habit ->
            for (back in 0 until 20) if ((back + index) % (index + 2) != 0) habitLogs += base("id" to id("hlog"), "habit_id" to habit["id"], "log_date" to day(-back.toLong()))
        }

        val names = listOf("fajr", "dhuhr", "asr", "maghrib", "isha")
        val statuses = listOf("on_time", "jamaah", "on_time", "late", "on_time", "clutch", "on_time")
        val prayerLogs = mutableListOf<JsonObject>()
        for (back in 1 until 21) {
            names.forEachIndexed { index, name ->
                if ((back * 3 + index) % 11 == 0) return@forEachIndexed // a few not logged
                val status = statuses[(back + index) % statuses.size]
                prayerLogs += base("id" to id("prayer"), "prayer_date" to day(-back.toLong()), "prayer_name" to name, "status" to status, "completed" to true, "on_time" to (status != "late"))
            }
        }
        prayerLogs += base("id" to id("prayer"), "prayer_date" to day(0), "prayer_name" to "fajr", "status" to "on_time", "completed" to true, "on_time" to true)

        val healthLogs = (0 until 14).map { back ->
            base("id" to id("health"), "log_date" to day(-back.toLong()), "sleep_hours" to 6 + ((back * 7) % 25) / 10.0, "mood" to 3 + back % 3, "trained" to (back % 3 == 0), "water_ok" to (back % 2 == 0), "note" to null)
        }

        return mapOf(
            "user_preferences" to listOf(
                base(
                    "id" to id("prefs"), "onboarding_completed_at" to stamp(-40),
                    "enabled_modules" to listOf("do", "money", "body", "spirit", "habits", "notes", "calendar", "study", "food", "resources"),
                    "skin" to "serious", "currency" to "EGP", "date_format" to "d MMM yyyy", "time_format" to "12h", "unit_system" to "metric",
                    "week_start" to 6, "dimension_order" to null, "food_prefs" to null, "connect_key" to null,
                ),
            ),
            "profiles" to listOf(base("id" to id("profile"), "display_name" to "Demo", "avatar_url" to null)),
            "projects" to listOf(
                base("id" to work, "name" to "Work: Q4 report", "status" to "active", "priority" to "high", "icon" to "briefcase", "color" to "chart-1", "due_date" to day(10), "start_date" to day(-20), "description" to null, "image_url" to null),
                base("id" to home, "name" to "Home admin", "status" to "active", "priority" to "medium", "icon" to "home", "color" to "chart-2", "due_date" to null, "start_date" to null, "description" to null, "image_url" to null),
            ),
            "goals" to listOf(base("id" to fit, "name" to "Run 5 km without stopping", "status" to "active", "progress" to 40, "target_date" to day(45), "icon" to "footprints", "color" to "chart-3", "category" to "body", "description" to null, "image_url" to null, "project_id" to null)),
            "tasks" to tasks,
            "habits" to habits,
            "habit_logs" to habitLogs,
            "accounts" to listOf(
                base("id" to wallet, "name" to "Wallet", "type" to "cash", "opening_balance" to 2400, "active" to true, "counts_toward_spendable" to true, "currency" to "EGP", "icon" to "wallet", "color" to null),
                base("id" to bank, "name" to "Bank", "type" to "checking", "opening_balance" to 6200, "active" to true, "counts_toward_spendable" to true, "currency" to "EGP", "icon" to "landmark", "color" to null),
            ),
            "finance_categories" to listOf(
                base("id" to food, "name" to "Food", "kind" to "expense", "icon" to "utensils", "color" to "chart-2", "monthly_budget" to 3000),
                base("id" to transport, "name" to "Transport", "kind" to "expense", "icon" to "car", "color" to "chart-1", "monthly_budget" to 1200),
                base("id" to bills, "name" to "Bills", "kind" to "expense", "icon" to "receipt", "color" to "chart-4", "monthly_budget" to null),
                base("id" to salary, "name" to "Salary", "kind" to "income", "icon" to "banknote", "color" to "chart-3", "monthly_budget" to null),
            ),
            "transactions" to transactions,
            "recurring_costs" to listOf(
                base("id" to id("recur"), "name" to "Internet", "amount" to -450, "active" to true, "frequency" to "monthly", "interval_count" to 1, "interval_unit" to null, "next_due_date" to day(8), "next_due_at" to null, "account_id" to bank, "category_id" to bills),
                base("id" to id("recur"), "name" to "Gym", "amount" to -600, "active" to true, "frequency" to "monthly", "interval_count" to 1, "interval_unit" to null, "next_due_date" to day(4), "next_due_at" to null, "account_id" to bank, "category_id" to null),
            ),
            "payday_config" to listOf(base("id" to id("payday"), "schedule" to "monthly", "pay_day" to today.plusDays(10).dayOfMonth, "expected_net_amount" to 9500, "safety_buffer" to 500, "anchor_date" to null, "interval_weeks" to null)),
            "prayer_settings" to listOf(base("id" to id("pset"), "latitude" to 30.0444, "longitude" to 31.2357, "city" to "Cairo", "calc_method" to "Egyptian", "asr_school" to "shafi")),
            "prayer_logs" to prayerLogs,
            "health_logs" to healthLogs,
            "notes" to listOf(
                base("id" to id("note"), "title" to "Ideas for the weekend", "body" to "Visit the Grand Egyptian Museum\nTry the new koshary place\nCall grandma", "tags" to listOf("Ideas"), "pinned" to true, "archived" to false, "color" to null, "checklist" to null),
                base("id" to id("note"), "title" to "Meeting: budget review", "body" to "Who: Ahmed, Sara\n\nWhat was decided: cut travel by 10%\n\nWhat I have to do: update the sheet by Thursday", "tags" to listOf("Meeting"), "pinned" to false, "archived" to false, "color" to "blue", "checklist" to null),
                base("id" to id("note"), "title" to "Groceries", "body" to null, "tags" to listOf("Lists"), "pinned" to false, "archived" to false, "color" to null, "checklist" to listOf(mapOf("id" to "a", "text" to "Milk", "done" to true), mapOf("id" to "b", "text" to "Eggs", "done" to false), mapOf("id" to "c", "text" to "Bread", "done" to false))),
            ),
            "events" to listOf(
                base("id" to id("event"), "title" to "Team stand-up", "description" to null, "start_at" to iso(0, "10:00"), "end_at" to iso(0, "10:30")),
                base("id" to id("event"), "title" to "Lunch with Omar", "description" to "Zamalek", "start_at" to iso(1, "14:00"), "end_at" to iso(1, "15:30")),
                base("id" to id("event"), "title" to "Gym", "description" to null, "start_at" to iso(2, "19:00"), "end_at" to iso(2, "20:00")),
                base("id" to id("event"), "title" to "Client call", "description" to null, "start_at" to iso(0, "15:00"), "end_at" to iso(0, "16:00")),
                base("id" to id("event"), "title" to "Mona's birthday", "description" to null, "start_at" to iso(5, "00:00"), "end_at" to null),
            ),
            "daily_reviews" to listOf(base("id" to id("review"), "review_date" to day(0), "energy" to 3, "mood" to 4, "wins" to null, "challenges" to null, "gratitude" to null, "tomorrow_focus" to null)),
        )
    }
}
