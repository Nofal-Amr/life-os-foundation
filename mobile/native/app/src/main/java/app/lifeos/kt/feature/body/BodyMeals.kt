package app.lifeos.kt.feature.body

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.border
import androidx.compose.foundation.combinedClickable
import androidx.compose.ui.draw.drawBehind
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.RadioButtonUnchecked
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Medication
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.InputChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import app.lifeos.kt.core.designsystem.EmptyState
import app.lifeos.kt.core.designsystem.Eyebrow
import app.lifeos.kt.core.designsystem.LifeCard
import app.lifeos.kt.core.designsystem.Muted
import app.lifeos.kt.core.designsystem.Numbers
import app.lifeos.kt.core.designsystem.PickTime
import app.lifeos.kt.core.designsystem.ProgressRing
import app.lifeos.kt.core.designsystem.SectionHeader
import app.lifeos.kt.core.designsystem.SelectChip
import app.lifeos.kt.core.designsystem.rememberHaptics
import app.lifeos.kt.core.designsystem.rememberUndo
import app.lifeos.kt.core.model.Food
import app.lifeos.kt.core.model.FoodLog
import app.lifeos.kt.core.model.Medication
import app.lifeos.kt.data.logic.CUISINES
import app.lifeos.kt.data.logic.LibraryFood
import app.lifeos.kt.data.logic.MEALS
import app.lifeos.kt.data.logic.dayTotals
import app.lifeos.kt.data.logic.dosesOn
import app.lifeos.kt.data.logic.libraryNotYetAdded
import app.lifeos.kt.data.logic.mealForTime
import app.lifeos.kt.data.logic.recentOneOffs
import app.lifeos.kt.data.logic.suggestedFoods
import app.lifeos.kt.data.logic.suggestionsFor
import app.lifeos.kt.data.newId
import app.lifeos.kt.feature.tasks.EditorSheet
import java.time.LocalTime
import kotlin.math.roundToInt

/* -------------------------------- Meals -------------------------------- */

internal fun LazyListScope.mealsPage(s: BodyState, model: BodyViewModel) {
    item(key = "quick-meals") { QuickMeals(s, model) }
    item(key = "day-food") { DayFood(s, model) }
    item(key = "library-head") { SectionHeader("Your food library") }
    item(key = "library") { FoodLibrary(s, model) }
}

