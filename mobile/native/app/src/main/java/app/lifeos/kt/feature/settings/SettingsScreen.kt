package app.lifeos.kt.feature.settings

import android.os.Build
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowRight
import androidx.compose.material.icons.outlined.AccountBalanceWallet
import androidx.compose.material.icons.outlined.DarkMode
import androidx.compose.material.icons.outlined.Dashboard
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.Palette
import androidx.compose.material.icons.outlined.NotificationsNone
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import app.lifeos.kt.core.designsystem.PickTime
import app.lifeos.kt.core.notify.canNotify
import app.lifeos.kt.core.notify.canRingOnTime
import app.lifeos.kt.core.notify.readReminderSettings
import app.lifeos.kt.core.notify.writeReminderSettings
import app.lifeos.kt.data.logic.ReminderSettings
import kotlinx.coroutines.flow.map
import androidx.compose.material.icons.outlined.PersonOutline
import androidx.compose.material.icons.outlined.PhoneAndroid
import androidx.compose.material.icons.outlined.Storage
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.lifeos.kt.core.datastore.AppSettings
import app.lifeos.kt.core.datastore.SessionState
import app.lifeos.kt.core.designsystem.LifeCard
import app.lifeos.kt.core.designsystem.LifePage
import app.lifeos.kt.core.designsystem.LocalSyncStatus
import app.lifeos.kt.core.designsystem.Muted
import app.lifeos.kt.core.designsystem.SectionHeader
import app.lifeos.kt.core.designsystem.IconBadge
import app.lifeos.kt.core.designsystem.SelectChip
import app.lifeos.kt.core.designsystem.rememberHaptics
import app.lifeos.kt.core.designsystem.rememberToast
import app.lifeos.kt.core.designsystem.syncLine
import app.lifeos.kt.core.model.BodyStats
import app.lifeos.kt.core.model.Profile
import app.lifeos.kt.core.model.UserPreferences
import app.lifeos.kt.data.AccountRepository
import app.lifeos.kt.data.MODULES
import app.lifeos.kt.data.SettingsRepository
import app.lifeos.kt.data.moduleOn
import app.lifeos.kt.data.toggleModule
import app.lifeos.kt.feature.money.MoneyViewModel
import app.lifeos.kt.feature.money.PaydaySheet
import app.lifeos.kt.feature.spirit.PrayerSetupSheet
import app.lifeos.kt.feature.spirit.SpiritViewModel
import dagger.hilt.android.lifecycle.HiltViewModel
import java.io.IOException
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import javax.inject.Inject
import kotlin.math.roundToInt
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/** A part of Settings, as on the website (src/data/settingsSections.ts). [module]: shown only while that area is on. */
enum class SettingsPart(val label: String, val description: String, val icon: ImageVector, val module: String? = null) {
    Profile("Profile", "Your name, units and formats.", Icons.Outlined.PersonOutline),
    Areas("Areas", "Choose which parts of Life OS you see.", Icons.Outlined.Dashboard),
    Reminders("Reminders", "Prayers, azkar, tasks and water, on this phone.", Icons.Outlined.NotificationsNone),
    Prayer("Prayer", "Location and calculation method.", Icons.Outlined.DarkMode, "spirit"),
    Money("Money", "Payday, buffer and currency.", Icons.Outlined.AccountBalanceWallet, "money"),
    Body("Body", "Height and target weight.", Icons.Outlined.FavoriteBorder, "body"),
    Phone("This phone", "Haptics and wallpaper colours.", Icons.Outlined.PhoneAndroid),
    Look("Look", "Light, dark or the phone's choice.", Icons.Outlined.Palette),
    Data("Your data", "Sync, export, sign out and deleting your account.", Icons.Outlined.Storage),
}

