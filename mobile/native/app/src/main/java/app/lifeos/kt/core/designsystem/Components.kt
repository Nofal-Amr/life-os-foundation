package app.lifeos.kt.core.designsystem

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.rememberSwipeToDismissBoxState
import androidx.compose.material3.ripple
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.Canvas
import androidx.compose.ui.graphics.drawscope.Stroke
import kotlinx.coroutines.flow.distinctUntilChanged

/**
 * A page: the title and an optional line under it start the content, and the
 * title slides into a slim top bar once you scroll past it (no tall empty
 * header). Pull to refresh; the sync status sits in the top bar's actions.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LifePage(
    title: String,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    navigationIcon: @Composable () -> Unit = {},
    actions: @Composable RowScope.() -> Unit = {},
    floatingActionButton: @Composable () -> Unit = {},
    refreshing: Boolean = false,
    onRefresh: (() -> Unit)? = null,
    listState: LazyListState = rememberLazyListState(),
    contentPadding: PaddingValues = PaddingValues(start = 16.dp, end = 16.dp, top = 0.dp, bottom = 112.dp),
    content: LazyListScope.() -> Unit,
) {
    val scrolled by remember { derivedStateOf { listState.firstVisibleItemIndex > 0 || listState.firstVisibleItemScrollOffset > 56 } }
    val barColor by animateColorAsState(
        if (scrolled) MaterialTheme.colorScheme.surfaceContainer else MaterialTheme.colorScheme.background,
        tween(200),
        label = "bar",
    )
    Scaffold(
        modifier = modifier,
        containerColor = MaterialTheme.colorScheme.background,
        contentWindowInsets = WindowInsets(0),
        floatingActionButton = floatingActionButton,
    ) { padding ->
        val list = @Composable {
            LazyColumn(
                state = listState,
                modifier = Modifier.fillMaxSize(),
                contentPadding = contentPadding,
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                item(key = "page-title") {
                    val topInset = if (LocalStatusBarHandled.current) Modifier else Modifier.statusBarsPadding()
                    Column(topInset.padding(top = 12.dp, bottom = 8.dp)) {
                        // Tool pages: the way back sits above the title.
                        Box(Modifier.offset(x = (-12).dp)) { navigationIcon() }
                        Row(verticalAlignment = Alignment.Top) {
                            Column(Modifier.weight(1f).padding(start = 4.dp, top = 2.dp)) {
                                Text(title, style = MaterialTheme.typography.headlineLarge, maxLines = 2, overflow = TextOverflow.Ellipsis)
                                if (subtitle != null) Muted(subtitle)
                            }
                            Row(content = actions)
                        }
                    }
                }
                content()
            }
        }
        Box(Modifier.padding(padding).fillMaxSize()) {
            if (onRefresh != null) PullToRefreshBox(isRefreshing = refreshing, onRefresh = onRefresh) { list() } else list()
            // At the top, the title row carries the actions itself (no empty bar); a slim bar
            // floats in over the content once the title has scrolled away, so nothing jumps.
            AnimatedVisibility(scrolled, enter = fadeIn(tween(160)) + slideInVertically { -it / 2 }, exit = fadeOut(tween(120)) + slideOutVertically { -it / 2 }) {
                TopAppBar(
                    title = { Text(title, maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.titleLarge) },
                    navigationIcon = navigationIcon,
                    actions = actions,
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = barColor, scrolledContainerColor = barColor),
                    windowInsets = if (LocalStatusBarHandled.current) WindowInsets(0) else TopAppBarDefaults.windowInsets,
                )
            }
        }
    }
}

/** True when something above the page (the demo bar) already sits under the status bar. */
val LocalStatusBarHandled = androidx.compose.runtime.staticCompositionLocalOf { false }