/**
 * The web's QuickMeals: the meal is preselected from the time of day, your
 * usual foods are one tap each, typing a name and pressing Done logs it, and
 * every log can be undone. Native extra: reference foods for the meal sit
 * below, so a new person isn't faced with an empty box.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun QuickMeals(s: BodyState, model: BodyViewModel) {
    val haptics = rememberHaptics()
    val undo = rememberUndo()
    var meal by rememberSaveable { mutableStateOf(mealForTime()) }
    var text by rememberSaveable { mutableStateOf("") }
    var calories by rememberSaveable { mutableStateOf("") }
    var setup by remember { mutableStateOf(false) }
    var picking by remember { mutableStateOf<Food?>(null) }
    val prefs = s.foodPrefs
    val chosen = prefs?.meals?.get(meal).orEmpty().mapNotNull { name -> s.foods.firstOrNull { it.name.equals(name, ignoreCase = true) } }
    val suggestions = (chosen + suggestedFoods(s.foods, s.foodLogs, 8, meal).filter { f -> chosen.none { it.id == f.id } }).take(8)
    val oneOffs = (recentOneOffs(s.foodLogs.filter { it.meal == meal }, 4) + recentOneOffs(s.foodLogs, 4)).distinctBy { it.name?.lowercase() }.take(4)
    val query = text.trim().lowercase()
    val matches = if (query.isEmpty()) emptyList() else s.foods.filter { it.name.lowercase().contains(query) }.take(5)
    val library = libraryNotYetAdded(s.foods.map { it.name }).let { left ->
        val picks = suggestionsFor(meal, prefs?.cuisines.orEmpty()).map { it.name }.toSet()
        left.filter { it.name in picks }.take(6)
    }
    val label = MEALS.first { it.first == meal }.second.lowercase()

    fun logged(entry: FoodLog) {
        haptics.confirm()
        undo("${entry.name ?: "Food"} added to $label") { model.delete(entry) }
    }
    fun logTyped() {
        val name = text.trim()
        if (name.isEmpty()) { haptics.reject(); return }
        val exact = s.foods.firstOrNull { it.name.equals(name, ignoreCase = true) }
        logged(if (exact != null) model.log(exact, s, meal) else model.logOneOff(name, calories.toDoubleOrNull() ?: 0.0, s, meal))
        text = ""
        calories = ""
    }

    LifeCard {
        SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
            MEALS.forEachIndexed { index, (value, name) ->
                SegmentedButton(selected = meal == value, onClick = { haptics.tick(); meal = value }, shape = SegmentedButtonDefaults.itemShape(index, MEALS.size), icon = {}) {
                    Text(name, style = MaterialTheme.typography.labelMedium, maxLines = 1)
                }
            }
        }
        Spacer(Modifier.height(12.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(
                value = text,
                onValueChange = { text = it },
                placeholder = { Text("What did you have for $label?") },
                singleLine = true,
                shape = MaterialTheme.shapes.medium,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(onDone = { logTyped() }),
                modifier = Modifier.weight(1f),
            )
            if (query.isNotEmpty() && matches.isEmpty()) {
                Spacer(Modifier.width(8.dp))
                OutlinedTextField(
                    value = calories,
                    onValueChange = { calories = it.filter(Char::isDigit).take(5) },
                    placeholder = { Text("kcal") },
                    singleLine = true,
                    shape = MaterialTheme.shapes.medium,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number, imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(onDone = { logTyped() }),
                    modifier = Modifier.width(88.dp),
                )
            }
            Spacer(Modifier.width(8.dp))
            FilledIconButton(onClick = { logTyped() }, enabled = query.isNotEmpty(), modifier = Modifier.size(52.dp)) { Icon(Icons.Outlined.Add, "Log it") }
        }
        Spacer(Modifier.height(12.dp))
        if (matches.isEmpty() && (suggestions.isNotEmpty() || oneOffs.isNotEmpty())) {
            Eyebrow(if (chosen.isNotEmpty() || s.foodLogs.any { it.meal == meal && it.foodId != null }) "Usually at $label" else "Your foods")
            Spacer(Modifier.height(6.dp))
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            for (food in matches.ifEmpty { suggestions }) {
                FoodChip(food.name, food.calories.takeIf { it > 0 }, dashed = false, onClick = { logged(model.log(food, s, meal)); text = "" }, onLongClick = { picking = food })
            }
            if (matches.isEmpty()) {
                for (log in oneOffs) FoodChip(log.name ?: "Food", null, dashed = true, onClick = { logged(model.logOneOff(log.name ?: "Food", log.calories / log.servings.coerceAtLeast(1.0), s, meal, log)) })
            }
        }
        if (matches.isEmpty() && library.isNotEmpty()) {
            Spacer(Modifier.height(10.dp))
            Eyebrow("From the reference list")
            Spacer(Modifier.height(6.dp))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                for (item in library) FoodChip(item.name, item.calories, dashed = true, onClick = { logged(model.logLibrary(item, s, meal)) })
            }
            Muted("Typical figures from public tables, not your food. Logging one adds it to your library to edit.", style = MaterialTheme.typography.labelSmall)
        }
        Spacer(Modifier.height(6.dp))
        TextButton(onClick = { setup = true }, contentPadding = PaddingValues(horizontal = 0.dp)) {
            Text(if (prefs == null) "Tell Life OS what you usually eat, and it offers those first" else "Your usual foods")
        }
    }
    if (setup) UsualFoodsSheet(s, model, close = { setup = false })
    picking?.let { food -> LogServingsSheet(s, model, food, meal, close = { picking = null }, logged = ::logged) }
}

@OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)
@Composable
private fun FoodChip(name: String, calories: Double?, dashed: Boolean, onClick: () -> Unit, onLongClick: (() -> Unit)? = null) {
    val haptics = rememberHaptics()
    Row(
        Modifier
            .clip(RoundedCornerShape(50))
            .chipBorder(dashed)
            .combinedClickable(onClick = onClick, onLongClick = onLongClick?.let { { haptics.longPress(); it() } })
            .padding(horizontal = 14.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(name, style = MaterialTheme.typography.bodyMedium, color = if (dashed) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface)
        if (calories != null) {
            Spacer(Modifier.width(6.dp))
            Text("${calories.roundToInt()}", style = MaterialTheme.typography.labelSmall.merge(Numbers), color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun Modifier.chipBorder(dashed: Boolean): Modifier {
    val color = MaterialTheme.colorScheme.outline.copy(alpha = 0.7f)
    return if (!dashed) border(BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)), RoundedCornerShape(50))
    else drawBehind {
        val stroke = androidx.compose.ui.graphics.drawscope.Stroke(width = 1.dp.toPx(), pathEffect = androidx.compose.ui.graphics.PathEffect.dashPathEffect(floatArrayOf(10f, 8f)))
        drawRoundRect(color, cornerRadius = androidx.compose.ui.geometry.CornerRadius(size.height / 2), style = stroke)
    }
}

/** What this day holds, by meal; × removes an entry (with Undo). */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun DayFood(s: BodyState, model: BodyViewModel) {
    val haptics = rememberHaptics()
    val undo = rememberUndo()
    val day = s.dayFood
    LifeCard {
        Eyebrow("Logged this day")
        Spacer(Modifier.height(8.dp))
        if (day.isEmpty()) {
            Muted("Nothing logged for this day yet.")
            return@LifeCard
        }
        for ((value, name) in MEALS) {
            val items = day.filter { (it.meal ?: "snack") == value }
            if (items.isEmpty()) continue
            Row(Modifier.padding(vertical = 4.dp), verticalAlignment = Alignment.Top) {
                Text(name, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.width(84.dp).padding(top = 8.dp))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.weight(1f)) {
                    for (log in items) {
                        InputChip(
                            selected = false,
                            onClick = {},
                            label = { Text((log.name ?: "Food") + if (log.servings != 1.0) " ×${trimServings(log.servings)}" else "") },
                            trailingIcon = {
                                Icon(
                                    Icons.Outlined.Close,
                                    "Remove ${log.name ?: "food"}",
                                    modifier = Modifier.size(18.dp).clip(RoundedCornerShape(50)).clickable {
                                        haptics.confirm()
                                        model.delete(log)
                                        undo("Removed ${log.name ?: "food"}") { model.restore(log) }
                                    },
                                )
                            },
                        )
                    }
                }
            }
        }
        val totals = dayTotals(day)
        if (totals.calories > 0) {
            Spacer(Modifier.height(6.dp))
            Muted(
                "%,d kcal".format(totals.calories.roundToInt()) + (if (totals.protein > 0) " · ${totals.protein.roundToInt()} g protein" else "") + " from what you logged",
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}

private fun trimServings(value: Double) = if (value % 1.0 == 0.0) value.toLong().toString() else value.toString()

/** Long-press a food chip: log more or less than one serving. */
@Composable
private fun LogServingsSheet(s: BodyState, model: BodyViewModel, food: Food, meal: String, close: () -> Unit, logged: (FoodLog) -> Unit) {
    val haptics = rememberHaptics()
    var servings by rememberSaveable { mutableStateOf("1") }
    var forMeal by rememberSaveable { mutableStateOf(meal) }
    EditorSheet(
        title = "Log ${food.name}",
        close = close,
        onSave = {
            val n = servings.replace(',', '.').toDoubleOrNull()
            if (n == null || n <= 0) { haptics.reject(); false } else { logged(model.log(food, s, forMeal, n)); true }
        },
    ) {
        food.servingLabel?.let { Muted("$it · ${food.calories.roundToInt()} kcal a serving") }
        OutlinedTextField(servings, { servings = it }, label = { Text("Servings") }, singleLine = true, textStyle = MaterialTheme.typography.headlineSmall.merge(Numbers), shape = MaterialTheme.shapes.medium, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), modifier = Modifier.fillMaxWidth())
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            for (n in listOf("0.5", "1", "1.5", "2")) SelectChip(servings == n, n, { haptics.tick(); servings = n })
        }
        SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
            MEALS.forEachIndexed { index, (value, name) ->
                SegmentedButton(selected = forMeal == value, onClick = { forMeal = value }, shape = SegmentedButtonDefaults.itemShape(index, MEALS.size), icon = {}) { Text(name, style = MaterialTheme.typography.labelMedium, maxLines = 1) }
            }
        }
    }
}

