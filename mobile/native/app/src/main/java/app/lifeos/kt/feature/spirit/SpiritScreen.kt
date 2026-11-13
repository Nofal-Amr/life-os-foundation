package app.lifeos.kt.feature.spirit

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Geocoder
import android.location.LocationManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.LocationOn
import androidx.compose.material.icons.outlined.MyLocation
import androidx.compose.material.icons.outlined.Tune
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.PrimaryScrollableTabRow
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.lifeos.kt.core.designsystem.DayBar
import app.lifeos.kt.core.designsystem.Eyebrow
import app.lifeos.kt.core.designsystem.LifeCard
import app.lifeos.kt.core.designsystem.LocalStatusBarHandled
import app.lifeos.kt.core.designsystem.LocalSyncStatus
import app.lifeos.kt.core.designsystem.Muted
import app.lifeos.kt.core.designsystem.Numbers
import app.lifeos.kt.core.designsystem.ProgressRing
import app.lifeos.kt.core.designsystem.SectionHeader
import app.lifeos.kt.core.designsystem.SelectChip
import app.lifeos.kt.core.designsystem.Skeleton
import app.lifeos.kt.core.designsystem.SyncAction
import app.lifeos.kt.core.designsystem.rememberHaptics
import app.lifeos.kt.core.designsystem.rememberToast
import app.lifeos.kt.data.logic.ASR_SCHOOLS
import app.lifeos.kt.data.logic.CALC_METHODS
import app.lifeos.kt.data.logic.DAY_ORDER
import app.lifeos.kt.data.logic.PRAYER_STATUSES
import app.lifeos.kt.data.logic.isSunnah
import app.lifeos.kt.data.logic.prayedInWeek
import app.lifeos.kt.data.logic.prayedOn
import app.lifeos.kt.data.logic.prayerLabel
import app.lifeos.kt.data.logic.prayerStatus
import app.lifeos.kt.data.logic.prayerStatusCounts
import app.lifeos.kt.data.logic.timeKeyOf
import app.lifeos.kt.feature.today.PrayerStatusSheet
import app.lifeos.kt.feature.today.STATUS_ICONS
import app.lifeos.kt.feature.today.statusColor
import app.lifeos.kt.feature.today.statusLabel
import java.text.DateFormat
import java.time.format.DateTimeFormatter
import java.util.Date
import java.util.Locale
import kotlin.coroutines.resume
import kotlin.math.roundToInt
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull

private val PAGES = listOf(
    "Prayers" to "Prayer times for your place, and your own record.",
    "Azkar" to "Morning and evening azkar. Tap a card each time you say it.",
    "Tasbih" to "Tap the circle. It buzzes at the target.",
    "Qibla" to "The direction of the Kaaba from where you are.",
)

/** Spirit: the web's four tabs (Prayers, Azkar, Tasbih, Qibla), swipeable. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SpiritScreen(model: SpiritViewModel = hiltViewModel()) {
    val state by model.state.collectAsStateWithLifecycle()
    val haptics = rememberHaptics()
    val pager = rememberPagerState { PAGES.size }
    val focus = LocalFocusManager.current
    val scope = rememberCoroutineScope()
    var settingUp by rememberSaveable { mutableStateOf(false) }
    LaunchedEffect(pager) {
        var first = true
        snapshotFlow { pager.settledPage }.collect {
            focus.clearFocus()
            if (first) first = false else haptics.tick()
        }
    }

    Column(Modifier.fillMaxSize()) {
        val top = if (LocalStatusBarHandled.current) Modifier else Modifier.statusBarsPadding()
        Row(top.fillMaxWidth().padding(start = 20.dp, end = 8.dp, top = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("Spirit", style = MaterialTheme.typography.headlineLarge)
                Muted(PAGES[pager.currentPage].second)
            }
            IconButton(onClick = { haptics.tick(); settingUp = true }) { Icon(Icons.Outlined.Tune, "Prayer setup") }
            SyncAction()
        }
        PrimaryScrollableTabRow(selectedTabIndex = pager.currentPage, edgePadding = 12.dp, containerColor = MaterialTheme.colorScheme.background, divider = {}) {
            PAGES.forEachIndexed { index, (label, _) ->
                Tab(
                    selected = pager.currentPage == index,
                    onClick = { scope.launch { pager.animateScrollToPage(index) } },
                    text = { Text(label, style = MaterialTheme.typography.labelLarge) },
                    selectedContentColor = MaterialTheme.colorScheme.primary,
                    unselectedContentColor = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        HorizontalPager(pager, Modifier.weight(1f), beyondViewportPageCount = 1, userScrollEnabled = true) { page ->
            val s = state
            if (s == null) {
                SpiritList { items(4) { Skeleton(height = 80.dp) } }
                return@HorizontalPager
            }
            when (page) {
                0 -> SpiritList { prayersPage(s, model) { settingUp = true } }
                1 -> SpiritList { item(key = "azkar") { AzkarTab(s, model) } }
                2 -> SpiritList { item(key = "tasbih") { TasbihTab(s, model) } }
                else -> SpiritList { item(key = "qibla") { QiblaTab(s, active = pager.currentPage == 3) { settingUp = true } } }
            }
        }
    }
    val s = state ?: return
    if (settingUp) PrayerSetupSheet(s, model, close = { settingUp = false })
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SpiritList(content: LazyListScope.() -> Unit) {
    val sync = LocalSyncStatus.current
    PullToRefreshBox(isRefreshing = sync.state.running, onRefresh = sync.syncNow, modifier = Modifier.fillMaxSize()) {
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp, 8.dp, 16.dp, 112.dp), verticalArrangement = Arrangement.spacedBy(8.dp), content = content)
    }
}

/* -------------------------------- Prayers -------------------------------- */