data class SettingsState(
    val prefs: UserPreferences?,
    val profile: Profile?,
    val body: BodyStats?,
    val theme: String,
    val haptics: Boolean,
    val dynamicColor: Boolean,
)

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val repo: SettingsRepository,
    private val settings: AppSettings,
    private val account: AccountRepository,
) : ViewModel() {
    val state: StateFlow<SettingsState?> = combine(
        repo.preferences, repo.profile, repo.bodyStats,
        combine(settings.theme, settings.haptics, settings.dynamicColor) { t, h, d -> Triple(t, h, d) },
    ) { p, profile, body, (theme, haptics, dynamic) -> SettingsState(p, profile, body, theme, haptics, dynamic) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    val email: String? get() = (account.state.value as? SessionState.SignedIn)?.session?.email
    val isDemo: Boolean get() = repo.isDemo

    fun prefs(s: SettingsState, change: (UserPreferences) -> UserPreferences) = viewModelScope.launch { repo.savePreferences(s.prefs, change) }
    fun saveName(s: SettingsState, name: String) = viewModelScope.launch { repo.saveName(s.profile, name) }
    fun saveBody(s: SettingsState, heightCm: Double?, targetKg: Double?) = viewModelScope.launch { repo.saveBody(s.body, heightCm, targetKg) }
    fun setTheme(value: String) = viewModelScope.launch { settings.setTheme(value) }
    val reminders: StateFlow<ReminderSettings> = settings.reminders.map(::readReminderSettings).stateIn(viewModelScope, SharingStarted.Eagerly, ReminderSettings())
    fun setReminders(change: (ReminderSettings) -> ReminderSettings) = viewModelScope.launch { settings.setReminders(writeReminderSettings(change(reminders.value))) }
    fun setHaptics(on: Boolean) = viewModelScope.launch { settings.setHaptics(on) }
    fun setDynamicColor(on: Boolean) = viewModelScope.launch { settings.setDynamicColor(on) }
    fun signOut() = viewModelScope.launch { account.signOut() }
    suspend fun export(): String = repo.exportJson()
    suspend fun deleteAccount() = repo.deleteAccount()
}

/** Settings: a short list of parts; each opens on its own page (back returns to the list). */
@Composable
fun SettingsScreen(back: @Composable () -> Unit, model: SettingsViewModel = hiltViewModel()) {
    val s by model.state.collectAsStateWithLifecycle()
    var part by rememberSaveable { mutableStateOf<SettingsPart?>(null) }
    BackHandler(enabled = part != null) { part = null }
    val state = s ?: return
    AnimatedContent(
        targetState = part,
        transitionSpec = {
            val forward = targetState != null
            (slideInHorizontally(tween(260)) { if (forward) it / 4 else -it / 4 } + fadeIn(tween(220))) togetherWith
                (slideOutHorizontally(tween(200)) { if (forward) -it / 4 else it / 4 } + fadeOut(tween(160)))
        },
        label = "settings",
    ) { current ->
        if (current == null) SettingsList(state, back) { part = it }
        else {
            val up: @Composable () -> Unit = { IconButton(onClick = { part = null }) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back to Settings") } }
            when (current) {
                SettingsPart.Profile -> ProfilePage(state, model, up)
                SettingsPart.Areas -> AreasPage(state, model, up)
                SettingsPart.Reminders -> RemindersPage(model, up)
                SettingsPart.Prayer -> PrayerPage(up)
                SettingsPart.Money -> MoneyPage(state, model, up)
                SettingsPart.Body -> BodyPage(state, model, up)
                SettingsPart.Phone -> PhonePage(state, model, up)
                SettingsPart.Look -> LookPage(state, model, up)
                SettingsPart.Data -> DataPage(model, up)
            }
        }
    }
}

@Composable
private fun SettingsList(s: SettingsState, back: @Composable () -> Unit, open: (SettingsPart) -> Unit) {
    val haptics = rememberHaptics()
    val enabled = s.prefs?.enabledModules
    LifePage(title = "Settings", subtitle = "Set things up once. Pick a part to open it.", navigationIcon = back) {
        item {
            LifeCard(contentPadding = PaddingValues(vertical = 4.dp)) {
                val parts = SettingsPart.entries.filter { it.module == null || moduleOn(enabled, it.module) }
                parts.forEachIndexed { index, item ->
                    TextButton(
                        onClick = { haptics.tick(); open(item) },
                        modifier = Modifier.fillMaxWidth(),
                        shape = MaterialTheme.shapes.small,
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
                    ) {
                        IconBadge(item.icon, size = 36.dp)
                        Spacer(Modifier.width(14.dp))
                        Column(Modifier.weight(1f)) {
                            Text(item.label, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurface)
                            Muted(item.description, style = MaterialTheme.typography.bodySmall)
                        }
                        Icon(Icons.AutoMirrored.Outlined.KeyboardArrowRight, null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    if (index < parts.lastIndex) HorizontalDivider(Modifier.padding(start = 66.dp), color = MaterialTheme.colorScheme.outlineVariant)
                }
            }
        }
    }
}

/* -------------------------------- profile -------------------------------- */

/** The web's date formats (src/lib/format.ts): stored value → pattern, shown as today's date in each. */
val DATE_FORMATS = listOf("dmy" to "d MMM yyyy", "mdy" to "MMM d, yyyy", "iso" to "yyyy-MM-dd")

/** Week starts the web offers first (0 = Sunday … 6 = Saturday, as on the web). */
val WEEK_STARTS = listOf(6 to "Saturday", 0 to "Sunday", 1 to "Monday")

@OptIn(ExperimentalLayoutApi::class, ExperimentalMaterial3Api::class)
@Composable
private fun ProfilePage(s: SettingsState, model: SettingsViewModel, up: @Composable () -> Unit) {
    val haptics = rememberHaptics()
    val toast = rememberToast()
    var name by rememberSaveable(s.profile?.displayName) { mutableStateOf(s.profile?.displayName.orEmpty()) }
    val prefs = s.prefs
    LifePage(title = "Profile", navigationIcon = up) {
        item {
            LifeCard {
                Text("Your name", style = MaterialTheme.typography.titleMedium)
                Muted("Used across the app instead of your email.", style = MaterialTheme.typography.bodySmall)
                Spacer(Modifier.height(10.dp))
                OutlinedTextField(name, { name = it }, label = { Text("Display name") }, singleLine = true, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth())
                model.email?.let { Muted("Signed in as $it", Modifier.padding(top = 8.dp), style = MaterialTheme.typography.bodySmall) }
                Spacer(Modifier.height(10.dp))
                Button(
                    onClick = { haptics.confirm(); model.saveName(s, name); toast("Name saved") },
                    enabled = name.trim() != s.profile?.displayName.orEmpty(),
                    shape = MaterialTheme.shapes.medium,
                ) { Text("Save name") }
            }
        }
        item { SectionHeader("Units and formats") }
        item {
            LifeCard {
                Muted("These change how values are shown. Your data is always stored the same way.", style = MaterialTheme.typography.bodySmall)
                Spacer(Modifier.height(12.dp))
                Label("Units")
                Segmented(listOf("metric" to "Metric (kg, cm)", "imperial" to "Imperial (lb, in)"), prefs?.unitSystem ?: "metric") { v -> model.prefs(s) { it.copy(unitSystem = v) } }
                Spacer(Modifier.height(14.dp))
                Label("Time")
                Segmented(listOf("24h" to "24-hour", "12h" to "12-hour"), prefs?.timeFormat ?: "24h") { v -> model.prefs(s) { it.copy(timeFormat = v) } }
                Spacer(Modifier.height(14.dp))
                Label("Week starts on")
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    for ((day, label) in WEEK_STARTS) SelectChip((prefs?.weekStart ?: 1) == day, label, { haptics.tick(); model.prefs(s) { it.copy(weekStart = day) } })
                }
                Spacer(Modifier.height(14.dp))
                Label("Dates")
                val today = LocalDate.now()
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    for ((value, pattern) in DATE_FORMATS) {
                        SelectChip((prefs?.dateFormat ?: "dmy") == value, today.format(DateTimeFormatter.ofPattern(pattern)), { haptics.tick(); model.prefs(s) { it.copy(dateFormat = value) } })
                    }
                }
            }
        }
    }
}

/* ------------------------------- reminders ------------------------------- */

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun RemindersPage(model: SettingsViewModel, up: @Composable () -> Unit) {
    val r by model.reminders.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val haptics = rememberHaptics()
    // Permissions can change in the phone's settings; read them again whenever we come back.
    var resumed by remember { mutableIntStateOf(0) }
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { resumed++ }
    val notify = remember(resumed) { canNotify(context) }
    val onTime = remember(resumed) { canRingOnTime(context) }
    val ask = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { resumed++ }
    var pickTasks by rememberSaveable { mutableStateOf(false) }
    var pickWaterFrom by rememberSaveable { mutableStateOf(false) }
    var pickWaterTo by rememberSaveable { mutableStateOf(false) }

    LifePage(title = "Reminders", subtitle = "They ring on this phone, even with no internet.", navigationIcon = up) {
        if (!notify || !onTime) item {
            LifeCard {
                if (!notify) {
                    Text("Notifications are off for Life OS", style = MaterialTheme.typography.titleMedium)
                    Muted("Nothing below can ring until they're allowed.", Modifier.padding(top = 4.dp))
                    Spacer(Modifier.height(10.dp))
                    Button(onClick = {
                        haptics.tick()
                        if (Build.VERSION.SDK_INT >= 33) ask.launch(android.Manifest.permission.POST_NOTIFICATIONS)
                        else context.startActivity(android.content.Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, context.packageName))
                    }, shape = MaterialTheme.shapes.medium) { Text("Allow notifications") }
                }
                if (notify && !onTime && Build.VERSION.SDK_INT >= 31) {
                    Text("Reminders may come a few minutes late", style = MaterialTheme.typography.titleMedium)
                    Muted("Allow \"Alarms and reminders\" so a prayer reminder rings on the minute.", Modifier.padding(top = 4.dp))
                    Spacer(Modifier.height(10.dp))
                    OutlinedButton(onClick = {
                        haptics.tick()
                        context.startActivity(android.content.Intent(android.provider.Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, android.net.Uri.parse("package:${context.packageName}")))
                    }, shape = MaterialTheme.shapes.medium) { Text("Allow on-time reminders") }
                }
            }
        }
        item { SectionHeader("Prayers") }
        item {
            LifeCard(contentPadding = PaddingValues(vertical = 4.dp)) {
                SwitchRow("Before each prayer", "Only for prayers you haven't logged yet.", r.enabled) { on -> model.setReminders { it.copy(enabled = on) } }
                if (r.enabled) {
                    Column(Modifier.padding(horizontal = 16.dp).padding(bottom = 10.dp)) {
                        Muted("How long before", style = MaterialTheme.typography.bodySmall)
                        Spacer(Modifier.height(6.dp))
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            for (m in listOf(5, 10, 15, 20, 30)) SelectChip(r.leadMinutes == m, "$m min", { haptics.tick(); model.setReminders { it.copy(leadMinutes = m) } })
                            SelectChip(r.leadMinutes == 0, "Only at the time", { haptics.tick(); model.setReminders { it.copy(leadMinutes = 0) } })
                        }
                    }
                    Divider()
                    SwitchRow("At the prayer time", "With buttons to log it right from the notification.", r.atTime || r.leadMinutes == 0) { on -> model.setReminders { it.copy(atTime = on) } }
                    Divider()
                    SwitchRow("Before the time ends", "If it still isn't logged 5 minutes before its time runs out.", r.clutch) { on -> model.setReminders { it.copy(clutch = on) } }
                }
                Divider()
                SwitchRow("Morning and evening azkar", "After Fajr and after Asr, until you've read them.", r.azkar) { on -> model.setReminders { it.copy(azkar = on) } }
                if (r.azkar) {
                    FlowRow(Modifier.padding(horizontal = 16.dp).padding(bottom = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        for (m in listOf(10, 20, 30, 45, 60)) SelectChip(r.azkarDelay == m, "$m min after", { haptics.tick(); model.setReminders { it.copy(azkarDelay = m) } })
                    }
                }
            }
        }
        item { SectionHeader("Tasks") }
        item {
            LifeCard(contentPadding = PaddingValues(vertical = 4.dp)) {
                SwitchRow("What's due today", "One list each morning, and tasks with a time ring at that time.", r.tasksEnabled) { on -> model.setReminders { it.copy(tasksEnabled = on) } }
                if (r.tasksEnabled) TimeRow("Each day at", r.taskTime) { haptics.tick(); pickTasks = true }
            }
        }
        item { SectionHeader("Water") }
        item {
            LifeCard(contentPadding = PaddingValues(vertical = 4.dp)) {
                SwitchRow("A glass of water", "Every so often through the day.", r.water) { on -> model.setReminders { it.copy(water = on) } }
                if (r.water) {
                    FlowRow(Modifier.padding(horizontal = 16.dp).padding(bottom = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        for (m in listOf(60, 90, 120)) SelectChip(r.waterEvery == m, if (m % 60 == 0) "Every ${m / 60} h" else "Every ${m / 60} h ${m % 60} min", { haptics.tick(); model.setReminders { it.copy(waterEvery = m) } })
                    }
                    TimeRow("From", r.waterFrom) { haptics.tick(); pickWaterFrom = true }
                    TimeRow("Until", r.waterTo) { haptics.tick(); pickWaterTo = true }
                }
            }
        }
        item { Muted("Your own reminders (More → Reminders) always ring, whatever is set here.", Modifier.padding(horizontal = 4.dp, vertical = 8.dp), style = MaterialTheme.typography.bodySmall) }
    }
    fun timeOf(v: String) = runCatching { java.time.LocalTime.parse(v.take(5)) }.getOrDefault(java.time.LocalTime.of(9, 0))
    fun hhmm(t: java.time.LocalTime) = "%02d:%02d".format(t.hour, t.minute)
    if (pickTasks) PickTime(timeOf(r.taskTime), { pickTasks = false }) { t -> model.setReminders { it.copy(taskTime = hhmm(t)) }; pickTasks = false }
    if (pickWaterFrom) PickTime(timeOf(r.waterFrom), { pickWaterFrom = false }) { t -> model.setReminders { it.copy(waterFrom = hhmm(t)) }; pickWaterFrom = false }
    if (pickWaterTo) PickTime(timeOf(r.waterTo), { pickWaterTo = false }) { t -> model.setReminders { it.copy(waterTo = hhmm(t)) }; pickWaterTo = false }
}

@Composable
private fun Divider() = HorizontalDivider(Modifier.padding(horizontal = 16.dp), color = MaterialTheme.colorScheme.outlineVariant)

@Composable
private fun TimeRow(label: String, value: String, onClick: () -> Unit) {
    TextButton(onClick = onClick, modifier = Modifier.fillMaxWidth(), shape = MaterialTheme.shapes.small, contentPadding = PaddingValues(horizontal = 16.dp, vertical = 10.dp)) {
        Text(label, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurface, modifier = Modifier.weight(1f))
        Text(value, style = MaterialTheme.typography.titleMedium)
    }
}

/* --------------------------------- areas --------------------------------- */

@Composable
private fun AreasPage(s: SettingsState, model: SettingsViewModel, up: @Composable () -> Unit) {
    val enabled = s.prefs?.enabledModules
    LifePage(title = "Areas", subtitle = "Switch off what you don't use. Nothing is deleted; switch it back on any time.", navigationIcon = up) {
        item {
            LifeCard(contentPadding = PaddingValues(vertical = 4.dp)) {
                MODULES.forEachIndexed { index, (key, label, description) ->
                    SwitchRow(label, description, moduleOn(enabled, key)) { on -> model.prefs(s) { it.copy(enabledModules = toggleModule(it.enabledModules, key, on)) } }
                    if (index < MODULES.lastIndex) HorizontalDivider(Modifier.padding(horizontal = 16.dp), color = MaterialTheme.colorScheme.outlineVariant)
                }
            }
        }
    }
}

/* -------------------------------- prayer --------------------------------- */

@Composable
private fun PrayerPage(up: @Composable () -> Unit, spirit: SpiritViewModel = hiltViewModel()) {
    val haptics = rememberHaptics()
    val s by spirit.state.collectAsStateWithLifecycle()
    var editing by rememberSaveable { mutableStateOf(false) }
    LifePage(title = "Prayer", navigationIcon = up) {
        item {
            LifeCard {
                val settings = s?.settings
                Text(
                    when {
                        settings?.city != null -> "Times are worked out for ${settings.city}."
                        settings != null -> "Times are worked out for your saved place."
                        else -> "Add a place once to see today's times."
                    },
                    style = MaterialTheme.typography.titleMedium,
                )
                settings?.let {
                    Muted(listOfNotNull(it.calcMethod?.let { m -> "Method: ${methodLabel(m)}" }, it.asrSchool?.let { a -> "Asr: ${if (a == "hanafi") "Hanafi" else "Shafi, Maliki, Hanbali"}" }).joinToString(" · "), Modifier.padding(top = 4.dp))
                }
                Muted("Worked out on this phone. Your place stays in your account and is never shared.", Modifier.padding(top = 8.dp), style = MaterialTheme.typography.bodySmall)
                Spacer(Modifier.height(12.dp))
                Button(onClick = { haptics.tick(); editing = true }, enabled = s != null, shape = MaterialTheme.shapes.medium) { Text(if (s?.settings == null) "Set up prayer times" else "Change place or method") }
            }
        }
    }
    s?.let { if (editing) PrayerSetupSheet(it, spirit, close = { editing = false }) }
}

private fun methodLabel(value: String) = value.replace(Regex("([a-z])([A-Z])"), "$1 $2")

/* --------------------------------- money --------------------------------- */

/** Currencies offered first; any other ISO code can be typed. */
val COMMON_CURRENCIES = listOf("EGP", "SAR", "AED", "KWD", "QAR", "USD", "EUR", "GBP")

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun MoneyPage(s: SettingsState, model: SettingsViewModel, up: @Composable () -> Unit, money: MoneyViewModel = hiltViewModel()) {
    val haptics = rememberHaptics()
    val m by money.state.collectAsStateWithLifecycle()
    var editing by rememberSaveable { mutableStateOf(false) }
    val current = s.prefs?.currency
    var other by rememberSaveable { mutableStateOf("") }
    LifePage(title = "Money", navigationIcon = up) {
        item {
            LifeCard {
                Text("Pay and buffer", style = MaterialTheme.typography.titleMedium)
                val c = m?.payday
                Muted(
                    when {
                        c == null -> "Not set up yet. Payday is what \"left to spend\" counts down to."
                        c.schedule == "monthly" -> "Paid on day ${c.payDay} of each month."
                        else -> "Paid every ${c.intervalWeeks} weeks."
                    },
                    Modifier.padding(top = 4.dp),
                )
                Spacer(Modifier.height(12.dp))
                Button(onClick = { haptics.tick(); editing = true }, enabled = m != null, shape = MaterialTheme.shapes.medium) { Text(if (c == null) "Set up payday" else "Edit pay and buffer") }
            }
        }
        item { SectionHeader("Currency") }
        item {
            LifeCard {
                Muted("Amounts are shown in this currency.", style = MaterialTheme.typography.bodySmall)
                Spacer(Modifier.height(10.dp))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    for (code in COMMON_CURRENCIES) SelectChip(current == code, code, { haptics.tick(); model.prefs(s) { it.copy(currency = code) } })
                    if (current != null && current !in COMMON_CURRENCIES) SelectChip(true, current, {})
                }
                Spacer(Modifier.height(10.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    OutlinedTextField(other, { other = it.uppercase().filter(Char::isLetter).take(3) }, label = { Text("Other code (e.g. JOD)") }, singleLine = true, shape = MaterialTheme.shapes.medium, modifier = Modifier.weight(1f))
                    Spacer(Modifier.width(8.dp))
                    OutlinedButton(
                        onClick = { haptics.confirm(); model.prefs(s) { it.copy(currency = other) }; other = "" },
                        enabled = other.length == 3 && runCatching { java.util.Currency.getInstance(other) }.isSuccess,
                        shape = MaterialTheme.shapes.medium,
                    ) { Text("Use") }
                }
            }
        }
    }
    m?.let { if (editing) PaydaySheet(it, money, close = { editing = false }) }
}

/* --------------------------------- body ---------------------------------- */

@Composable
private fun BodyPage(s: SettingsState, model: SettingsViewModel, up: @Composable () -> Unit) {
    val haptics = rememberHaptics()
    val toast = rememberToast()
    val imperial = s.prefs?.unitSystem == "imperial"
    fun show(v: Double?, factor: Double) = v?.let { ((it * factor) * 10).roundToInt() / 10.0 }?.let { if (it % 1.0 == 0.0) it.toInt().toString() else it.toString() }.orEmpty()
    var height by rememberSaveable(s.body?.heightCm, imperial) { mutableStateOf(show(s.body?.heightCm, if (imperial) 1 / 2.54 else 1.0)) }
    var target by rememberSaveable(s.body?.targetWeightKg, imperial) { mutableStateOf(show(s.body?.targetWeightKg, if (imperial) 2.20462 else 1.0)) }
    LifePage(title = "Body", navigationIcon = up) {
        item {
            LifeCard {
                Muted("Your current weight is logged in Body. A target is only shown beside your own logged weights.", style = MaterialTheme.typography.bodySmall)
                Spacer(Modifier.height(12.dp))
                NumberInput(height, { height = it }, if (imperial) "Height (in)" else "Height (cm)")
                Spacer(Modifier.height(10.dp))
                NumberInput(target, { target = it }, if (imperial) "Target weight (lb)" else "Target weight (kg)")
                Spacer(Modifier.height(12.dp))
                Button(
                    onClick = {
                        val h = height.toDoubleOrNull()?.let { if (imperial) it * 2.54 else it }
                        val t = target.toDoubleOrNull()?.let { if (imperial) it / 2.20462 else it }
                        if ((h != null && h !in 50.0..260.0) || (t != null && t !in 20.0..400.0)) {
                            haptics.reject(); toast("Check the numbers: they look out of range.")
                        } else {
                            haptics.confirm(); model.saveBody(s, h, t); toast("Body setup saved")
                        }
                    },
                    shape = MaterialTheme.shapes.medium,
                ) { Text("Save") }
            }
        }
    }
}

/* ------------------------------ phone, look ------------------------------ */

@Composable
private fun PhonePage(s: SettingsState, model: SettingsViewModel, up: @Composable () -> Unit) {
    LifePage(title = "This phone", subtitle = "Settings that stay on this phone only.", navigationIcon = up) {
        item {
            LifeCard(contentPadding = PaddingValues(vertical = 4.dp)) {
                SwitchRow("Haptic feedback", "A light touch when you finish, log or swipe.", s.haptics, model::setHaptics)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    HorizontalDivider(Modifier.padding(horizontal = 16.dp), color = MaterialTheme.colorScheme.outlineVariant)
                    SwitchRow("Wallpaper colours", "Use your wallpaper's colours instead of Life OS's.", s.dynamicColor, model::setDynamicColor)
                }
            }
        }
    }
}

@Composable
private fun LookPage(s: SettingsState, model: SettingsViewModel, up: @Composable () -> Unit) {
    LifePage(title = "Look", navigationIcon = up) {
        item {
            LifeCard {
                Label("Theme")
                Segmented(listOf("light" to "Light", "dark" to "Dark", "system" to "Phone"), s.theme) { model.setTheme(it) }
                Muted("\"Phone\" follows your phone's light or dark setting.", Modifier.padding(top = 8.dp), style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

/* ------------------------------- your data ------------------------------- */

@Composable
private fun DataPage(model: SettingsViewModel, up: @Composable () -> Unit) {
    val haptics = rememberHaptics()
    val toast = rememberToast()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val sync = LocalSyncStatus.current
    var confirmSignOut by rememberSaveable { mutableStateOf(false) }
    var confirmDelete by rememberSaveable { mutableStateOf(false) }
    var deleting by rememberSaveable { mutableStateOf(false) }
    val save = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            val ok = runCatching {
                val text = model.export()
                context.contentResolver.openOutputStream(uri)?.use { it.write(text.toByteArray()) } ?: error("no file")
            }.isSuccess
            if (ok) { haptics.confirm(); toast("Exported") } else { haptics.reject(); toast("Couldn't write the file") }
        }
    }
    LifePage(title = "Your data", navigationIcon = up) {
        item {
            LifeCard {
                Text("Where it is", style = MaterialTheme.typography.titleMedium)
                Muted(syncLine(sync.state, sync.pending), Modifier.padding(top = 4.dp))
                Spacer(Modifier.height(10.dp))
                OutlinedButton(onClick = { haptics.tick(); sync.syncNow() }, enabled = !sync.state.demo, shape = MaterialTheme.shapes.medium) { Text("Sync now") }
            }
        }
        item {
            LifeCard {
                Text("Export", style = MaterialTheme.typography.titleMedium)
                Muted("Everything on this phone as one JSON file you keep.", Modifier.padding(top = 4.dp))
                Spacer(Modifier.height(10.dp))
                OutlinedButton(onClick = { haptics.tick(); save.launch("life-os-${LocalDate.now()}.json") }, shape = MaterialTheme.shapes.medium) { Text("Export my data") }
            }
        }
        item {
            LifeCard {
                Text("Account", style = MaterialTheme.typography.titleMedium)
                model.email?.let { Muted(it, Modifier.padding(top = 4.dp)) }
                Spacer(Modifier.height(6.dp))
                TextButton(onClick = { confirmSignOut = true }, contentPadding = PaddingValues(0.dp)) { Text("Sign out") }
                if (!model.isDemo) {
                    TextButton(onClick = { confirmDelete = true }, contentPadding = PaddingValues(0.dp)) { Text("Delete my account", color = MaterialTheme.colorScheme.error) }
                }
            }
        }
    }
    if (confirmSignOut) {
        AlertDialog(
            onDismissRequest = { confirmSignOut = false },
            title = { Text("Sign out?") },
            text = {
                Text(
                    if (sync.pending > 0 && !sync.state.demo) "${sync.pending} ${if (sync.pending == 1) "change hasn't" else "changes haven't"} reached the server yet and will be lost."
                    else "Everything is on the server. This phone forgets it until you sign in again.",
                )
            },
            confirmButton = { TextButton(onClick = { confirmSignOut = false; model.signOut() }) { Text("Sign out") } },
            dismissButton = { TextButton(onClick = { confirmSignOut = false }) { Text("Cancel") } },
        )
    }
    if (confirmDelete) {
        var typed by rememberSaveable { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { if (!deleting) confirmDelete = false },
            title = { Text("Delete your account?") },
            text = {
                Column {
                    Text("Everything you've logged is deleted from the server and this phone. This can't be undone. Export first if you want a copy.")
                    Spacer(Modifier.height(10.dp))
                    OutlinedTextField(typed, { typed = it }, label = { Text("Type DELETE to confirm") }, singleLine = true)
                }
            },
            confirmButton = {
                TextButton(
                    enabled = typed.trim() == "DELETE" && !deleting,
                    onClick = {
                        deleting = true
                        scope.launch {
                            try {
                                model.deleteAccount()
                            } catch (e: IOException) {
                                toast("No connection. Deleting needs the internet.")
                            } catch (e: Exception) {
                                toast("The server didn't delete it. Nothing changed.")
                            } finally {
                                deleting = false
                                confirmDelete = false
                            }
                        }
                    },
                ) { Text(if (deleting) "Deleting…" else "Delete for good", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = { TextButton(onClick = { confirmDelete = false }, enabled = !deleting) { Text("Cancel") } },
        )
    }
}

/* -------------------------------- pieces --------------------------------- */

@Composable
private fun Label(text: String) {
    Text(text, style = MaterialTheme.typography.labelLarge, modifier = Modifier.padding(bottom = 6.dp))
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun Segmented(options: List<Pair<String, String>>, selected: String, pick: (String) -> Unit) {
    val haptics = rememberHaptics()
    SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
        options.forEachIndexed { index, (value, label) ->
            SegmentedButton(
                selected = selected == value,
                onClick = { if (selected != value) { haptics.tick(); pick(value) } },
                shape = SegmentedButtonDefaults.itemShape(index, options.size),
                icon = {},
            ) { Text(label, maxLines = 1) }
        }
    }
}

@Composable
private fun NumberInput(value: String, onChange: (String) -> Unit, label: String) {
    OutlinedTextField(
        value,
        { onChange(it.filter { c -> c.isDigit() || c == '.' }.take(6)) },
        label = { Text(label) },
        singleLine = true,
        shape = MaterialTheme.shapes.medium,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
        modifier = Modifier.fillMaxWidth(),
    )
}

@Composable
internal fun SwitchRow(title: String, caption: String, on: Boolean, set: (Boolean) -> Unit) {
    val haptics = rememberHaptics()
    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.bodyLarge)
            Muted(caption, style = MaterialTheme.typography.bodySmall)
        }
        Spacer(Modifier.width(12.dp))
        Switch(checked = on, onCheckedChange = { haptics.tick(); set(it) })
    }
}
