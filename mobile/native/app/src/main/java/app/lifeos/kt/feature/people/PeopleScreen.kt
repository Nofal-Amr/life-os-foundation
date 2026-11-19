package app.lifeos.kt.feature.people

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Chat
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Cake
import androidx.compose.material.icons.outlined.Call
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material.icons.outlined.Phone
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.lifeos.kt.core.common.friendlyDate
import app.lifeos.kt.core.designsystem.EmptyState
import app.lifeos.kt.core.designsystem.LifeCard
import app.lifeos.kt.core.designsystem.LifePage
import app.lifeos.kt.core.designsystem.Muted
import app.lifeos.kt.core.designsystem.SectionHeader
import app.lifeos.kt.core.designsystem.SelectChip
import app.lifeos.kt.core.designsystem.rememberHaptics
import app.lifeos.kt.core.designsystem.rememberToast
import app.lifeos.kt.core.designsystem.rememberUndo
import app.lifeos.kt.core.model.Person
import app.lifeos.kt.core.model.PersonInteraction
import app.lifeos.kt.core.model.PersonLink
import app.lifeos.kt.core.model.RelationshipRule
import app.lifeos.kt.data.PeopleRepository
import app.lifeos.kt.data.logic.CADENCES
import app.lifeos.kt.data.logic.CIRCLES
import app.lifeos.kt.data.logic.INTERACTION_KINDS
import app.lifeos.kt.data.logic.Nudge
import app.lifeos.kt.data.logic.RELATIONS
import app.lifeos.kt.data.logic.cadenceLabel
import app.lifeos.kt.data.logic.checkInState
import app.lifeos.kt.data.logic.circleLabel
import app.lifeos.kt.data.logic.daysAgo
import app.lifeos.kt.data.logic.daysUntilBirthday
import app.lifeos.kt.data.logic.describeRule
import app.lifeos.kt.data.logic.lastContact
import app.lifeos.kt.data.logic.nextBirthday
import app.lifeos.kt.data.logic.relationLabel
import app.lifeos.kt.data.logic.todaysNudges
import app.lifeos.kt.data.logic.turningAge
import app.lifeos.kt.data.newId
import dagger.hilt.android.lifecycle.HiltViewModel
import java.time.LocalDate
import java.time.Month
import java.time.format.TextStyle
import java.time.temporal.ChronoUnit
import java.util.Locale
import javax.inject.Inject
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class PeopleState(
    val people: List<Person>,
    val interactions: List<PersonInteraction>,
    val links: List<PersonLink>,
    val rules: List<RelationshipRule>,
    val nudges: List<Nudge>,
    val today: LocalDate,
)

@HiltViewModel
class PeopleViewModel @Inject constructor(private val repo: PeopleRepository, prefs: app.lifeos.kt.data.PreferencesRepository) : ViewModel() {
    /** Whether People (Relationships) is switched on in Settings → Areas; it starts off. */
    val enabled: StateFlow<Boolean> = kotlinx.coroutines.flow.combine(prefs.preferences, repo.people) { p, _ -> app.lifeos.kt.data.moduleOn(p?.enabledModules, "relationships") }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), false)

    val state: StateFlow<PeopleState?> = combine(repo.people, repo.interactions, repo.links, repo.rules) { p, i, l, r ->
        val today = LocalDate.now()
        PeopleState(p.filter { !it.isMe }.sortedBy { it.name.lowercase() }, i, l, r, todaysNudges(p, i, r, today), today)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    fun save(person: Person) = viewModelScope.launch { repo.save(person) }
    fun delete(s: PeopleState, person: Person) = viewModelScope.launch { repo.delete(person, s.interactions, s.links) }
    fun log(person: Person, kind: String, note: String? = null, date: LocalDate = LocalDate.now()) = viewModelScope.launch { repo.log(person.id, kind, date.toString(), note) }
    fun delete(interaction: PersonInteraction) = viewModelScope.launch { repo.delete(interaction) }
    fun save(rule: RelationshipRule) = viewModelScope.launch { repo.save(rule) }
    fun delete(rule: RelationshipRule) = viewModelScope.launch { repo.delete(rule) }
}

