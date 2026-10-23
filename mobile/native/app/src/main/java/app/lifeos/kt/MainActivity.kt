package app.lifeos.kt

import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import app.lifeos.kt.data.SessionData
import app.lifeos.kt.ui.LifeOsTheme
import app.lifeos.kt.ui.SignInScreen
import app.lifeos.kt.ui.TasksScreen

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        handleCallback(intent)
        setContent {
            LifeOsTheme {
                val session by app.session.current.collectAsState()
                if (session == null) SignInScreen() else TasksScreen()
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleCallback(intent)
    }

    override fun onResume() {
        super.onResume()
        app.sync.request()
    }

    /** lifeosnative://auth-callback#access_token=… from the website after Google sign-in. */
    private fun handleCallback(intent: Intent?) {
        val data = intent?.data ?: return
        if (data.scheme != "lifeosnative" || data.host != "auth-callback") return
        val session = data.encodedFragment?.let(SessionData::fromCallbackFragment)
        if (session != null) app.signedIn(session)
        else Toast.makeText(this, "Google sign-in didn't finish. Please try again.", Toast.LENGTH_LONG).show()
        setIntent(Intent(intent).setData(null))
    }
}