/** The web's FoodSetup: cuisines, then the foods you usually have at each meal. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun UsualFoodsSheet(s: BodyState, model: BodyViewModel, close: () -> Unit) {
    val haptics = rememberHaptics()
    val start = s.foodPrefs ?: FoodPrefs(emptyList(), emptyMap())
    var cuisines by remember { mutableStateOf(start.cuisines) }
    var meals by remember { mutableStateOf(start.meals) }
    EditorSheet(
        title = "What you usually eat",
        close = close,
        onSave = {
            haptics.confirm()
            // A usual food from the reference list joins your own library, so it's one tap later.
            meals.values.flatten().distinct().forEach { name ->
                if (s.foods.none { it.name.equals(name, ignoreCase = true) }) app.lifeos.kt.data.logic.FOOD_LIBRARY.firstOrNull { it.name == name }?.let(model::addToLibrary)
            }
            model.saveFoodPrefs(s, FoodPrefs(cuisines, meals.filterValues { it.isNotEmpty() }))
            true
        },
    ) {
        Muted("Life OS offers these first at each meal. Nothing else changes.")
        Eyebrow("Cuisines")
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            for ((value, name) in CUISINES) SelectChip(value in cuisines, name, { haptics.tick(); cuisines = if (value in cuisines) cuisines - value else cuisines + value })
        }
        for ((meal, name) in MEALS) {
            Eyebrow(name)
            val options = (s.foods.map { it.name } + suggestionsFor(meal, cuisines).map(LibraryFood::name)).distinctBy { it.lowercase() }.take(16)
            val picked = meals[meal].orEmpty()
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                for (option in options) {
                    val on = picked.any { it.equals(option, ignoreCase = true) }
                    SelectChip(on, option, {
                        haptics.tick()
                        meals = meals + (meal to if (on) picked.filterNot { it.equals(option, ignoreCase = true) } else picked + option)
                    })
                }
            }
        }
    }
}

@Composable
private fun FoodLibrary(s: BodyState, model: BodyViewModel) {
    var editing by rememberSaveable { mutableStateOf<String?>(null) }
    if (s.foods.isEmpty()) {
        LifeCard { Muted("Enter a food once per serving, then it's one tap to log. Foods you log from the reference list land here too.") }
    } else {
        LifeCard(contentPadding = PaddingValues(vertical = 4.dp)) {
            s.foods.forEachIndexed { index, food ->
                if (index > 0) HorizontalDivider(Modifier.padding(horizontal = 16.dp), color = MaterialTheme.colorScheme.outlineVariant)
                Row(Modifier.fillMaxWidth().clickable { editing = food.id }.padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(food.name, style = MaterialTheme.typography.bodyLarge)
                        Muted(
                            listOfNotNull(
                                food.servingLabel,
                                food.proteinG?.let { "P ${it.roundToInt()} g" },
                                food.carbsG?.let { "C ${it.roundToInt()} g" },
                                food.fatG?.let { "F ${it.roundToInt()} g" },
                            ).joinToString(" · "),
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                    Text("${food.calories.roundToInt()} kcal", style = MaterialTheme.typography.bodyMedium.merge(Numbers))
                }
            }
        }
    }
    s.foods.firstOrNull { it.id == editing }?.let { FoodEditor(model, it, close = { editing = null }) }
}

@Composable
internal fun FoodEditor(model: BodyViewModel, food: Food?, close: () -> Unit) {
    val haptics = rememberHaptics()
    val undo = rememberUndo()
    val key = food?.id ?: "new"
    fun t(v: Double?) = v?.let { if (it % 1.0 == 0.0) it.toLong().toString() else it.toString() }.orEmpty()
    var name by rememberSaveable(key) { mutableStateOf(food?.name.orEmpty()) }
    var serving by rememberSaveable(key) { mutableStateOf(food?.servingLabel.orEmpty()) }
    var grams by rememberSaveable(key) { mutableStateOf(t(food?.servingGrams)) }
    var kcal by rememberSaveable(key) { mutableStateOf(t(food?.calories)) }
    var protein by rememberSaveable(key) { mutableStateOf(t(food?.proteinG)) }
    var carbs by rememberSaveable(key) { mutableStateOf(t(food?.carbsG)) }
    var fat by rememberSaveable(key) { mutableStateOf(t(food?.fatG)) }
    fun num(v: String) = v.trim().replace(',', '.').toDoubleOrNull()
    EditorSheet(
        title = if (food == null) "New food" else "Edit food",
        close = close,
        onSave = {
            val calories = num(kcal)
            if (name.isBlank() || calories == null || calories < 0) { haptics.reject(); false } else {
                haptics.confirm()
                model.save((food ?: Food(newId(), name)).copy(name = name.trim(), servingLabel = serving.trim().ifEmpty { null }, servingGrams = num(grams), calories = calories, proteinG = num(protein), carbsG = num(carbs), fatG = num(fat)))
                true
            }
        },
        delete = food?.let { f -> { haptics.confirm(); model.delete(f); close(); undo("Food removed from your library") { model.save(f) } } },
        deleteNote = "Entries you already logged stay as they are.",
    ) {
        Muted("Enter it once per serving, then it is one tap to log.")
        OutlinedTextField(name, { name = it }, label = { Text("Name") }, singleLine = true, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth())
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(serving, { serving = it }, label = { Text("Serving") }, placeholder = { Text("1 bowl") }, singleLine = true, shape = MaterialTheme.shapes.medium, modifier = Modifier.weight(1.4f))
            NumField(grams, { grams = it }, "Grams", Modifier.weight(1f))
        }
        NumField(kcal, { kcal = it }, "Calories a serving", Modifier.fillMaxWidth())
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            NumField(protein, { protein = it }, "Protein g", Modifier.weight(1f))
            NumField(carbs, { carbs = it }, "Carbs g", Modifier.weight(1f))
            NumField(fat, { fat = it }, "Fat g", Modifier.weight(1f))
        }
    }
}

@Composable
private fun NumField(value: String, set: (String) -> Unit, label: String, modifier: Modifier) =
    OutlinedTextField(value, { set(it.filter { c -> c.isDigit() || c == '.' || c == ',' }) }, label = { Text(label, maxLines = 1) }, singleLine = true, textStyle = MaterialTheme.typography.bodyLarge.merge(Numbers), shape = MaterialTheme.shapes.medium, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), modifier = modifier)

/* ------------------------------ Medication ------------------------------ */

