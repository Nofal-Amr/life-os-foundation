package app.lifeos.kt

import android.content.Intent
import android.os.Bundle
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
import app.lifeos.kt.core.datastore.SessionState
import app.lifeos.kt.core.designsystem.LifeOsTheme
import app.lifeos.kt.core.designsystem.LocalHapticsEnabled
import app.lifeos.kt.feature.auth.SignInScreen
import app.lifeos.kt.navigation.LifeOsShell
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : FragmentActivity() {
    private val app: AppViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        // The splash stays only until the phone's session store has opened (milliseconds).
        installSplashScreen().setKeepOnScreenCondition { app.session.value is SessionState.Loading }
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        handleCallback(intent)
        setContent {
            val session by app.session.collectAsStateWithLifecycle()
            val dynamicColor by app.dynamicColor.collectAsStateWithLifecycle()
            val haptics by app.haptics.collectAsStateWithLifecycle()
            LifeOsTheme(dynamicColor = dynamicColor) {
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
    }

    override fun onResume() {
        super.onResume()
        app.syncNow()
    }

    private fun handleCallback(intent: Intent?) {
        val data = intent?.data ?: return
        if (data.scheme != "lifeosnative" || data.host != "auth-callback") return
        if (!app.handleGoogleCallback(data.encodedFragment)) {
            Toast.makeText(this, "Google sign-in didn't finish. Please try again.", Toast.LENGTH_LONG).show()
        }
        setIntent(Intent(intent).setData(null))
    }
}