/** A card. It gives a little under the finger and ticks when tapped. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun LifeCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    onLongClick: (() -> Unit)? = null,
    contentPadding: PaddingValues = PaddingValues(16.dp),
    color: Color = MaterialTheme.colorScheme.surfaceContainer,
    content: @Composable ColumnScope.() -> Unit,
) {
    val haptics = rememberHaptics()
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val scale by animateFloatAsState(if (pressed && onClick != null) 0.975f else 1f, spring(dampingRatio = 0.7f, stiffness = Spring.StiffnessMediumLow), label = "press")
    val shape = MaterialTheme.shapes.large
    var base = modifier
        .fillMaxWidth()
        .graphicsLayer {
            scaleX = scale
            scaleY = scale
        }
        .clip(shape)
        .background(color)
        .border(1.dp, MaterialTheme.colorScheme.outlineVariant, shape)
    if (onClick != null || onLongClick != null) {
        base = base.combinedClickable(
            interactionSource = interaction,
            indication = ripple(),
            onClick = { haptics.tick(); onClick?.invoke() },
            onLongClick = onLongClick?.let { { haptics.longPress(); it() } },
        )
    }
    Column(base.padding(contentPadding), content = content)
}

@Composable
fun SectionHeader(title: String, modifier: Modifier = Modifier, action: String? = null, onAction: (() -> Unit)? = null) {
    Row(modifier.fillMaxWidth().padding(start = 4.dp, top = 12.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(title, style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(1f))
        if (action != null && onAction != null) TextButton(onClick = onAction) { Text(action) }
    }
}

/** Small caps-free label above a value, as the web's stat cards. */
@Composable
fun Eyebrow(text: String, modifier: Modifier = Modifier, color: Color = MaterialTheme.colorScheme.onSurfaceVariant) {
    Text(text, style = MaterialTheme.typography.labelMedium, color = color, modifier = modifier)
}

@Composable
fun Muted(text: String, modifier: Modifier = Modifier, maxLines: Int = Int.MAX_VALUE, style: TextStyle = MaterialTheme.typography.bodyMedium) {
    Text(text, style = style, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = modifier, maxLines = maxLines, overflow = TextOverflow.Ellipsis)
}

/**
 * A number that rolls to its new value. While it moves it shows rounded
 * figures; at rest it shows exactly [format] of the real value.
 */
@Composable
fun AnimatedNumber(value: Double, format: (Double) -> String, style: TextStyle, modifier: Modifier = Modifier, color: Color = Color.Unspecified) {
    val animated = remember { Animatable(value.toFloat()) }
    LaunchedEffect(value) { animated.animateTo(value.toFloat(), tween(durationMillis = 650)) }
    val shown = if (animated.isRunning) format(animated.value.toDouble()) else format(value)
    Text(shown, style = style.merge(Numbers), modifier = modifier, color = color, maxLines = 1)
}

/** A ring for a fraction with a real stored denominator (never an invented target). */
@Composable
fun ProgressRing(fraction: Float, modifier: Modifier = Modifier, size: Dp = 56.dp, stroke: Dp = 6.dp, color: Color = MaterialTheme.colorScheme.primary) {
    val sweep by animateFloatAsState(fraction.coerceIn(0f, 1f), spring(dampingRatio = 0.85f, stiffness = Spring.StiffnessLow), label = "ring")
    val track = MaterialTheme.colorScheme.surfaceContainerHighest
    Canvas(modifier.size(size)) {
        val width = stroke.toPx()
        val inset = width / 2
        val arc = Size(this.size.width - width, this.size.height - width)
        drawArc(track, 0f, 360f, false, Offset(inset, inset), arc, style = Stroke(width))
        drawArc(color, -90f, 360f * sweep, false, Offset(inset, inset), arc, style = Stroke(width, cap = StrokeCap.Round))
    }
}

/** A round tinted badge holding an icon (EntityIdentity on the web). */
@Composable
fun IconBadge(icon: ImageVector, tint: Color = MaterialTheme.colorScheme.primary, modifier: Modifier = Modifier, size: Dp = 36.dp) {
    Box(modifier.size(size).clip(CircleShape).background(tint.copy(alpha = 0.12f)), contentAlignment = Alignment.Center) {
        Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(size * 0.55f))
    }
}

