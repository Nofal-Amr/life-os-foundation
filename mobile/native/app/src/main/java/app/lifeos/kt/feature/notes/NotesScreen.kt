package app.lifeos.kt.feature.notes

import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CheckBox
import androidx.compose.material.icons.outlined.CenterFocusStrong
import androidx.compose.material.icons.outlined.CheckBoxOutlineBlank
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.EditNote
import androidx.compose.material.icons.outlined.Fingerprint
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.LockOpen
import androidx.compose.material.icons.outlined.PushPin
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.lifeos.kt.core.datastore.AppSettings
import app.lifeos.kt.core.designsystem.EmptyState
import app.lifeos.kt.core.designsystem.Eyebrow
import app.lifeos.kt.core.designsystem.LifeCard
import app.lifeos.kt.core.designsystem.LifePage
import app.lifeos.kt.core.designsystem.Muted
import app.lifeos.kt.core.designsystem.SelectChip
import app.lifeos.kt.core.designsystem.Skeleton
import app.lifeos.kt.core.designsystem.rememberHaptics
import app.lifeos.kt.core.designsystem.rememberToast
import app.lifeos.kt.core.designsystem.rememberUndo
import app.lifeos.kt.core.model.ChecklistItem
import app.lifeos.kt.core.model.Note
import app.lifeos.kt.core.vault.Vault
import app.lifeos.kt.core.vault.VaultCrypto
import app.lifeos.kt.data.PlannerRepository
import app.lifeos.kt.data.logic.allLabels
import app.lifeos.kt.data.logic.filterNotes
import app.lifeos.kt.data.logic.labelsFor
import app.lifeos.kt.data.newId
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.crypto.Cipher
import javax.inject.Inject
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/** A note as shown: a locked one reads as "Locked note" until the vault is open. */
data class NoteView(val note: Note, val locked: Boolean, val title: String, val body: String?, val readable: Boolean)

data class NotesState(
    val notes: List<NoteView>,
    val labels: List<String>,
    val focus: String?,
    val unlocked: Boolean,
    val fingerprint: Boolean,
    /** Any locked note's text, to check a passphrase against; null when there are none yet. */
    val lockCheck: String?,
)

