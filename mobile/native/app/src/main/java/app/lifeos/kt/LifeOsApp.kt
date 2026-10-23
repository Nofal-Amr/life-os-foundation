package app.lifeos.kt

import android.app.Application
import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import app.lifeos.kt.data.LifeOsDb
import app.lifeos.kt.data.SessionData
import app.lifeos.kt.data.SessionStore
import app.lifeos.kt.data.Supabase
import app.lifeos.kt.data.Sync
import app.lifeos.kt.data.TaskRepo
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/** Holds the app's single database, session and sync; screens get them from here. */
class LifeOsApp : Application() {
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    lateinit var api: Supabase
    lateinit var session: SessionStore
    lateinit var db: LifeOsDb
    lateinit var sync: Sync
    lateinit var tasks: TaskRepo

    override fun onCreate() {
        super.onCreate()
        api = Supabase(BuildConfig.SUPABASE_URL, BuildConfig.SUPABASE_KEY)
        session = SessionStore(this, api)
        db = LifeOsDb.open(this)
        sync = Sync(this, api, session, db.tasks(), scope)
        tasks = TaskRepo(db.tasks(), sync)

        // Back online: send what was saved on the phone meanwhile.
        getSystemService(ConnectivityManager::class.java).registerDefaultNetworkCallback(
            object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: Network) = sync.request()
            },
        )
    }

    /** A new sign-in. Another account's data never mixes with this one's. */
    fun signedIn(fresh: SessionData) {
        val prefs = getSharedPreferences("owner", Context.MODE_PRIVATE)
        val owner = prefs.getString("userId", null)
        scope.launch {
            if (owner != null && owner != fresh.userId) db.tasks().clear()
            prefs.edit().putString("userId", fresh.userId).apply()
            session.save(fresh)
            sync.request()
        }
    }

    /** Signs out and forgets everything on this phone. */
    fun signOut() {
        scope.launch {
            session.clear()
            db.tasks().clear()
            getSharedPreferences("owner", Context.MODE_PRIVATE).edit().clear().apply()
            getSharedPreferences("sync", Context.MODE_PRIVATE).edit().clear().apply()
        }
    }
}

val Context.app: LifeOsApp get() = applicationContext as LifeOsApp
