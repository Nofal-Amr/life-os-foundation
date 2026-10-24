package app.lifeos.kt.feature.body

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.lifeos.kt.core.common.nowIso
import app.lifeos.kt.core.model.BodyStats
import app.lifeos.kt.core.model.Food
import app.lifeos.kt.core.model.FoodLog
import app.lifeos.kt.core.model.Habit
import app.lifeos.kt.core.model.HabitLog
import app.lifeos.kt.core.model.HealthLog
import app.lifeos.kt.core.model.Medication
import app.lifeos.kt.core.model.MedicationLog
import app.lifeos.kt.core.model.UserPreferences
import app.lifeos.kt.data.BodyRepository
import app.lifeos.kt.data.PlanRepository
import app.lifeos.kt.data.PreferencesRepository
import app.lifeos.kt.data.TodayRepository
import app.lifeos.kt.data.logic.LibraryFood
import app.lifeos.kt.data.logic.logFromFood
import app.lifeos.kt.data.newId
import dagger.hilt.android.lifecycle.HiltViewModel
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/** The usual foods per meal and the cuisines chosen, as the web stores them in food_prefs. */
data class FoodPrefs(val cuisines: List<String>, val meals: Map<String, List<String>>)

fun readFoodPrefs(value: JsonObject?): FoodPrefs? {
    if (value == null) return null
    val cuisines = runCatching { value["cuisines"]!!.jsonArray.map { it.jsonPrimitive.content } }.getOrDefault(emptyList())
    val meals = runCatching { value["meals"]!!.jsonObject.mapValues { (_, v) -> v.jsonArray.map { it.jsonPrimitive.content } } }.getOrDefault(emptyMap())
    return FoodPrefs(cuisines, meals)
}

fun FoodPrefs.toJson() = JsonObject(
    mapOf(
        "cuisines" to JsonArray(cuisines.map(::JsonPrimitive)),
        "meals" to JsonObject(meals.mapValues { (_, list) -> JsonArray(list.map(::JsonPrimitive)) }),
    ),
)

data class BodyState(
    val date: LocalDate,
    val today: LocalDate,
    val imperial: Boolean,
    val twelveHour: Boolean,
    val prefs: UserPreferences?,
    val habits: List<Habit>,
    val habitLogs: List<HabitLog>,
    /** Newest first. */
    val logs: List<HealthLog>,
    val medications: List<Medication>,
    val medicationLogs: List<MedicationLog>,
    val foods: List<Food>,
    /** Newest first, as the web orders them for suggestions. */
    val foodLogs: List<FoodLog>,
    val stats: BodyStats?,
) {
    val iso: String get() = date.toString()
    val log: HealthLog? get() = logs.firstOrNull { it.logDate == iso }
    val healthHabits: List<Habit> get() = habits.filter { it.active && it.category == "health" }
    val dayFood: List<FoodLog> get() = foodLogs.filter { it.logDate == iso }.sortedBy { it.createdAt ?: "" }
    val foodPrefs: FoodPrefs? get() = readFoodPrefs(prefs?.foodPrefs)
    fun slot(time: String): String = runCatching {
        LocalTime.parse(time).format(DateTimeFormatter.ofPattern(if (twelveHour) "h:mm a" else "HH:mm", Locale.getDefault()))
    }.getOrDefault(time)
    fun taken(medication: Medication, slot: String) = medicationLogs.any { it.medicationId == medication.id && it.logDate == iso && it.timeSlot == slot && it.taken }
}

private data class Health(val logs: List<HealthLog>, val meds: List<Medication>, val medLogs: List<MedicationLog>, val foods: List<Food>, val foodLogs: List<FoodLog>)

