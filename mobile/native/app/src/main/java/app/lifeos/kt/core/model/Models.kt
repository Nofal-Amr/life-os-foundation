package app.lifeos.kt.core.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/*
 * One class per Supabase table, as the web app's generated types describe them
 * (src/integrations/supabase/types.ts). Unknown columns are ignored when
 * reading and kept when saving (see LocalStore), so the server can grow
 * without breaking the app. Columns the server requires have non-null defaults.
 */

/** Every synced row has an id. */
interface Row {
    val id: String
}

@Serializable
data class Task(
    override val id: String,
    val title: String,
    val description: String? = null,
    val status: String = "inbox",
    val priority: String = "medium",
    @SerialName("due_date") val dueDate: String? = null,
    @SerialName("due_time") val dueTime: String? = null,
    @SerialName("start_date") val startDate: String? = null,
    @SerialName("max_date") val maxDate: String? = null,
    @SerialName("parent_task_id") val parentTaskId: String? = null,
    @SerialName("project_id") val projectId: String? = null,
    @SerialName("goal_id") val goalId: String? = null,
    @SerialName("capability_id") val capabilityId: String? = null,
    @SerialName("estimated_minutes") val estimatedMinutes: Int? = null,
    @SerialName("estimate_unit") val estimateUnit: String? = null,
    val energy: Int? = null,
    val repeat: String? = null,
    val position: Int = 0,
    @SerialName("postponed_count") val postponedCount: Int = 0,
    @SerialName("last_postponed_at") val lastPostponedAt: String? = null,
    @SerialName("original_due_date") val originalDueDate: String? = null,
    @SerialName("completed_at") val completedAt: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null,
) : Row

@Serializable
data class Account(
    override val id: String,
    val name: String,
    val type: String = "checking",
    @SerialName("opening_balance") val openingBalance: Double = 0.0,
    val currency: String? = null,
    val active: Boolean = true,
    val icon: String? = null,
    val color: String? = null,
    @SerialName("counts_toward_spendable") val countsTowardSpendable: Boolean = true,
) : Row

@Serializable
data class Transaction(
    override val id: String,
    @SerialName("account_id") val accountId: String,
    /** Signed: expenses are negative, as the web app stores them. */
    val amount: Double,
    val kind: String = "expense",
    @SerialName("category_id") val categoryId: String? = null,
    @SerialName("pocket_id") val pocketId: String? = null,
    val date: String,
    @SerialName("occurred_time") val occurredTime: String? = null,
    val description: String? = null,
) : Row

@Serializable
data class FinanceCategory(
    override val id: String,
    val name: String,
    val kind: String = "expense",
    val icon: String? = null,
    val color: String? = null,
    @SerialName("monthly_budget") val monthlyBudget: Double? = null,
) : Row

@Serializable
data class PrayerLog(
    override val id: String,
    @SerialName("prayer_date") val prayerDate: String,
    @SerialName("prayer_name") val prayerName: String,
    val status: String? = null,
    val completed: Boolean = true,
    @SerialName("on_time") val onTime: Boolean? = null,
) : Row

@Serializable
data class PrayerSettings(
    override val id: String,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val city: String? = null,
    @SerialName("calc_method") val calcMethod: String? = null,
    @SerialName("asr_school") val asrSchool: String? = null,
) : Row

@Serializable
data class HealthLog(
    override val id: String,
    @SerialName("log_date") val logDate: String,
    @SerialName("sleep_hours") val sleepHours: Double? = null,
    val mood: Int? = null,
    @SerialName("water_ok") val waterOk: Boolean? = null,
    val trained: Boolean? = null,
    val note: String? = null,
    @SerialName("stress_level") val stressLevel: Int? = null,
    @SerialName("sleep_score") val sleepScore: Int? = null,
    @SerialName("heart_rate_avg") val heartRateAvg: Double? = null,
) : Row

@Serializable
data class Medication(
    override val id: String,
    val name: String,
    val dosage: String? = null,
    val notes: String? = null,
    val active: Boolean = true,
    @SerialName("schedule_times") val scheduleTimes: List<String>? = null,
) : Row

@Serializable
data class Habit(
    override val id: String,
    val name: String,
    val description: String? = null,
    val frequency: String = "daily",
    val target: Int = 1,
    val active: Boolean = true,
    val category: String? = null,
    val icon: String? = null,
    val color: String? = null,
) : Row

@Serializable
data class HabitLog(
    override val id: String,
    @SerialName("habit_id") val habitId: String,
    @SerialName("log_date") val logDate: String,
) : Row

@Serializable
data class Note(
    override val id: String,
    val title: String = "",
    val body: String? = null,
    val pinned: Boolean = false,
    val archived: Boolean = false,
    val color: String? = null,
    val tags: List<String> = emptyList(),
    /** When set, the note is a checklist and body is unused (as on the web). */
    val checklist: List<ChecklistItem>? = null,
    @SerialName("updated_at") val updatedAt: String? = null,
) : Row