internal fun LazyListScope.medicationPage(s: BodyState, model: BodyViewModel) {
    item(key = "dose-ring") { DoseRing(s, model) }
    item(key = "meds-head") { SectionHeader("Medications") }
    item(key = "meds") { MedicationList(s, model) }
}

@Composable
private fun DoseRing(s: BodyState, model: BodyViewModel) {
    val ring = dosesOn(s.medications, s.medicationLogs, s.iso)
    LifeCard {
        if (ring == null) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                app.lifeos.kt.core.designsystem.IconBadge(Icons.Outlined.Medication, size = 36.dp)
                Spacer(Modifier.width(12.dp))
                Muted("No doses are scheduled. Add times to a medication to get a daily taken checklist.")
            }
            return@LifeCard
        }
        val (done, total) = ring
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(contentAlignment = Alignment.Center) {
                ProgressRing(done.toFloat() / total, size = 60.dp, stroke = 6.dp)
                Text("$done/$total", style = MaterialTheme.typography.titleSmall.merge(Numbers))
            }
            Spacer(Modifier.width(14.dp))
            Column {
                Eyebrow(if (s.date == s.today) "Medication today" else "Medication on ${s.date.format(java.time.format.DateTimeFormatter.ofPattern("d MMM"))}")
                Text("$done of $total", style = MaterialTheme.typography.titleLarge.merge(Numbers))
                Muted(if (total == 1) "scheduled dose marked taken" else "scheduled doses marked taken", style = MaterialTheme.typography.bodySmall)
            }
        }
        Spacer(Modifier.height(12.dp))
        DoseChips(s, model)
    }
}