@HiltViewModel
class BodyViewModel @Inject constructor(
    private val body: BodyRepository,
    private val today: TodayRepository,
    private val plan: PlanRepository,
    private val prefs: PreferencesRepository,
) : ViewModel() {
    private val date = MutableStateFlow(LocalDate.now())
    private val health: Flow<Health> = combine(body.healthLogs, body.medications, today.medicationLogs, body.foods, today.foodLogs) { l, m, ml, f, fl -> Health(l, m, ml, f, fl) }

    val state: StateFlow<BodyState?> = combine(date, health, combine(plan.habits, plan.habitLogs) { h, l -> h to l }, body.bodyStats, prefs.preferences) { d, h, (habits, habitLogs), stats, p ->
        BodyState(
            date = d,
            today = LocalDate.now(),
            imperial = p?.unitSystem == "imperial",
            twelveHour = p?.timeFormat == "12h",
            prefs = p,
            habits = habits,
            habitLogs = habitLogs,
            logs = h.logs.sortedByDescending { it.logDate },
            medications = h.meds.sortedWith(compareByDescending<Medication> { it.active }.thenBy { it.name.lowercase() }),
            medicationLogs = h.medLogs,
            foods = h.foods.sortedBy { it.name.lowercase() },
            foodLogs = h.foodLogs.sortedWith(compareByDescending<FoodLog> { it.logDate }.thenByDescending { it.createdAt ?: "" }),
            stats = stats,
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    fun setDate(value: LocalDate) { date.value = value }

    /** Every change to the day's log is saved as it's made; there's no Save button to forget. */
    fun updateLog(s: BodyState, change: (HealthLog) -> HealthLog) = viewModelScope.launch {
        body.save(change(s.log ?: HealthLog(newId(), s.iso)))
    }

    fun toggleDose(s: BodyState, medication: Medication, slot: String) = viewModelScope.launch {
        today.setDose(medication.id, s.iso, slot, !s.taken(medication, slot), s.medicationLogs)
    }

    fun toggleHabit(s: BodyState, habit: Habit) = viewModelScope.launch { plan.toggleHabit(habit, s.iso, s.habitLogs) }

    fun log(food: Food, s: BodyState, meal: String, servings: Double = 1.0): FoodLog {
        val entry = logFromFood(food, servings, s.iso, meal, newId(), nowIso())
        viewModelScope.launch { body.save(entry) }
        return entry
    }

    fun logOneOff(name: String, calories: Double, s: BodyState, meal: String, from: FoodLog? = null): FoodLog {
        val entry = FoodLog(
            id = newId(), createdAt = nowIso(), logDate = s.iso, name = name.trim(), meal = meal, calories = calories, servings = 1.0,
            proteinG = from?.proteinG, carbsG = from?.carbsG, fatG = from?.fatG,
        )
        viewModelScope.launch { body.save(entry) }
        return entry
    }

    /** A reference food: added to the person's own library first (once), then logged. */
    fun logLibrary(item: LibraryFood, s: BodyState, meal: String): FoodLog {
        val food = s.foods.firstOrNull { it.name.equals(item.name, ignoreCase = true) } ?: addToLibrary(item)
        return log(food, s, meal)
    }

    fun addToLibrary(item: LibraryFood): Food {
        val food = Food(newId(), item.name, item.calories, item.servingLabel, item.servingGrams, item.proteinG, item.carbsG, item.fatG)
        viewModelScope.launch { body.save(food) }
        return food
    }

    fun delete(log: FoodLog) = viewModelScope.launch { body.delete(log) }
    fun restore(log: FoodLog) = viewModelScope.launch { body.save(log) }
    fun save(food: Food) = viewModelScope.launch { body.save(food) }
    fun delete(food: Food) = viewModelScope.launch { body.delete(food) }
    fun save(medication: Medication) = viewModelScope.launch { body.save(medication) }
    fun delete(medication: Medication, logs: List<MedicationLog>) = viewModelScope.launch { body.delete(medication, logs) }
    fun saveWeight(s: BodyState, kg: Double?) = viewModelScope.launch { body.save((s.stats ?: BodyStats(newId())).copy(weightKg = kg)) }
    fun saveHeight(s: BodyState, cm: Double?) = viewModelScope.launch { body.save((s.stats ?: BodyStats(newId())).copy(heightCm = cm)) }
    fun saveFoodPrefs(s: BodyState, value: FoodPrefs) = viewModelScope.launch { prefs.saveFoodPrefs(s.prefs, value.toJson()) }
}