private fun LazyListScope.prayersPage(s: SpiritState, model: SpiritViewModel, setUp: () -> Unit) {
    item(key = "day") { DayBar(s.date, s.today, model::setDate) }
    if (s.spiritHabits.isNotEmpty()) item(key = "habits") { SpiritHabits(s, model) }
    item(key = "summary") { Summary(s) }
    if (s.times == null) {
        item(key = "no-place") {
            LifeCard {
                Text("No location set yet", style = MaterialTheme.typography.titleMedium)
                Muted("Prayer times are calculated from your location, on the phone, so they work offline once it's set.")
                Spacer(Modifier.height(12.dp))
                Button(onClick = setUp, shape = MaterialTheme.shapes.medium) { Icon(Icons.Outlined.LocationOn, null); Spacer(Modifier.width(8.dp)); Text("Set your place") }
            }
        }
    }
    item(key = "list") { PrayerList(s, model) }
    item(key = "stats-head") { SectionHeader("How prayers were logged") }
    item(key = "stats") { PrayerStats(s) }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun SpiritHabits(s: SpiritState, model: SpiritViewModel) {
    val haptics = rememberHaptics()
    LifeCard {
        Eyebrow("Spirit habits")
        Spacer(Modifier.height(8.dp))
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            for (habit in s.spiritHabits) {
                val done = s.habitLogs.any { it.habitId == habit.id && it.logDate == s.iso }
                SelectChip(done, habit.name, { if (done) haptics.tick() else haptics.confirm(); model.toggleHabit(s, habit) })
            }
        }
    }
}

@Composable
private fun Summary(s: SpiritState) {
    val done = prayedOn(s.logs, s.iso)
    LifeCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(contentAlignment = Alignment.Center) {
                ProgressRing(done / 5f, size = 60.dp, stroke = 6.dp, color = app.lifeos.kt.core.designsystem.LifeTheme.colors.chart[1])
                Text("$done/5", style = MaterialTheme.typography.titleSmall.merge(Numbers))
            }
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Eyebrow(if (s.date == s.today) "Prayers today" else "Prayers on ${s.date.format(DateTimeFormatter.ofPattern("d MMM"))}")
                Text("$done of 5 prayed", style = MaterialTheme.typography.titleLarge)
                Muted("${prayedInWeek(s.logs, s.date)} of 35 over the last seven days", style = MaterialTheme.typography.bodySmall)
            }
        }
        s.settings?.city?.let {
            Spacer(Modifier.height(8.dp))
            Muted("Times for $it", style = MaterialTheme.typography.bodySmall)
        }
    }
}

/**
 * One row per prayer of the day: Sunnah, the five, Witr. The five open the
 * status sheet; the sunnah are one tap on, one tap off. Under Fajr, sunrise
 * (when its time ends); under Isha, the suggested points before the next Fajr.
 */