/** Every scheduled dose for the day as a chip: tap to mark it taken, again to undo. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun DoseChips(s: BodyState, model: BodyViewModel) {
    val haptics = rememberHaptics()
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
        // In the order they fall in the day, so the chips read like the schedule.
        val doses = s.medications.filter { it.active }.flatMap { med -> med.scheduleTimes.orEmpty().distinct().map { med to it } }.sortedWith(compareBy({ it.second }, { it.first.name.lowercase() }))
        for ((med, slot) in doses) {
            run {
                val taken = s.taken(med, slot)
                AssistChip(
                    onClick = { if (taken) haptics.tick() else haptics.confirm(); model.toggleDose(s, med, slot) },
                    label = { Text("${med.name} · ${s.slot(slot)}") },
                    leadingIcon = { Icon(if (taken) Icons.Outlined.CheckCircle else Icons.Outlined.RadioButtonUnchecked, if (taken) "Taken" else "Not taken yet", Modifier.size(18.dp)) },
                    colors = if (taken) AssistChipDefaults.assistChipColors(containerColor = MaterialTheme.colorScheme.primaryContainer, labelColor = MaterialTheme.colorScheme.onPrimaryContainer, leadingIconContentColor = MaterialTheme.colorScheme.primary) else AssistChipDefaults.assistChipColors(),
                    border = if (taken) null else AssistChipDefaults.assistChipBorder(true),
                )
            }
        }
    }
}

/** On the Day tab: the day's doses, only when something is scheduled. */
@Composable
internal fun DoseStrip(s: BodyState, model: BodyViewModel, onManage: () -> Unit) {
    val ring = dosesOn(s.medications, s.medicationLogs, s.iso) ?: return
    LifeCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Eyebrow("Medication · ${ring.first} of ${ring.second} taken", modifier = Modifier.weight(1f))
            TextButton(onClick = onManage) { Text("Manage") }
        }
        DoseChips(s, model)
    }
}

