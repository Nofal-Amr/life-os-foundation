package app.lifeos.kt.data.logic

import app.lifeos.kt.core.model.Food
import app.lifeos.kt.core.model.FoodLog
import app.lifeos.kt.core.model.HealthLog
import app.lifeos.kt.core.model.Medication
import app.lifeos.kt.core.model.MedicationLog
import java.time.LocalDate
import java.time.LocalTime
import kotlin.math.max
import kotlin.math.roundToInt

// The web app's Body rules (src/data/food.ts, health.ts, stats.ts): every
// figure is what was logged, added up; nothing is estimated or judged.

val MEALS = listOf("breakfast" to "Breakfast", "lunch" to "Lunch", "dinner" to "Dinner", "snack" to "Snack")

/** The meal that fits the time of day, so logging needs no extra tap. */
fun mealForTime(time: LocalTime = LocalTime.now()): String = when (time.hour) {
    in 4..10 -> "breakfast"
    in 11..15 -> "lunch"
    in 17..21 -> "dinner"
    else -> "snack"
}

data class Totals(val calories: Double, val protein: Double, val carbs: Double, val fat: Double)

fun dayTotals(logs: List<FoodLog>) = Totals(
    logs.sumOf { it.calories },
    logs.sumOf { it.proteinG ?: 0.0 },
    logs.sumOf { it.carbsG ?: 0.0 },
    logs.sumOf { it.fatG ?: 0.0 },
)

/** A library food as a log: its figures copied and scaled by servings. */
fun logFromFood(food: Food, servings: Double, date: String, meal: String?, id: String, createdAt: String) = FoodLog(
    id = id,
    foodId = food.id,
    createdAt = createdAt,
    logDate = date,
    name = food.name,
    meal = meal,
    calories = food.calories * servings,
    servings = servings,
    proteinG = food.proteinG?.times(servings),
    carbsG = food.carbsG?.times(servings),
    fatG = food.fatG?.times(servings),
)

/**
 * Recently and often logged foods, for one-tap chips. [logs] newest first;
 * foods had at [meal] count three times as much.
 */
fun suggestedFoods(foods: List<Food>, logs: List<FoodLog>, limit: Int = 8, meal: String? = null): List<Food> {
    val score = mutableMapOf<String, Double>()
    logs.forEachIndexed { index, log ->
        val id = log.foodId ?: return@forEachIndexed
        val recency = max(0, 200 - index) / 100.0
        val weight = if (meal != null && log.meal == meal) 3.0 else 1.0
        score.merge(id, (1 + recency) * weight, Double::plus)
    }
    return foods.sortedWith(compareByDescending<Food> { score[it.id] ?: 0.0 }.thenBy { it.name.lowercase() }).take(limit)
}

/** Typed-in entries (no library food) logged before, newest first, one per name. */
fun recentOneOffs(logs: List<FoodLog>, limit: Int = 6): List<FoodLog> {
    val seen = mutableSetOf<String>()
    return logs.sortedByDescending { it.createdAt ?: it.logDate }
        .filter { log ->
            val name = log.name?.trim()?.lowercase()
            log.foodId == null && !name.isNullOrEmpty() && seen.add(name)
        }
        .take(limit)
}

/** Scheduled doses on [date] and how many are marked taken; null when nothing is scheduled. */
fun dosesOn(medications: List<Medication>, logs: List<MedicationLog>, date: String): Pair<Int, Int>? {
    val scheduled = medications.filter { it.active }.flatMap { med -> med.scheduleTimes.orEmpty().distinct().map { "${med.id}|$it" } }
    if (scheduled.isEmpty()) return null
    val taken = logs.filter { it.logDate == date && it.taken }.map { "${it.medicationId}|${it.timeSlot}" }.toSet()
    return scheduled.count { it in taken } to scheduled.size
}

fun bmi(heightCm: Double?, weightKg: Double?): Double? {
    if (heightCm == null || weightKg == null || heightCm <= 0 || weightKg <= 0) return null
    val m = heightCm / 100
    return weightKg / (m * m)
}

/** "7h 30m", "45m"; "—" when unknown. */
fun formatDuration(minutes: Int?): String {
    if (minutes == null) return "—"
    if (minutes <= 0) return "0m"
    val h = minutes / 60
    val m = minutes % 60
    return when {
        h > 0 && m > 0 -> "${h}h ${m}m"
        h > 0 -> "${h}h"
        else -> "${m}m"
    }
}

/**
 * Sleep per night over the last [days] days, oldest first. Unlike the web's
 * series (which reads only the older sleep_hours field and so misses nights
 * entered as hours + minutes), this takes the precise minutes when present.
 */
fun sleepSeries(logs: List<HealthLog>, days: Int, today: LocalDate): List<Pair<LocalDate, Double>> {
    val from = today.minusDays((days - 1).toLong()).toString()
    val to = today.toString()
    return logs.filter { it.logDate in from..to && it.sleepMinutes != null }
        .map { LocalDate.parse(it.logDate) to it.sleepMinutes!! / 60.0 }
        .sortedBy { it.first }
}

fun sleepScoreSeries(logs: List<HealthLog>, days: Int, today: LocalDate): List<Pair<LocalDate, Double>> {
    val from = today.minusDays((days - 1).toLong()).toString()
    val to = today.toString()
    return logs.filter { it.logDate in from..to && it.sleepScore != null }
        .map { LocalDate.parse(it.logDate) to it.sleepScore!!.toDouble() }
        .sortedBy { it.first }
}

/** What 1 and 5 mean on each scale, in the web's words. */
val SCALE_ENDS = mapOf(
    "stress" to ("1 · calm" to "5 · very stressed"),
    "mood" to ("1 · low" to "5 · great"),
    "food" to ("1 · didn't eat well" to "5 · ate well"),
)

/** The web's scaleTone: high stress and low mood or food read as a warning, never a verdict. */
fun scaleTone(kind: String, value: Int): String = when (kind) {
    "stress" -> when { value >= 5 -> "danger"; value >= 4 -> "warning"; value <= 2 -> "positive"; else -> "neutral" }
    else -> when { value <= 1 -> "danger"; value <= 2 -> "warning"; value >= 4 -> "positive"; else -> "neutral" }
}

const val KG_PER_LB = 0.45359237

fun weightToDisplay(kg: Double?, imperial: Boolean): Double? = kg?.let { ((if (imperial) it / KG_PER_LB else it) * 10).roundToInt() / 10.0 }

fun weightToStored(value: Double?, imperial: Boolean): Double? = value?.let { if (imperial) it * KG_PER_LB else it }