@Composable
private fun PrayerList(s: SpiritState, model: SpiritViewModel) {
    val haptics = rememberHaptics()
    val clock = DateFormat.getTimeInstance(DateFormat.SHORT)
    var picking by remember { mutableStateOf<String?>(null) }
    val now = Date()
    val nextKey = if (s.date == s.today) s.times?.firstOrNull { it.at.after(now) }?.key else null
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        for ((name, _) in DAY_ORDER) {
            val status = s.status(name)
            val sunnah = isSunnah(name)
            val time = s.times?.firstOrNull { it.key == timeKeyOf(name) }?.at
            val isNext = nextKey == name && status == null
            PrayerRow(
                label = prayerLabel(name, s.date),
                time = time?.let(clock::format),
                hint = when (name) {
                    "sunnah_fajr" -> "Before Fajr's fard"
                    "witr" -> "After Isha, before Fajr"
                    else -> null
                },
                sunnah = sunnah,
                next = isNext,
                status = status,
                below = s.windows?.let { w ->
                    when (name) {
                        "fajr" -> listOf("Sunrise ${clock.format(w.sunrise)} · Fajr's time ends")
                        "isha" -> listOf("Best by ${clock.format(w.ishaFirstThird)} · by ${clock.format(w.ishaHalf)} if needed", "Until Fajr ${clock.format(w.nextFajr)} only if absolutely necessary")
                        else -> null
                    }
                },
            ) {
                if (sunnah) {
                    if (status != null) haptics.tick() else haptics.confirm()
                    model.setStatus(s, name, if (status != null) null else "on_time")
                } else {
                    haptics.tick()
                    picking = name
                }
            }
        }
    }
    picking?.let { name -> PrayerStatusSheet(name, s.date, s.status(name), pick = { model.setStatus(s, name, it) }, close = { picking = null }) }
}

@Composable
private fun PrayerRow(label: String, time: String?, hint: String?, sunnah: Boolean, next: Boolean, status: String?, below: List<String>?, onClick: () -> Unit) {
    val shape = RoundedCornerShape(18.dp)
    val color = status?.let { statusColor(it) }
    val bg by animateColorAsState(if (next) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceContainer, label = "row")
    Row(
        Modifier
            .fillMaxWidth()
            .heightIn(min = 64.dp)
            .clip(shape)
            .background(bg)
            .border(if (sunnah) 1.5.dp else 1.dp, if (sunnah) MaterialTheme.colorScheme.primary.copy(alpha = 0.4f) else MaterialTheme.colorScheme.outlineVariant, shape)
            .clickable(onClick = onClick),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f).padding(horizontal = 16.dp, vertical = 12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(label, style = MaterialTheme.typography.titleMedium, modifier = Modifier.width(96.dp))
                Text(time ?: "—", style = MaterialTheme.typography.bodyLarge.merge(Numbers), color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (next) {
                    Spacer(Modifier.width(10.dp))
                    Text("NEXT", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.primary)
                }
            }
            hint?.let { Muted(it, style = MaterialTheme.typography.bodySmall) }
            below?.forEach { Muted(it, style = MaterialTheme.typography.bodySmall) }
        }
        // The status panel: its own colour, icon and word, so colour never carries meaning alone.
        Box(
            Modifier
                .width(104.dp)
                .heightIn(min = 64.dp)
                .padding(6.dp)
                .clip(RoundedCornerShape(14.dp))
                .background(color ?: Color.Transparent)
                .then(if (color == null) Modifier.border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(14.dp)) else Modifier),
            contentAlignment = Alignment.Center,
        ) {
            if (status != null) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(vertical = 8.dp)) {
                    Icon(STATUS_ICONS.getValue(status), null, tint = Color.White, modifier = Modifier.size(20.dp))
                    Text(statusLabel(status), style = MaterialTheme.typography.labelMedium, color = Color.White)
                }
            } else {
                Text("Log", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

/** The web's heatmap (prayers × days) and the share of each status, over 2 weeks, a month or a year. */
@Composable
private fun PrayerStats(s: SpiritState) {
    val haptics = rememberHaptics()
    var range by rememberSaveable { mutableIntStateOf(14) }
    val from = s.today.minusDays((range - 1).toLong())
    val (counts, logged) = prayerStatusCounts(s.logs, from.toString(), s.today.toString())
    val byKey = s.logs.associate { "${it.prayerDate}|${it.prayerName}" to prayerStatus(it) }
    val dates = (0 until range).map { from.plusDays(it.toLong()) }
    LifeCard {
        SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
            listOf(14 to "2 weeks", 30 to "Month", 365 to "Year").forEachIndexed { index, (days, label) ->
                SegmentedButton(selected = range == days, onClick = { haptics.tick(); range = days }, shape = SegmentedButtonDefaults.itemShape(index, 3), icon = {}) { Text(label) }
            }
        }
        Spacer(Modifier.height(14.dp))
        if (logged == 0) {
            Muted("Nothing logged in this range yet.")
            return@LifeCard
        }
        val cell = when { range > 60 -> 6.dp; range > 20 -> 9.dp; else -> 16.dp }
        val empty = MaterialTheme.colorScheme.outlineVariant
        val sunnahRing = MaterialTheme.colorScheme.primary.copy(alpha = 0.45f)
        val missed = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.45f)
        val scroll = rememberScrollState(Int.MAX_VALUE)
        Row {
            Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                if (range <= 30) Spacer(Modifier.height(14.dp))
                for ((name, _) in DAY_ORDER) {
                    Box(Modifier.height(cell), contentAlignment = Alignment.CenterStart) {
                        Text(shortLabel(name), style = MaterialTheme.typography.labelSmall, color = if (isSunnah(name)) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(end = 6.dp))
                    }
                }
            }
            // Newest on the right; a year scrolls, starting at today.
            Column(Modifier.horizontalScroll(scroll), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                if (range <= 30) {
                    Row(horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                        for (d in dates) Box(Modifier.width(cell).height(14.dp), contentAlignment = Alignment.Center) {
                            if (range <= 14 || d.dayOfMonth % 5 == 0) Text("${d.dayOfMonth}", style = MaterialTheme.typography.labelSmall.copy(fontSize = androidx.compose.ui.unit.TextUnit(9f, androidx.compose.ui.unit.TextUnitType.Sp)), color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
                        }
                    }
                }
                for ((name, _) in DAY_ORDER) {
                    Row(horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                        for (d in dates) {
                            val status = byKey["$d|$name"]
                            Box(
                                Modifier
                                    .size(cell)
                                    .clip(RoundedCornerShape(3.dp))
                                    .background(
                                        when (status) {
                                            null -> empty
                                            "missed" -> missed
                                            else -> statusColor(status)
                                        },
                                    )
                                    .then(if (isSunnah(name) && cell > 8.dp) Modifier.border(1.dp, sunnahRing, RoundedCornerShape(3.dp)) else Modifier),
                            )
                        }
                    }
                }
            }
        }
        Spacer(Modifier.height(8.dp))
        Muted("Outlined: sunnah, not counted in the five.", style = MaterialTheme.typography.labelSmall)
        Spacer(Modifier.height(12.dp))
        // The share of each status, of the five that were logged.
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            PRAYER_STATUSES.chunked(2).forEach { pair ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    for ((status, _) in pair) {
                        val n = counts[status] ?: 0
                        Column(Modifier.weight(1f).clip(RoundedCornerShape(14.dp)).background(MaterialTheme.colorScheme.surfaceContainerHighest.copy(alpha = 0.5f)).padding(12.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(STATUS_ICONS.getValue(status), null, tint = statusColor(status), modifier = Modifier.size(15.dp))
                                Spacer(Modifier.width(6.dp))
                                Text(statusLabel(status), style = MaterialTheme.typography.labelMedium)
                            }
                            Text("${(n * 100.0 / logged).roundToInt()}%", style = MaterialTheme.typography.headlineSmall.merge(Numbers))
                            Muted("$n of $logged logged", style = MaterialTheme.typography.labelSmall)
                        }
                    }
                    if (pair.size == 1) Spacer(Modifier.weight(1f))
                }
            }
        }
    }
}