@HiltViewModel
class NotesViewModel @Inject constructor(
    private val planner: PlannerRepository,
    private val vault: Vault,
    private val settings: AppSettings,
) : ViewModel() {
    val state: StateFlow<NotesState?> = combine(planner.notes, settings.notesFocus, vault.unlocked, vault.fingerprintEnabled) { notes, focus, unlocked, fingerprint ->
        val live = notes.filter { !it.archived }
        NotesState(
            notes = live.map { note ->
                val locked = VaultCrypto.isLocked(note.body)
                val opened = if (locked && unlocked) vault.open(note.body!!) else null
                when {
                    !locked -> NoteView(note, false, note.title, note.body, true)
                    opened != null -> NoteView(note, true, opened.title, opened.body, true)
                    else -> NoteView(note, true, VaultCrypto.LOCKED_TITLE, null, false)
                }
            },
            labels = allLabels(live),
            focus = focus,
            unlocked = unlocked,
            fingerprint = fingerprint,
            lockCheck = live.firstOrNull { VaultCrypto.isLocked(it.body) }?.body,
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    fun setFocus(label: String?) = viewModelScope.launch { settings.setNotesFocus(label) }

    suspend fun unlock(passphrase: String): Boolean = vault.unlock(passphrase.toCharArray(), state.value?.lockCheck)
    fun lock() = vault.lock()
    fun enrolCipher(): Cipher = vault.enrolCipher()
    fun finishEnrol(cipher: Cipher) = viewModelScope.launch { vault.finishEnrol(cipher) }
    suspend fun unlockCipher(): Cipher? = vault.unlockCipher()
    suspend fun finishUnlock(cipher: Cipher) = vault.finishUnlock(cipher)
    fun disableFingerprint() = viewModelScope.launch { vault.disableFingerprint() }

    /** Saves a note; a locked one is encrypted here first, title, text, checklist and all. */
    fun save(original: Note?, title: String, body: String, checklist: List<ChecklistItem>?, labels: List<String>, locked: Boolean, pinned: Boolean) = viewModelScope.launch {
        val base = original ?: Note(id = newId())
        val note = if (locked) {
            // A checklist becomes lines of text inside the lock, so no item stays readable on the server.
            val text = listOfNotNull(body.takeIf { it.isNotBlank() }, checklist?.joinToString("\n") { (if (it.done) "☑ " else "☐ ") + it.text }).joinToString("\n")
            base.copy(title = VaultCrypto.LOCKED_TITLE, body = vault.seal(title.trim(), text), checklist = null, tags = labelsFor(labels, text, locked = true), pinned = pinned)
        } else {
            base.copy(title = title.trim(), body = if (checklist != null) null else body, checklist = checklist, tags = labelsFor(labels, body, locked = false), pinned = pinned)
        }
        planner.save(note)
    }

    fun delete(note: Note) = viewModelScope.launch { planner.deleteNote(note) }
    fun restore(note: Note) = viewModelScope.launch { planner.save(note) }
}

private const val LOCKED_FILTER = "\u0000locked"

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun NotesScreen(back: @Composable () -> Unit, model: NotesViewModel = hiltViewModel()) {
    val state by model.state.collectAsStateWithLifecycle()
    val haptics = rememberHaptics()
    val undo = rememberUndo()
    var search by rememberSaveable { mutableStateOf("") }
    // null: follow the saved focus. Choosing a chip overrides it for this visit only.
    var chosen by rememberSaveable { mutableStateOf<String?>(null) }
    var showAll by rememberSaveable { mutableStateOf(false) }
    var editingId by rememberSaveable { mutableStateOf<String?>(null) }
    var creating by rememberSaveable { mutableStateOf(false) }
    var unlocking by rememberSaveable { mutableStateOf(false) }
    var choosingFocus by rememberSaveable { mutableStateOf(false) }

    LifePage(
        title = "Notes",
        navigationIcon = back,
        actions = {
            val s = state
            if (s != null && s.lockCheck != null) {
                IconButton(onClick = { haptics.tick(); if (s.unlocked) model.lock() else unlocking = true }) {
                    Icon(if (s.unlocked) Icons.Outlined.LockOpen else Icons.Outlined.Lock, if (s.unlocked) "Lock notes" else "Unlock notes")
                }
            }
            IconButton(onClick = { choosingFocus = true }) { Icon(Icons.Outlined.CenterFocusStrong, "Focus") }
        },
        floatingActionButton = { ExtendedFloatingActionButton(onClick = { creating = true }, icon = { Icon(Icons.Filled.Add, null) }, text = { Text("Note") }) },
    ) {
        val s = state ?: run { items(3) { Skeleton() }; return@LifePage }
        val focusActive = s.focus != null && !showAll && chosen == null
        val label = chosen ?: if (focusActive) s.focus else null

        if (focusActive) {
            item {
                LifeCard(color = MaterialTheme.colorScheme.primaryContainer) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Outlined.CenterFocusStrong, null, tint = MaterialTheme.colorScheme.onPrimaryContainer)
                        Spacer(Modifier.width(10.dp))
                        Column(Modifier.weight(1f)) {
                            Text("Focus: #${s.focus}", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onPrimaryContainer)
                            Muted("Only #${s.focus} notes show here.", style = MaterialTheme.typography.bodySmall)
                        }
                        TextButton(onClick = { haptics.tick(); showAll = true }) { Text("Show all") }
                    }
                }
            }
        }
        item {
            OutlinedTextField(
                value = search,
                onValueChange = { search = it },
                placeholder = { Text("Search notes") },
                leadingIcon = { Icon(Icons.Outlined.Search, null) },
                trailingIcon = { if (search.isNotEmpty()) IconButton(onClick = { search = "" }) { Icon(Icons.Outlined.Close, "Clear search") } },
                singleLine = true,
                shape = MaterialTheme.shapes.medium,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        if (s.labels.isNotEmpty() || s.lockCheck != null) {
            item {
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    SelectChip(label == null, "All", { chosen = null; showAll = true })
                    for (tag in s.labels) SelectChip(label.equals(tag, ignoreCase = true), "#$tag", { chosen = if (chosen == tag) null else tag })
                    if (s.lockCheck != null) SelectChip(label == LOCKED_FILTER, "Locked", { chosen = if (chosen == LOCKED_FILTER) null else LOCKED_FILTER }, leadingIcon = Icons.Outlined.Lock)
                }
            }
        }
        val shown = if (label == LOCKED_FILTER) {
            filterNotes(s.notes.filter { it.locked }.map { it.note }, null, search) { n -> s.notes.first { it.note.id == n.id }.let { "${it.title} ${it.body.orEmpty()}" } }
        } else {
            filterNotes(s.notes.map { it.note }, label, search) { n -> s.notes.first { it.note.id == n.id }.let { v -> "${v.title} ${v.body.orEmpty()} ${v.note.checklist.orEmpty().joinToString(" ") { it.text }} ${v.note.tags.joinToString(" ")}" } }
        }.map { n -> s.notes.first { it.note.id == n.id } }
        if (shown.isEmpty()) {
            item {
                EmptyState(
                    Icons.Outlined.EditNote,
                    if (search.isNotBlank()) "No notes match “$search”" else if (label != null && label != LOCKED_FILTER) "No #$label notes yet" else "No notes yet",
                    "Tap Note to write one. Type #words to label it.",
                )
            }
        }
        items(shown, key = { it.note.id }) { view ->
            LifeCard(Modifier.animateItem(), onClick = { if (view.locked && !view.readable) unlocking = true else editingId = view.note.id }) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (view.locked) {
                        Icon(if (view.readable) Icons.Outlined.LockOpen else Icons.Outlined.Lock, "Locked", tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                    }
                    Text(view.title.ifBlank { "Untitled" }, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                    if (view.note.pinned) Icon(Icons.Outlined.PushPin, "Pinned", tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(18.dp))
                }
                when {
                    !view.readable -> Muted("Tap to unlock", style = MaterialTheme.typography.bodySmall)
                    view.note.checklist != null -> {
                        val items = view.note.checklist
                        Muted("${items.count { it.done }} of ${items.size} done · " + items.take(3).joinToString(", ") { it.text }, maxLines = 2)
                    }
                    !view.body.isNullOrBlank() -> Muted(view.body, maxLines = 4)
                }
                if (view.note.tags.isNotEmpty()) Muted(view.note.tags.joinToString("  ") { "#$it" }, style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(top = 6.dp))
            }
        }
    }

    val s = state
    val editing = s?.notes?.firstOrNull { it.note.id == editingId }
    if ((creating || editing != null) && s != null) {
        NoteEditor(
            view = editing,
            labels = s.labels,
            presetLabel = if (editing == null) (chosen?.takeIf { it != LOCKED_FILTER } ?: s.focus?.takeIf { !showAll }) else null,
            unlocked = s.unlocked,
            needUnlock = { unlocking = true },
            close = { creating = false; editingId = null },
            save = { title, body, checklist, labels, locked, pinned ->
                haptics.confirm()
                model.save(editing?.note, title, body, checklist, labels, locked, pinned)
                creating = false
                editingId = null
            },
            delete = {
                val note = editing!!.note
                model.delete(note)
                editingId = null
                undo("Note deleted") { model.restore(note) }
            },
        )
    }
    if (unlocking && s != null) UnlockSheet(s, model, close = { unlocking = false })
    if (choosingFocus && s != null) FocusSheet(s, set = { model.setFocus(it); showAll = false; chosen = null; choosingFocus = false }, close = { choosingFocus = false })
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
private fun NoteEditor(
    view: NoteView?,
    labels: List<String>,
    presetLabel: String?,
    unlocked: Boolean,
    needUnlock: () -> Unit,
    close: () -> Unit,
    save: (String, String, List<ChecklistItem>?, List<String>, Boolean, Boolean) -> Unit,
    delete: () -> Unit,
) {
    val haptics = rememberHaptics()
    val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val key = view?.note?.id ?: "new"
    var title by rememberSaveable(key) { mutableStateOf(view?.title.orEmpty()) }
    var body by rememberSaveable(key) { mutableStateOf(view?.body.orEmpty()) }
    var checklist by remember(key) { mutableStateOf(view?.note?.checklist) }
    var chosen by rememberSaveable(key) { mutableStateOf(view?.note?.tags ?: listOfNotNull(presetLabel)) }
    var newLabel by rememberSaveable(key) { mutableStateOf("") }
    var locked by rememberSaveable(key) { mutableStateOf(view?.locked ?: false) }
    var pinned by rememberSaveable(key) { mutableStateOf(view?.note?.pinned ?: false) }
    var wantLock by rememberSaveable(key) { mutableStateOf(false) }
    var newItem by rememberSaveable(key) { mutableStateOf("") }

    ModalBottomSheet(onDismissRequest = close, sheetState = sheet) {
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).navigationBarsPadding().imePadding().padding(bottom = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            OutlinedTextField(value = title, onValueChange = { title = it }, placeholder = { Text("Title") }, singleLine = true, textStyle = MaterialTheme.typography.titleLarge, shape = MaterialTheme.shapes.medium, keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences), modifier = Modifier.fillMaxWidth())
            val items = checklist
            if (items != null) {
                Column {
                    for (item in items) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            IconButton(onClick = { if (!item.done) haptics.confirm() else haptics.tick(); checklist = items.map { if (it.id == item.id) it.copy(done = !it.done) else it } }) {
                                Icon(if (item.done) Icons.Filled.CheckBox else Icons.Outlined.CheckBoxOutlineBlank, if (item.done) "Mark not done" else "Mark done", tint = if (item.done) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            Text(item.text, modifier = Modifier.weight(1f), textDecoration = if (item.done) TextDecoration.LineThrough else null)
                            IconButton(onClick = { checklist = items.filter { it.id != item.id } }) { Icon(Icons.Outlined.Close, "Remove item", tint = MaterialTheme.colorScheme.onSurfaceVariant) }
                        }
                    }
                    OutlinedTextField(
                        value = newItem,
                        onValueChange = { newItem = it },
                        placeholder = { Text("Add an item") },
                        singleLine = true,
                        shape = MaterialTheme.shapes.medium,
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                        keyboardActions = KeyboardActions(onDone = {
                            if (newItem.isNotBlank()) { checklist = items + ChecklistItem(newId(), newItem.trim()); newItem = ""; haptics.tick() }
                        }),
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            } else {
                OutlinedTextField(value = body, onValueChange = { body = it }, placeholder = { Text("Write… #labels work too") }, shape = MaterialTheme.shapes.medium, keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences), modifier = Modifier.fillMaxWidth().heightIn(min = 180.dp))
                if (view == null) TextButton(onClick = { checklist = emptyList() }) { Text("Make it a checklist") }
            }

            Eyebrow("Labels")
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                for (tag in (labels + chosen).distinctBy { it.lowercase() }) {
                    SelectChip(chosen.any { it.equals(tag, true) }, "#$tag", { chosen = if (chosen.any { it.equals(tag, true) }) chosen.filterNot { it.equals(tag, true) } else chosen + tag })
                }
            }
            OutlinedTextField(
                value = newLabel,
                onValueChange = { newLabel = it.replace(" ", "") },
                placeholder = { Text("New label, e.g. Work") },
                singleLine = true,
                shape = MaterialTheme.shapes.medium,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(onDone = { if (newLabel.isNotBlank()) { chosen = chosen + newLabel.removePrefix("#"); newLabel = ""; haptics.tick() } }),
                modifier = Modifier.fillMaxWidth(),
            )

            // Asked to lock while the vault is closed: once it opens, the lock turns on by itself.
            LaunchedEffect(unlocked) { if (unlocked && wantLock) { locked = true; wantLock = false } }
            val setLocked = { on: Boolean ->
                haptics.tick()
                if (on && !unlocked) { wantLock = true; needUnlock() } else locked = on
            }
            Row(
                Modifier.fillMaxWidth().clip(MaterialTheme.shapes.small).toggleable(locked, role = Role.Switch, onValueChange = setLocked).padding(vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    Text("Lock this note", style = MaterialTheme.typography.bodyLarge)
                    Muted("Encrypted on this phone. The server only keeps unreadable text; labels stay readable so you can filter.", style = MaterialTheme.typography.bodySmall)
                }
                Switch(checked = locked, onCheckedChange = null)
            }
            Row(
                Modifier.fillMaxWidth().clip(MaterialTheme.shapes.small).toggleable(pinned, role = Role.Switch) { haptics.tick(); pinned = it }.padding(vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("Pin to the top", style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
                Switch(checked = pinned, onCheckedChange = null)
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (view != null) TextButton(onClick = delete) { Text("Delete", color = MaterialTheme.colorScheme.error) }
                Spacer(Modifier.weight(1f))
                Button(
                    onClick = {
                        val empty = title.isBlank() && body.isBlank() && checklist.isNullOrEmpty()
                        when {
                            empty -> haptics.reject()
                            locked && !unlocked -> needUnlock()
                            else -> save(title, body, checklist, chosen, locked, pinned)
                        }
                    },
                    shape = MaterialTheme.shapes.medium,
                ) { Text("Save") }
            }
        }
    }
}

/** The passphrase (first time: choose one), or the fingerprint once it's set up. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun UnlockSheet(s: NotesState, model: NotesViewModel, close: () -> Unit) {
    val context = LocalContext.current
    val activity = context as? FragmentActivity
    val haptics = rememberHaptics()
    val toast = rememberToast()
    val scope = rememberCoroutineScope()
    val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val firstTime = s.lockCheck == null
    var passphrase by remember { mutableStateOf("") }
    var again by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var working by remember { mutableStateOf(false) }
    var offerFingerprint by remember { mutableStateOf(false) }
    val canFingerprint = BiometricManager.from(context).canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) == BiometricManager.BIOMETRIC_SUCCESS

    fun prompt(title: String, cipher: Cipher, done: (Cipher) -> Unit) {
        val host = activity ?: return
        BiometricPrompt(host, ContextCompat.getMainExecutor(host), object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                result.cryptoObject?.cipher?.let(done)
            }
        }).authenticate(
            BiometricPrompt.PromptInfo.Builder().setTitle(title).setNegativeButtonText("Use passphrase").setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG).build(),
            BiometricPrompt.CryptoObject(cipher),
        )
    }

    fun fingerprintUnlock() = scope.launch {
        val cipher = model.unlockCipher()
        if (cipher == null) {
            toast("Fingerprint unlock was reset by a change on the phone. Use your passphrase.")
            return@launch
        }
        prompt("Unlock locked notes", cipher) { approved ->
            scope.launch {
                if (model.finishUnlock(approved)) { haptics.confirm(); close() } else error = "That didn't open the vault. Use your passphrase."
            }
        }
    }

    ModalBottomSheet(onDismissRequest = close, sheetState = sheet) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp).navigationBarsPadding().imePadding().padding(bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            if (offerFingerprint) {
                Text("Unlock with your fingerprint next time?", style = MaterialTheme.typography.titleLarge)
                Muted("Your passphrase stays the way in on other phones and the website.")
                Row {
                    TextButton(onClick = close) { Text("Not now") }
                    Spacer(Modifier.weight(1f))
                    Button(onClick = {
                        prompt("Turn on fingerprint unlock", model.enrolCipher()) { approved -> model.finishEnrol(approved); haptics.confirm(); toast("Fingerprint unlock is on"); close() }
                    }, shape = MaterialTheme.shapes.medium) {
                        Icon(Icons.Outlined.Fingerprint, null)
                        Spacer(Modifier.width(8.dp))
                        Text("Turn on")
                    }
                }
                return@Column
            }
            Text(if (firstTime) "Choose a passphrase" else "Unlock locked notes", style = MaterialTheme.typography.titleLarge)
            Muted(
                if (firstTime) "Locked notes are encrypted with it on this phone. Nobody can reset it or read the notes without it, not even Life OS — keep it somewhere safe."
                else "Your passphrase opens them on this phone until you leave the app.",
            )
            if (!firstTime && s.fingerprint) {
                OutlinedButton(onClick = { fingerprintUnlock() }, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth()) {
                    Icon(Icons.Outlined.Fingerprint, null)
                    Spacer(Modifier.width(8.dp))
                    Text("Use fingerprint")
                }
            }
            OutlinedTextField(value = passphrase, onValueChange = { passphrase = it; error = null }, label = { Text("Passphrase") }, singleLine = true, visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password), shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth())
            if (firstTime) {
                OutlinedTextField(value = again, onValueChange = { again = it; error = null }, label = { Text("Same passphrase again") }, singleLine = true, visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password), shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth())
            }
            AnimatedVisibility(error != null) { Text(error.orEmpty(), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium) }
            Button(
                enabled = !working,
                onClick = {
                    error = when {
                        passphrase.length < 8 -> "Use at least 8 characters; a few words is best."
                        firstTime && passphrase != again -> "The two don't match."
                        else -> null
                    }
                    if (error != null) { haptics.reject(); return@Button }
                    working = true
                    scope.launch {
                        val ok = model.unlock(passphrase)
                        working = false
                        if (!ok) {
                            haptics.reject()
                            error = "That passphrase doesn't open your locked notes."
                        } else {
                            haptics.confirm()
                            if (canFingerprint && !s.fingerprint && activity != null) offerFingerprint = true else close()
                        }
                    }
                },
                shape = MaterialTheme.shapes.medium,
                modifier = Modifier.fillMaxWidth(),
            ) { Text(if (working) "Opening…" else if (firstTime) "Set passphrase" else "Unlock") }
            if (!firstTime && s.fingerprint) TextButton(onClick = { model.disableFingerprint(); toast("Fingerprint unlock is off") }) { Text("Turn off fingerprint unlock") }
        }
    }
}

/** "When I open Notes, show only…" — remembered on this phone. */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
private fun FocusSheet(s: NotesState, set: (String?) -> Unit, close: () -> Unit) {
    val sheet = rememberModalBottomSheetState()
    ModalBottomSheet(onDismissRequest = close, sheetState = sheet) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp).navigationBarsPadding().padding(bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Focus", style = MaterialTheme.typography.titleLarge)
            Muted("When you open Notes, show only one label — for example #Work while you're at work. Everything else stays one tap away.")
            if (s.labels.isEmpty()) Muted("Add a label to a note first (type #Work in it, or pick one in the note).")
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                SelectChip(s.focus == null, "Everything", { set(null) })
                for (tag in s.labels) SelectChip(s.focus.equals(tag, true), "#$tag", { set(tag) })
            }
        }
    }
}