@Composable
fun EmptyState(icon: ImageVector, title: String, body: String? = null, modifier: Modifier = Modifier, action: (@Composable () -> Unit)? = null) {
    Column(modifier.fillMaxWidth().padding(vertical = 40.dp, horizontal = 24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        IconBadge(icon, size = 56.dp)
        Spacer(Modifier.height(14.dp))
        Text(title, style = MaterialTheme.typography.titleMedium, textAlign = TextAlign.Center)
        if (body != null) {
            Spacer(Modifier.height(4.dp))
            Text(body, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
        }
        if (action != null) {
            Spacer(Modifier.height(16.dp))
            action()
        }
    }
}

/** A shimmering placeholder while the phone's database opens (a few milliseconds, usually). */
@Composable
fun Skeleton(modifier: Modifier = Modifier, height: Dp = 72.dp) {
    val transition = rememberInfiniteTransition(label = "shimmer")
    val x by transition.animateFloat(-1f, 2f, infiniteRepeatable(tween(1100), RepeatMode.Restart), label = "x")
    val base = MaterialTheme.colorScheme.surfaceContainerHigh
    val light = MaterialTheme.colorScheme.surfaceContainer
    Box(
        modifier.fillMaxWidth().height(height).clip(MaterialTheme.shapes.large).background(
            Brush.linearGradient(listOf(base, light, base), start = Offset(x * 600f, 0f), end = Offset(x * 600f + 600f, 0f)),
        ),
    )
}

/** A choice chip that ticks when it changes. */
@Composable
fun SelectChip(selected: Boolean, label: String, onClick: () -> Unit, modifier: Modifier = Modifier, leadingIcon: ImageVector? = null) {
    val haptics = rememberHaptics()
    FilterChip(
        selected = selected,
        onClick = { haptics.tick(); onClick() },
        label = { Text(label) },
        modifier = modifier,
        leadingIcon = when {
            selected -> ({ Icon(Icons.Filled.Check, null, Modifier.size(FilterChipDefaults.IconSize)) })
            leadingIcon != null -> ({ Icon(leadingIcon, null, Modifier.size(FilterChipDefaults.IconSize)) })
            else -> null
        },
        shape = MaterialTheme.shapes.small,
    )
}

/**
 * Swipe a row to act on it: right for [start] (e.g. finish), left for [end]
 * (e.g. plan for tomorrow). The row springs back; the action runs. A tick
 * marks the point where letting go acts.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SwipeActions(
    start: SwipeAction?,
    end: SwipeAction?,
    modifier: Modifier = Modifier,
    content: @Composable RowScope.() -> Unit,
) {
    val haptics = rememberHaptics()
    val state = rememberSwipeToDismissBoxState(
        confirmValueChange = { value ->
            when (value) {
                SwipeToDismissBoxValue.StartToEnd -> start?.let { haptics.confirm(); it.onSwipe() }
                SwipeToDismissBoxValue.EndToStart -> end?.let { haptics.confirm(); it.onSwipe() }
                SwipeToDismissBoxValue.Settled -> Unit
            }
            false
        },
        positionalThreshold = { it * 0.35f },
    )
    LaunchedEffect(state) {
        snapshotFlow { state.targetValue }.distinctUntilChanged().collect { if (it != SwipeToDismissBoxValue.Settled) haptics.threshold() }
    }
    SwipeToDismissBox(
        state = state,
        modifier = modifier,
        enableDismissFromStartToEnd = start != null,
        enableDismissFromEndToStart = end != null,
        backgroundContent = {
            val action = if (state.dismissDirection == SwipeToDismissBoxValue.StartToEnd) start else end
            if (action != null) {
                val armed = state.targetValue != SwipeToDismissBoxValue.Settled
                val tint by animateFloatAsState(if (armed) 1f else 0.55f, label = "armed")
                Box(
                    Modifier.fillMaxSize().clip(MaterialTheme.shapes.large).background(action.color.copy(alpha = 0.14f + 0.1f * tint)).padding(horizontal = 22.dp),
                    contentAlignment = if (state.dismissDirection == SwipeToDismissBoxValue.StartToEnd) Alignment.CenterStart else Alignment.CenterEnd,
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(action.icon, contentDescription = null, tint = action.color, modifier = Modifier.graphicsLayer { scaleX = 0.85f + 0.25f * tint; scaleY = 0.85f + 0.25f * tint })
                        Text(action.label, color = action.color, style = MaterialTheme.typography.labelLarge)
                    }
                }
            }
        },
        content = content,
    )
}

data class SwipeAction(val label: String, val icon: ImageVector, val color: Color, val onSwipe: () -> Unit)

/** The round dot used for tiny status marks (e.g. "saved on this phone"). */
@Composable
fun Dot(color: Color, modifier: Modifier = Modifier, size: Dp = 6.dp) {
    Box(modifier.size(size).background(color, RoundedCornerShape(50)))
}