private fun shortLabel(name: String) = when (name) {
    "sunnah_fajr" -> "Sunnah"
    "fajr" -> "Fajr"
    "dhuhr" -> "Dhuhr"
    "asr" -> "Asr"
    "maghrib" -> "Mghrb"
    "isha" -> "Isha"
    "witr" -> "Witr"
    else -> name
}

/* --------------------------------- setup --------------------------------- */

/**
 * The web's Prayer setup (in Settings there): a place from a city name or
 * this phone's location, the calculation method and the Asr school. Native
 * extra: it lives one tap from Spirit, and the location is read on the phone.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun PrayerSetupSheet(s: SpiritState, model: SpiritViewModel, close: () -> Unit) {
    val haptics = rememberHaptics()
    val toast = rememberToast()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var city by rememberSaveable { mutableStateOf("") }
    var busy by remember { mutableStateOf<String?>(null) }
    var method by rememberSaveable { mutableStateOf(s.settings?.calcMethod ?: "Egyptian") }
    var school by rememberSaveable { mutableStateOf(s.settings?.asrSchool ?: "shafi") }

    fun place(latitude: Double, longitude: Double, label: String?) {
        model.saveSettings(s) { it.copy(latitude = latitude, longitude = longitude, city = label, calcMethod = method, asrSchool = school) }
        haptics.confirm()
        toast("Location set to ${label ?: "your position"}.")
    }
    fun locate() {
        busy = "Locating…"
        scope.launch {
            val found = currentLocation(context)
            if (found == null) {
                busy = null
                haptics.reject()
                toast("Couldn't get a location. Check that location is on, or type your city.")
                return@launch
            }
            val label = reverseGeocode(context, found.first, found.second)
            busy = null
            place(found.first, found.second, label)
        }
    }
    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) locate() else toast("Without location, type your city instead.")
    }

    app.lifeos.kt.feature.tasks.EditorSheet(
        title = "Prayer setup",
        close = close,
        onSave = {
            haptics.confirm()
            model.saveSettings(s) { it.copy(calcMethod = method, asrSchool = school) }
            true
        },
    ) {
        Muted(s.settings?.city?.let { "Prayer times are calculated for $it." } ?: if (s.settings?.latitude != null) "Prayer times are calculated for your saved coordinates." else "Set a location so prayer times can be calculated.")
        Row(verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(city, { city = it }, label = { Text("City") }, singleLine = true, shape = MaterialTheme.shapes.medium, modifier = Modifier.weight(1f))
            Spacer(Modifier.width(8.dp))
            OutlinedButton(
                onClick = {
                    if (city.isBlank()) { haptics.reject(); return@OutlinedButton }
                    busy = "Looking up…"
                    scope.launch {
                        val found = geocode(context, city.trim())
                        busy = null
                        if (found == null) { haptics.reject(); toast("Couldn't find that place. Try the city and country.") } else { place(found.first, found.second, found.third); city = "" }
                    }
                },
                enabled = busy == null,
                shape = MaterialTheme.shapes.medium,
            ) { Text("Use city") }
        }
        OutlinedButton(
            onClick = {
                val granted = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
                if (granted) locate() else permission.launch(Manifest.permission.ACCESS_COARSE_LOCATION)
            },
            enabled = busy == null,
            shape = MaterialTheme.shapes.medium,
            modifier = Modifier.fillMaxWidth(),
        ) { Icon(Icons.Outlined.MyLocation, null); Spacer(Modifier.width(8.dp)); Text(busy ?: "Use my location") }
        Eyebrow("Calculation method")
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            for ((value, label) in CALC_METHODS) SelectChip(method == value, label, { haptics.tick(); method = value })
        }
        Eyebrow("Asr school")
        SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
            ASR_SCHOOLS.forEachIndexed { index, (value, label) ->
                SegmentedButton(selected = school == value, onClick = { haptics.tick(); school = value }, shape = SegmentedButtonDefaults.itemShape(index, ASR_SCHOOLS.size), icon = {}) { Text(label, maxLines = 1) }
            }
        }
    }
}

/** The phone's current position (coarse is plenty for prayer times), or null within ten seconds. */
@SuppressLint("MissingPermission")
private suspend fun currentLocation(context: Context): Pair<Double, Double>? = withTimeoutOrNull(10_000) {
    val manager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    val providers = listOf(LocationManager.NETWORK_PROVIDER, LocationManager.GPS_PROVIDER).filter { runCatching { manager.isProviderEnabled(it) }.getOrDefault(false) }
    if (providers.isEmpty()) return@withTimeoutOrNull null
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        suspendCancellableCoroutine { cont ->
            manager.getCurrentLocation(providers.first(), null, ContextCompat.getMainExecutor(context)) { loc -> cont.resume(loc?.let { it.latitude to it.longitude }) }
        } ?: providers.firstNotNullOfOrNull { manager.getLastKnownLocation(it) }?.let { it.latitude to it.longitude }
    } else {
        providers.firstNotNullOfOrNull { manager.getLastKnownLocation(it) }?.let { it.latitude to it.longitude }
    }
}

@Suppress("DEPRECATION")
private suspend fun reverseGeocode(context: Context, latitude: Double, longitude: Double): String? = withContext(Dispatchers.IO) {
    runCatching {
        Geocoder(context, Locale.getDefault()).getFromLocation(latitude, longitude, 1)?.firstOrNull()?.let { a ->
            listOfNotNull(a.locality ?: a.subAdminArea ?: a.adminArea, a.countryName).joinToString(", ").ifEmpty { null }
        }
    }.getOrNull()
}

@Suppress("DEPRECATION")
private suspend fun geocode(context: Context, query: String): Triple<Double, Double, String>? = withContext(Dispatchers.IO) {
    runCatching {
        Geocoder(context, Locale.getDefault()).getFromLocationName(query, 1)?.firstOrNull()?.let { a ->
            Triple(a.latitude, a.longitude, listOfNotNull(a.locality ?: a.featureName ?: query, a.countryName).distinct().joinToString(", "))
        }
    }.getOrNull()
}
