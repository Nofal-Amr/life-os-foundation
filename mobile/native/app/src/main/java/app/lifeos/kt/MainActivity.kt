package app.lifeos.kt

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.widget.Toast
import androidx.fragment.app.FragmentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.animation.Crossfade
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import app.lifeos.kt.core.auth.PendingSignIn
import app.lifeos.kt.core.datastore.SessionState
import app.lifeos.kt.core.designsystem.LifeOsTheme
import app.lifeos.kt.core.designsystem.LocalHapticsEnabled
import app.lifeos.kt.feature.auth.SignInScreen
import app.lifeos.kt.navigation.LifeOsShell
import app.lifeos.kt.data.DemoSeed
import app.lifeos.kt.core.notify.canNotify
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : FragmentActivity() {
    private val app: AppViewModel by viewModels()

    /** Android 13+: asked once, after signing in, so reminders can show. */
    private val askNotifications = registerForActivityResult(androidx.activity.result.contract.ActivityResultContracts.RequestPermission()) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        // The splash stays only until the phone's session store has opened (milliseconds).
        installSplashScreen().setKeepOnScreenCondition { app.session.value is SessionState.Loading }
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        handleCallback(intent)
        handleOpen(intent)
        askForNotificationsOnce()
        setContent {
            val session by app.session.collectAsStateWithLifecycle()
            val dynamicColor by app.dynamicColor.collectAsStateWithLifecycle()
            val haptics by app.haptics.collectAsStateWithLifecycle()
            val theme by app.theme.collectAsStateWithLifecycle()
            LifeOsTheme(dynamicColor = dynamicColor, theme = theme) {
                CompositionLocalProvider(LocalHapticsEnabled provides haptics) {
                    Crossfade(targetState = session is SessionState.SignedIn, label = "session") { signedIn ->
                        when {
                            signedIn -> LifeOsShell(app)
                            session is SessionState.SignedOut -> SignInScreen()
                            else -> Unit
                        }
                    }
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleCallback(intent)
        handleOpen(intent)
    }

    /** A notification tapped: open the part of the app it's about. */
    private fun handleOpen(intent: Intent?) {
        val open = intent?.getStringExtra(EXTRA_OPEN) ?: return
        intent.removeExtra(EXTRA_OPEN)
        app.open(open)
    }

    private fun askForNotificationsOnce() {
        if (android.os.Build.VERSION.SDK_INT < 33) return
        lifecycleScope.launch {
            val signedIn = app.session.first { it is SessionState.SignedIn } as SessionState.SignedIn
            if (signedIn.session.userId == DemoSeed.USER) return@launch
            if (app.askedNotifications() || canNotify(this@MainActivity)) return@launch
            app.markAskedNotifications()
            askNotifications.launch(android.Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    companion object {
        /** Which part to open, from a notification ("spirit", "do", "task:<id>", "reminders"…). */
        const val EXTRA_OPEN = "app.lifeos.kt.OPEN"
    }

    override fun onResume() {
        super.onResume()
        app.syncNow()
    }

    private fun handleCallback(intent: Intent?) {
        val data = intent?.data ?: return
        if (data.scheme != "lifeosnative" || data.host != "auth-callback") return
        setIntent(Intent(intent).setData(null))
        // Only a sign-in this app started, and only once (see CallbackGate): otherwise any link
        // could sign the app in to someone else's account.
        if (!PendingSignIn(this).take()) {
            Log.w("LifeOS", "sign-in link ignored: no sign-in was started from the app")
            return
        }
        if (!app.handleGoogleCallback(data.encodedFragment)) {
            Toast.makeText(this, "Google sign-in didn't finish. Please try again.", Toast.LENGTH_LONG).show()
        }
    }
}