@Serializable
data class Reminder(
    override val id: String,
    val title: String,
    val note: String? = null,
    @SerialName("remind_at") val remindAt: String,
    val repeat: String = "none",
    @SerialName("done_at") val doneAt: String? = null,
) : Row

@Serializable
data class CalendarEvent(
    override val id: String,
    val title: String,
    val description: String? = null,
    @SerialName("start_at") val startAt: String,
    @SerialName("end_at") val endAt: String? = null,
) : Row

@Serializable
data class Project(
    override val id: String,
    val name: String,
    val description: String? = null,
    val status: String = "active",
    val priority: String = "medium",
    @SerialName("due_date") val dueDate: String? = null,
    @SerialName("start_date") val startDate: String? = null,
    val icon: String? = null,
    val color: String? = null,
    @SerialName("image_url") val imageUrl: String? = null,
) : Row

@Serializable
data class Goal(
    override val id: String,
    val name: String,
    val description: String? = null,
    val status: String = "active",
    val progress: Double = 0.0,
    @SerialName("project_id") val projectId: String? = null,
    @SerialName("target_date") val targetDate: String? = null,
    val icon: String? = null,
    val color: String? = null,
    val category: String? = null,
) : Row

@Serializable
data class UserPreferences(
    override val id: String,
    val currency: String? = null,
    val skin: String = "serious",
    @SerialName("time_format") val timeFormat: String = "24h",
    @SerialName("week_start") val weekStart: Int = 1,
    @SerialName("enabled_modules") val enabledModules: List<String> = emptyList(),
    @SerialName("dimension_order") val dimensionOrder: List<String>? = null,
) : Row

@Serializable
data class ChecklistItem(val id: String, val text: String, val done: Boolean = false)

@Serializable
data class RecurringCost(
    override val id: String,
    val name: String,
    /** Signed like transactions: what leaves the account is negative. */
    val amount: Double,
    val active: Boolean = true,
    val frequency: String = "monthly",
    @SerialName("interval_count") val intervalCount: Int = 1,
    @SerialName("interval_unit") val intervalUnit: String? = null,
    @SerialName("next_due_date") val nextDueDate: String,
    @SerialName("account_id") val accountId: String? = null,
    @SerialName("category_id") val categoryId: String? = null,
) : Row

@Serializable
data class AccountPocket(
    override val id: String,
    @SerialName("account_id") val accountId: String,
    val name: String,
    val kind: String = "cash",
    @SerialName("opening_balance") val openingBalance: Double = 0.0,
) : Row

@Serializable
data class PaydayConfig(
    override val id: String,
    val schedule: String = "monthly",
    @SerialName("pay_day") val payDay: Int? = null,
    @SerialName("anchor_date") val anchorDate: String? = null,
    @SerialName("interval_weeks") val intervalWeeks: Int? = null,
    @SerialName("safety_buffer") val safetyBuffer: Double? = null,
    @SerialName("expected_net_amount") val expectedNetAmount: Double? = null,
) : Row

@Serializable
data class MedicationLog(
    override val id: String,
    @SerialName("medication_id") val medicationId: String,
    @SerialName("log_date") val logDate: String,
    @SerialName("time_slot") val timeSlot: String,
    val taken: Boolean = true,
) : Row

@Serializable
data class FoodLog(
    override val id: String,
    @SerialName("log_date") val logDate: String,
    val name: String? = null,
    val meal: String? = null,
    /** Already multiplied by servings, as the web app stores it. */
    val calories: Double = 0.0,
    val servings: Double = 1.0,
    @SerialName("protein_g") val proteinG: Double? = null,
    @SerialName("carbs_g") val carbsG: Double? = null,
    @SerialName("fat_g") val fatG: Double? = null,
) : Row

@Serializable
data class DailyReview(
    override val id: String,
    @SerialName("review_date") val reviewDate: String,
    val mood: Int? = null,
    val energy: Int? = null,
    val wins: String? = null,
    val challenges: String? = null,
    val gratitude: String? = null,
    @SerialName("tomorrow_focus") val tomorrowFocus: String? = null,
) : Row

@Serializable
data class Profile(
    override val id: String,
    @SerialName("display_name") val displayName: String? = null,
) : Row

@Serializable
data class TimeEntry(
    override val id: String,
    @SerialName("started_at") val startedAt: String,
    @SerialName("ended_at") val endedAt: String? = null,
    @SerialName("task_id") val taskId: String? = null,
    @SerialName("activity_id") val activityId: String? = null,
    val label: String? = null,
    val note: String? = null,
) : Row

@Serializable
data class Capability(
    override val id: String,
    val name: String,
    val description: String? = null,
    val icon: String? = null,
    val color: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
) : Row

/** Append-only: one row per finished task, linking it to what it built. */
@Serializable
data class Evidence(
    override val id: String,
    @SerialName("task_id") val taskId: String? = null,
    @SerialName("capability_id") val capabilityId: String? = null,
    @SerialName("project_id") val projectId: String? = null,
    @SerialName("goal_id") val goalId: String? = null,
    val note: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
) : Row
