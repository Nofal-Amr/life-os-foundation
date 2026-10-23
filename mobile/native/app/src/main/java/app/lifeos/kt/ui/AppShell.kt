package app.lifeos.kt.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CheckBox
import androidx.compose.material.icons.outlined.Dashboard
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.GridView
import androidx.compose.material.icons.outlined.AccountBalanceWallet
import androidx.compose.material.icons.outlined.DarkMode
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector

/** The five sections at the bottom, as in the web app, plus More for the tools. */
enum class Section(val label: String, val icon: ImageVector) {
    Today("Today", Icons.Outlined.Dashboard),
    Do("Do", Icons.Outlined.CheckBox),
    Money("Money", Icons.Outlined.AccountBalanceWallet),
    Body("Body", Icons.Outlined.FavoriteBorder),
    Spirit("Spirit", Icons.Outlined.DarkMode),
    More("More", Icons.Outlined.GridView),
}

@Composable
fun AppShell() {
    var section by rememberSaveable { mutableStateOf(Section.Today) }
    var tool by rememberSaveable { mutableStateOf<String?>(null) }

    // Back: out of a tool, then to Today, then out of the app.
    BackHandler(enabled = tool != null || section != Section.Today) {
        if (tool != null) tool = null else section = Section.Today
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        contentWindowInsets = WindowInsets(0),
        bottomBar = {
            NavigationBar(containerColor = MaterialTheme.colorScheme.surfaceContainer) {
                for (item in Section.entries) {
                    NavigationBarItem(
                        selected = section == item,
                        onClick = {
                            section = item
                            tool = null
                        },
                        icon = { Icon(item.icon, contentDescription = null) },
                        label = { Text(item.label) },
                    )
                }
            }
        },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            when (section) {
                Section.Today -> TodayScreen(open = { section = it })
                Section.Do -> TasksScreen()
                Section.Money -> MoneyScreen()
                Section.Body -> BodyScreen()
                Section.Spirit -> SpiritScreen()
                Section.More -> {
                    val current = tool
                    if (current == null) MoreScreen(open = { tool = it }) else ToolScreen(current, close = { tool = null })
                }
            }
        }
    }
}