private fun dial(context: android.content.Context, phone: String) = runCatching { context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:${Uri.encode(phone)}"))) }
private fun text(context: android.content.Context, phone: String) = runCatching { context.startActivity(Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:${Uri.encode(phone)}"))) }

/** People: birthdays and the check-ins you chose, everyone by circle, and the contact you logged. Nothing is scored. */
@Composable
fun PeopleScreen(back: @Composable () -> Unit, model: PeopleViewModel = hiltViewModel()) {
    val state by model.state.collectAsStateWithLifecycle()
    val haptics = rememberHaptics()
    val context = LocalContext.current
    var open by rememberSaveable { mutableStateOf<String?>(null) }
    var editing by remember { mutableStateOf<Person?>(null) }
    var addingRule by rememberSaveable { mutableStateOf(false) }
    val s = state

    LifePage(
        title = "People",
        subtitle = "Birthdays and the check-ins you choose. Only what you logged.",
        navigationIcon = back,
        floatingActionButton = {
            ExtendedFloatingActionButton(onClick = { haptics.tick(); editing = Person(newId(), "") }, icon = { Icon(Icons.Outlined.Add, null) }, text = { Text("Person") })
        },
    ) {
        if (s == null) return@LifePage
        if (s.people.isEmpty()) item(key = "empty") {
            EmptyState(Icons.Outlined.Groups, "No one here yet", "Add the people you want to remember: birthdays, and how often you'd like to be in touch.")
        }
        if (s.nudges.isNotEmpty()) {
            item(key = "today-h") { SectionHeader("Today") }
            item(key = "today") {
                LifeCard(contentPadding = PaddingValues(vertical = 4.dp)) {
                    for (n in s.nudges) {
                        Row(Modifier.fillMaxWidth().clickable { open = n.person.id }.padding(start = 16.dp, end = 4.dp, top = 8.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(if (n.kind == "birthday") Icons.Outlined.Cake else Icons.Outlined.Phone, null, tint = MaterialTheme.colorScheme.primary)
                            Spacer(Modifier.width(12.dp))
                            Column(Modifier.weight(1f)) {
                                Text(n.title, style = MaterialTheme.typography.bodyLarge)
                                Muted(n.detail, style = MaterialTheme.typography.bodySmall)
                            }
                            n.person.phone?.let { phone -> IconButton(onClick = { haptics.tick(); dial(context, phone) }) { Icon(Icons.Outlined.Call, "Call ${n.person.name}") } }
                            if (n.kind == "checkin") TextButton(onClick = { haptics.confirm(); model.log(n.person, "call") }) { Text("Called") }
                        }
                    }
                }
            }
        }
        for (circle in CIRCLES) {
            val group = s.people.filter { it.circle == circle.value }
            if (group.isEmpty()) continue
            item(key = "c-${circle.value}-h") { SectionHeader(circle.label) }
            item(key = "c-${circle.value}") {
                LifeCard(contentPadding = PaddingValues(vertical = 4.dp)) {
                    for (person in group) {
                        Column(Modifier.fillMaxWidth().clickable { haptics.tick(); open = person.id }.padding(horizontal = 16.dp, vertical = 10.dp)) {
                            Text(person.name, style = MaterialTheme.typography.bodyLarge)
                            Muted(personLine(person, s), style = MaterialTheme.typography.bodySmall, maxLines = 1)
                        }
                    }
                }
            }
        }
        if (s.people.isNotEmpty()) {
            item(key = "rules-h") { SectionHeader("Reminders", action = "Add rule", onAction = { addingRule = true }) }
            item(key = "rules") {
                LifeCard(contentPadding = PaddingValues(vertical = 4.dp)) {
                    if (s.rules.isEmpty()) Muted("Everyone with a birthday or a check-in rhythm is reminded. Add a rule to keep some quiet (\"no cousins' birthdays\").", Modifier.padding(16.dp), style = MaterialTheme.typography.bodySmall)
                    for (rule in s.rules.sortedBy { it.createdAt }) {
                        Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text(describeRule(rule, s.people), style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f).padding(vertical = 10.dp))
                            IconButton(onClick = { haptics.tick(); model.delete(rule) }) { Icon(Icons.Outlined.Close, "Remove rule", tint = MaterialTheme.colorScheme.onSurfaceVariant) }
                        }
                    }
                }
            }
        }
    }

    val st = s ?: return
    open?.let { id -> st.people.firstOrNull { it.id == id }?.let { PersonSheet(it, st, model, close = { open = null }, edit = { editing = it; open = null }) } }
    editing?.let { p -> PersonEditor(p, isNew = st.people.none { it.id == p.id }, close = { editing = null }, delete = { model.delete(st, p); editing = null }) { model.save(it) } }
    if (addingRule) RuleSheet(st.people, close = { addingRule = false }) { model.save(it) }
}

/** "Cousin · last call 3 days ago · birthday in 12 days". */
private fun personLine(person: Person, s: PeopleState): String {
    val parts = mutableListOf(relationLabel(person.relation))
    lastContact(person.id, s.interactions)?.let { last ->
        val noun = INTERACTION_KINDS.firstOrNull { it.first == last.kind }?.third ?: "contact"
        parts += "last $noun ${daysAgo(ChronoUnit.DAYS.between(LocalDate.parse(last.occurredOn), s.today))}"
    }
    daysUntilBirthday(person, s.today)?.takeIf { it <= 30 }?.let { parts += if (it == 0L) "birthday today" else "birthday in $it ${if (it == 1L) "day" else "days"}" }
    return parts.joinToString(" · ")
}

/** One person: log contact in a tap, call or text, what you logged, and their details. */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
private fun PersonSheet(person: Person, s: PeopleState, model: PeopleViewModel, close: () -> Unit, edit: (Person) -> Unit) {
    val haptics = rememberHaptics()
    val undo = rememberUndo()
    val context = LocalContext.current
    var note by rememberSaveable { mutableStateOf("") }
    val history = s.interactions.filter { it.personId == person.id }.sortedByDescending { it.occurredOn }
    ModalBottomSheet(onDismissRequest = close, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).navigationBarsPadding().padding(horizontal = 20.dp).padding(bottom = 20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(person.name, style = MaterialTheme.typography.headlineSmall)
                    Muted("${relationLabel(person.relation)} · ${circleLabel(person.circle)}")
                }
                IconButton(onClick = { haptics.tick(); edit(person) }) { Icon(Icons.Outlined.Edit, "Edit ${person.name}") }
            }
            person.phone?.let { phone ->
                Row(Modifier.padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilledTonalButton(onClick = { haptics.tick(); dial(context, phone) }, shape = MaterialTheme.shapes.medium) { Icon(Icons.Outlined.Call, null); Spacer(Modifier.width(6.dp)); Text("Call") }
                    FilledTonalButton(onClick = { haptics.tick(); text(context, phone) }, shape = MaterialTheme.shapes.medium) { Icon(Icons.AutoMirrored.Outlined.Chat, null); Spacer(Modifier.width(6.dp)); Text("Message") }
                }
            }
            val facts = listOfNotNull(
                nextBirthday(person, s.today)?.let { b -> "Birthday ${b.dayOfMonth} ${b.month.getDisplayName(TextStyle.FULL, Locale.getDefault())}" + (turningAge(person, s.today)?.let { " · turns $it" } ?: "") },
                person.checkinEveryDays?.let { "Check in: ${cadenceLabel(it).lowercase()}" + (checkInState(person, s.interactions, s.today)?.let { c -> if (c.due) " · due now" else " · next ${friendlyDate(c.nextOn, s.today)}" } ?: "") },
                person.goal?.let { "Goal: $it" },
            )
            for (f in facts) Muted(f, Modifier.padding(top = 6.dp))
            person.notes?.let { Text(it, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 10.dp)) }

            Text("Log contact", style = MaterialTheme.typography.titleSmall, modifier = Modifier.padding(top = 18.dp, bottom = 6.dp))
            OutlinedTextField(note, { note = it }, placeholder = { Text("A note (optional)") }, singleLine = true, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth())
            FlowRow(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                for ((kind, label, _) in INTERACTION_KINDS) {
                    SelectChip(false, label, {
                        if (kind == "note" && note.isBlank()) { haptics.reject(); return@SelectChip }
                        haptics.confirm(); model.log(person, kind, note); note = ""
                    })
                }
            }
            if (history.isNotEmpty()) {
                Text("What you logged", style = MaterialTheme.typography.titleSmall, modifier = Modifier.padding(top = 18.dp, bottom = 4.dp))
                for (item in history.take(20)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f).padding(vertical = 6.dp)) {
                            Text(INTERACTION_KINDS.firstOrNull { it.first == item.kind }?.second ?: item.kind, style = MaterialTheme.typography.bodyMedium)
                            Muted(listOfNotNull(friendlyDate(LocalDate.parse(item.occurredOn), s.today), item.note).joinToString(" · "), style = MaterialTheme.typography.bodySmall)
                        }
                        IconButton(onClick = { haptics.tick(); model.delete(item); undo("Removed") { model.log(person, item.kind, item.note, LocalDate.parse(item.occurredOn)) } }) {
                            Icon(Icons.Outlined.Close, "Remove", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }
        }
    }
}