@Composable
private fun MedicationList(s: BodyState, model: BodyViewModel) {
    var editing by rememberSaveable { mutableStateOf<String?>(null) }
    if (s.medications.isEmpty()) {
        EmptyState(Icons.Outlined.Medication, "No medications yet", "Add the medication schedule you already follow, and the day's doses appear here and on Today for one-tap logging.")
    } else {
        LifeCard(contentPadding = PaddingValues(vertical = 4.dp)) {
            s.medications.forEachIndexed { index, med ->
                if (index > 0) HorizontalDivider(Modifier.padding(horizontal = 16.dp), color = MaterialTheme.colorScheme.outlineVariant)
                Column(Modifier.fillMaxWidth().clickable { editing = med.id }.padding(horizontal = 16.dp, vertical = 12.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(med.name, style = MaterialTheme.typography.bodyLarge, color = if (med.active) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(1f))
                        if (!med.active) Muted("Inactive", style = MaterialTheme.typography.labelMedium)
                    }
                    Muted(
                        listOfNotNull(med.dosage, med.scheduleTimes?.takeIf { it.isNotEmpty() }?.sorted()?.joinToString(", ") { s.slot(it) }, med.notes).joinToString(" · ").ifEmpty { "No times set" },
                        style = MaterialTheme.typography.bodySmall,
                        maxLines = 2,
                    )
                }
            }
        }
        Muted("This is a schedule and checklist only. Reminders that ring come with notifications in a later update.", style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(horizontal = 4.dp, vertical = 6.dp))
    }
    s.medications.firstOrNull { it.id == editing }?.let { MedicationEditor(s, model, it, close = { editing = null }) }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun MedicationEditor(s: BodyState, model: BodyViewModel, med: Medication?, close: () -> Unit) {
    val haptics = rememberHaptics()
    val undo = rememberUndo()
    val key = med?.id ?: "new"
    var name by rememberSaveable(key) { mutableStateOf(med?.name.orEmpty()) }
    var dosage by rememberSaveable(key) { mutableStateOf(med?.dosage.orEmpty()) }
    var notes by rememberSaveable(key) { mutableStateOf(med?.notes.orEmpty()) }
    var active by rememberSaveable(key) { mutableStateOf(med?.active ?: true) }
    var times by rememberSaveable(key) { mutableStateOf(med?.scheduleTimes.orEmpty().sorted()) }
    var picking by remember { mutableStateOf(false) }
    EditorSheet(
        title = if (med == null) "Add medication" else "Edit medication",
        close = close,
        onSave = {
            if (name.isBlank()) { haptics.reject(); false } else {
                haptics.confirm()
                model.save((med ?: Medication(newId(), name)).copy(name = name.trim(), dosage = dosage.trim().ifEmpty { null }, notes = notes.trim().ifEmpty { null }, active = active, scheduleTimes = times.ifEmpty { null }))
                true
            }
        },
        delete = med?.let { m -> { haptics.confirm(); model.delete(m, s.medicationLogs); close() } },
        deleteNote = if (med?.scheduleTimes.isNullOrEmpty()) "Its daily records will be removed too." else "Its scheduled times and daily taken records will be removed too.",
    ) {
        Muted("Stored exactly as you enter it. No dosing guidance is given.")
        OutlinedTextField(name, { name = it }, label = { Text("Name") }, singleLine = true, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(dosage, { dosage = it }, label = { Text("Dosage (optional)") }, singleLine = true, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth())
        Eyebrow("Times")
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            for (slot in times) {
                InputChip(selected = true, onClick = { haptics.tick(); times = times - slot }, label = { Text(s.slot(slot)) }, trailingIcon = { Icon(Icons.Outlined.Close, "Remove $slot", Modifier.size(18.dp)) })
            }
            SelectChip(false, "Add time", { picking = true }, leadingIcon = Icons.Outlined.Schedule)
        }
        OutlinedTextField(notes, { notes = it }, label = { Text("Notes (optional)") }, minLines = 2, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth())
        Row(Modifier.fillMaxWidth().clip(MaterialTheme.shapes.medium).clickable(role = Role.Switch) { haptics.tick(); active = !active }.padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("Active", style = MaterialTheme.typography.bodyLarge)
                Muted(if (active) "Its doses appear each day." else "Kept, but no doses are scheduled.", style = MaterialTheme.typography.bodySmall)
            }
            Switch(active, onCheckedChange = null)
        }
    }
    if (picking) PickTime(LocalTime.of(9, 0), dismiss = { picking = false }) { t ->
        val slot = t.toString().take(5)
        if (slot !in times) times = (times + slot).sorted()
    }
}
