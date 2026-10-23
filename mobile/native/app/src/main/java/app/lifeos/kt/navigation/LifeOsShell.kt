package app.lifeos.kt.navigation

import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.CheckBox
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material.icons.outlined.AccountBalanceWallet
import androidx.compose.material.icons.outlined.CheckBox
import androidx.compose.material.icons.outlined.DarkMode
import androidx.compose.material.icons.outlined.Dashboard
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.GridView
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.toRoute
import app.lifeos.kt.AppViewModel
import app.lifeos.kt.core.designsystem.LocalSnackbar
import app.lifeos.kt.core.designsystem.LocalSyncStatus
import app.lifeos.kt.core.designsystem.rememberHaptics
import app.lifeos.kt.feature.body.BodyScreen
import app.lifeos.kt.feature.money.MoneyScreen
import app.lifeos.kt.feature.more.MoreScreen
import app.lifeos.kt.feature.more.ToolScreen
import app.lifeos.kt.feature.spirit.SpiritScreen
import app.lifeos.kt.feature.tasks.TasksScreen
import app.lifeos.kt.feature.today.TodayScreen
import kotlin.reflect.KClass
import kotlinx.serialization.Serializable

@Serializable data object TodayRoute
@Serializable data object DoRoute
@Serializable data object MoneyRoute
@Serializable data object BodyRoute
@Serializable data object SpiritRoute
@Serializable data object MoreRoute
@Serializable data class ToolRoute(val key: String)

/** The five sections at the bottom, as in the web app, plus More for the tools. */
enum class Section(val label: String, val route: Any, val routeClass: KClass<*>, val icon: ImageVector, val selectedIcon: ImageVector) {
    Today("Today", TodayRoute, TodayRoute::class, Icons.Outlined.Dashboard, Icons.Filled.Dashboard),
    Do("Do", DoRoute, DoRoute::class, Icons.Outlined.CheckBox, Icons.Filled.CheckBox),
    Money("Money", MoneyRoute, MoneyRoute::class, Icons.Outlined.AccountBalanceWallet, Icons.Filled.AccountBalanceWallet),
    Body("Body", BodyRoute, BodyRoute::class, Icons.Outlined.FavoriteBorder, Icons.Filled.Favorite),
    Spirit("Spirit", SpiritRoute, SpiritRoute::class, Icons.Outlined.DarkMode, Icons.Filled.DarkMode),
    More("More", MoreRoute, MoreRoute::class, Icons.Outlined.GridView, Icons.Filled.GridView),
}

// Sections fade through (a soft scale-in); a tool slides in from the side and back out.
private val sectionEnter: AnimatedContentTransitionScope<*>.() -> EnterTransition =
    { fadeIn(tween(220, delayMillis = 60)) + scaleIn(tween(220, delayMillis = 60), initialScale = 0.97f) }
private val sectionExit: AnimatedContentTransitionScope<*>.() -> ExitTransition = { fadeOut(tween(90)) }

@Composable
fun LifeOsShell(app: AppViewModel) {
    val nav = rememberNavController()
    val snackbar = remember { SnackbarHostState() }
    val sync by app.syncStatus.collectAsStateWithLifecycle()

    CompositionLocalProvider(LocalSnackbar provides snackbar, LocalSyncStatus provides sync) {
        Scaffold(
            containerColor = MaterialTheme.colorScheme.background,
            contentWindowInsets = WindowInsets(0),
            snackbarHost = { SnackbarHost(snackbar) },
            bottomBar = { BottomBar(nav) },
        ) { padding ->
            Box(Modifier.fillMaxSize().padding(padding)) {
                NavHost(
                    navController = nav,
                    startDestination = TodayRoute,
                    enterTransition = sectionEnter,
                    exitTransition = sectionExit,
                    popEnterTransition = sectionEnter,
                    popExitTransition = sectionExit,
                ) {
                    composable<TodayRoute> { TodayScreen(open = { nav.goToSection(it) }) }
                    composable<DoRoute> { TasksScreen() }
                    composable<MoneyRoute> { MoneyScreen() }
                    composable<BodyRoute> { BodyScreen() }
                    composable<SpiritRoute> { SpiritScreen() }
                    composable<MoreRoute> { MoreScreen(open = { nav.navigate(ToolRoute(it)) }) }
                    composable<ToolRoute>(
                        enterTransition = { slideIntoContainer(AnimatedContentTransitionScope.SlideDirection.Start, tween(300)) + fadeIn(tween(300)) },
                        exitTransition = { fadeOut(tween(120)) },
                        popEnterTransition = { fadeIn(tween(200)) },
                        popExitTransition = { slideOutOfContainer(AnimatedContentTransitionScope.SlideDirection.End, tween(260)) + fadeOut(tween(260)) },
                    ) { entry -> ToolScreen(entry.toRoute<ToolRoute>().key, close = { nav.popBackStack() }) }
                }
            }
        }
    }
}

private fun NavHostController.goToSection(section: Section) = navigate(section.route) {
    popUpTo(graph.findStartDestination().id) { saveState = true }
    launchSingleTop = true
    restoreState = true
}

@Composable
private fun BottomBar(nav: NavHostController) {
    val haptics = rememberHaptics()
    val entry by nav.currentBackStackEntryAsState()
    val destination = entry?.destination
    NavigationBar(containerColor = MaterialTheme.colorScheme.surfaceContainer, tonalElevation = 0.dp) {
        for (section in Section.entries) {
            val selected = destination?.hierarchy?.any { it.hasRoute(section.routeClass) } == true ||
                (section == Section.More && destination?.hasRoute(ToolRoute::class) == true)
            NavigationBarItem(
                selected = selected,
                onClick = {
                    if (!selected) haptics.tick()
                    nav.goToSection(section)
                },
                icon = { Icon(if (selected) section.selectedIcon else section.icon, contentDescription = null) },
                label = { Text(section.label, style = MaterialTheme.typography.labelMedium) },
                colors = NavigationBarItemDefaults.colors(indicatorColor = MaterialTheme.colorScheme.primaryContainer),
            )
        }
    }
}