/** Name, how they relate, their circle, birthday, phone, the check-in rhythm you want, a goal and notes. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun PersonEditor(person: Person, isNew: Boolean, close: () -> Unit, delete: () -> Unit, save: (Person) -> Unit) {
    val haptics = rememberHaptics()
    val toast = rememberToast()
    var name by rememberSaveable { mutableStateOf(person.name) }
    var relation by rememberSaveable { mutableStateOf(person.relation) }
    var circle by rememberSaveable { mutableStateOf(person.circle) }
    var month by rememberSaveable { mutableStateOf(person.birthdayMonth) }
    var day by rememberSaveable { mutableStateOf(person.birthdayDay?.toString().orEmpty()) }
    var year by rememberSaveable { mutableStateOf(person.birthYear?.toString().orEmpty()) }
    var phone by rememberSaveable { mutableStateOf(person.phone.orEmpty()) }
    var every by rememberSaveable { mutableStateOf(person.checkinEveryDays) }
    var goal by rememberSaveable { mutableStateOf(person.goal.orEmpty()) }
    var notes by rememberSaveable { mutableStateOf(person.notes.orEmpty()) }
    app.lifeos.kt.feature.tasks.EditorSheet(
        title = if (isNew) "Add a person" else person.name,
        close = close,
        delete = if (isNew) null else delete,
        deleteNote = "Their contact log goes too.",
        onSave = {
            val d = day.toIntOrNull()
            val y = year.toIntOrNull()
            val birthdayOk = (month == null && d == null) || (month != null && d != null && runCatching { LocalDate.of(2024, month!!, d) }.isSuccess)
            when {
                name.isBlank() -> { haptics.reject(); toast("Add a name."); false }
                !birthdayOk -> { haptics.reject(); toast("Check the birthday: pick a month and a real day."); false }
                y != null && y !in 1900..LocalDate.now().year -> { haptics.reject(); toast("Check the year."); false }
                else -> {
                    haptics.confirm()
                    save(person.copy(
                        name = name.trim().take(80), relation = relation, circle = circle,
                        birthdayMonth = if (d != null) month else null, birthdayDay = if (month != null) d else null, birthYear = y,
                        phone = phone.trim().ifEmpty { null }, goal = goal.trim().ifEmpty { null }, notes = notes.trim().ifEmpty { null },
                        checkinEveryDays = every,
                        // The rhythm counts from today until a contact is logged.
                        checkinSince = if (every != null && every != person.checkinEveryDays) LocalDate.now().toString() else person.checkinSince,
                    ))
                    true
                }
            }
        },
    ) {
        OutlinedTextField(name, { name = it }, label = { Text("Name") }, singleLine = true, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth())
        Muted("Who they are to you", style = MaterialTheme.typography.bodySmall)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            for (r in RELATIONS) SelectChip(relation == r.value, r.label, { haptics.tick(); relation = r.value })
        }
        Muted("Circle", style = MaterialTheme.typography.bodySmall)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) { for (c in CIRCLES) SelectChip(circle == c.value, c.label, { haptics.tick(); circle = c.value }) }
        Muted("Birthday (optional)", style = MaterialTheme.typography.bodySmall)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            for (m in 1..12) SelectChip(month == m, Month.of(m).getDisplayName(TextStyle.SHORT, Locale.getDefault()), { haptics.tick(); month = if (month == m) null else m })
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(day, { day = it.filter(Char::isDigit).take(2) }, label = { Text("Day") }, singleLine = true, shape = MaterialTheme.shapes.medium, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.weight(1f))
            OutlinedTextField(year, { year = it.filter(Char::isDigit).take(4) }, label = { Text("Year (optional)") }, singleLine = true, shape = MaterialTheme.shapes.medium, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.weight(1f))
        }
        OutlinedTextField(phone, { phone = it.take(40) }, label = { Text("Phone (optional)") }, singleLine = true, shape = MaterialTheme.shapes.medium, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone), modifier = Modifier.fillMaxWidth())
        Muted("Check in", style = MaterialTheme.typography.bodySmall)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            for ((days, label) in CADENCES) SelectChip(every == days, label, { haptics.tick(); every = days })
        }
        OutlinedTextField(goal, { goal = it.take(500) }, label = { Text("A goal with them (optional)") }, singleLine = true, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(notes, { notes = it.take(4000) }, label = { Text("Notes (optional)") }, minLines = 2, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth())
    }
}

/** A reminder rule: what (birthdays, check-ins or both), remind or keep quiet, and for whom. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun RuleSheet(people: List<Person>, close: () -> Unit, save: (RelationshipRule) -> Unit) {
    val haptics = rememberHaptics()
    var topic by rememberSaveable { mutableStateOf("birthday") }
    var action by rememberSaveable { mutableStateOf("quiet") }
    var scope by rememberSaveable { mutableStateOf("relation") }
    var value by rememberSaveable { mutableStateOf<String?>(null) }
    val draft = RelationshipRule(newId(), scope, if (scope == "everyone") null else value, topic, action)
    app.lifeos.kt.feature.tasks.EditorSheet(title = "Reminder rule", close = close, onSave = {
        if (scope != "everyone" && value == null) { haptics.reject(); false } else { haptics.confirm(); save(draft); true }
    }) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            SelectChip(action == "quiet", "Don't remind me", { action = "quiet" })
            SelectChip(action == "remind", "Remind me", { action = "remind" })
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            for ((v, l) in listOf("birthday" to "Birthdays", "checkin" to "Check-ins", "both" to "Both")) SelectChip(topic == v, l, { topic = v })
        }
        Muted("For", style = MaterialTheme.typography.bodySmall)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            for ((v, l) in listOf("everyone" to "Everyone", "circle" to "A circle", "relation" to "A relation", "person" to "One person")) SelectChip(scope == v, l, { scope = v; value = null })
        }
        val options = when (scope) {
            "circle" -> CIRCLES.map { it.value to it.label }
            "relation" -> RELATIONS.map { it.value to it.label }
            "person" -> people.map { it.id to it.name }
            else -> emptyList()
        }
        if (options.isNotEmpty()) FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            for ((v, l) in options) SelectChip(value == v, l, { haptics.tick(); value = v })
        }
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
        Text(if (scope != "everyone" && value == null) "Pick who it's for." else describeRule(draft, people), style = MaterialTheme.typography.bodyMedium)
        Spacer(Modifier.height(4.dp))
    }
}


/** On Today: birthdays coming up and the check-ins that are due, with "Called" in one tap. Nothing when there's nothing. */
@Composable
fun PeopleToday(openPeople: () -> Unit, model: PeopleViewModel = hiltViewModel()) {
    val state by model.state.collectAsStateWithLifecycle()
    val enabled by model.enabled.collectAsStateWithLifecycle()
    val haptics = rememberHaptics()
    val context = LocalContext.current
    val nudges = state?.nudges.orEmpty()
    if (!enabled || nudges.isEmpty()) return
    Column {
        SectionHeader("People", action = "All", onAction = openPeople)
        LifeCard(contentPadding = PaddingValues(vertical = 4.dp)) {
            for (n in nudges.take(4)) {
                Row(Modifier.fillMaxWidth().clickable { openPeople() }.padding(start = 16.dp, end = 4.dp, top = 6.dp, bottom = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(if (n.kind == "birthday") Icons.Outlined.Cake else Icons.Outlined.Phone, null, tint = MaterialTheme.colorScheme.primary)
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(n.title, style = MaterialTheme.typography.bodyLarge, maxLines = 1)
                        Muted(n.detail, style = MaterialTheme.typography.bodySmall)
                    }
                    n.person.phone?.let { phone -> IconButton(onClick = { haptics.tick(); dial(context, phone) }) { Icon(Icons.Outlined.Call, "Call ${n.person.name}") } }
                    if (n.kind == "checkin") TextButton(onClick = { haptics.confirm(); model.log(n.person, "call") }) { Text("Called") }
                }
            }
        }
    }
}
