package app.lifeos.kt

import android.app.Application
import android.net.ConnectivityManager
import android.net.Network
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import app.lifeos.kt.core.sync.SyncEngine
import app.lifeos.kt.core.sync.SyncWorker
import app.lifeos.kt.core.vault.Vault
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.ProcessLifecycleOwner
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject

@HiltAndroidApp
class LifeOsApp : Application(), Configuration.Provider {
    @Inject lateinit var workerFactory: HiltWorkerFactory
    @Inject lateinit var sync: SyncEngine
    @Inject lateinit var vault: Vault
    @Inject lateinit var reminders: app.lifeos.kt.core.notify.ReminderScheduler

    /** Lives as long as the app's process: keeps the week's reminders in step with the data. */
    private val appScope = kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.SupervisorJob() + kotlinx.coroutines.Dispatchers.Default)

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder().setWorkerFactory(workerFactory).build()

    override fun onCreate() {
        super.onCreate()
        SyncWorker.schedule(this)
        reminders.start(appScope)
        // Locked notes close as soon as the app leaves the screen.
        ProcessLifecycleOwner.get().lifecycle.addObserver(LifecycleEventObserver { _, event -> if (event == Lifecycle.Event.ON_STOP) vault.lock() })
        // Back online: send what was saved on the phone meanwhile.
        getSystemService(ConnectivityManager::class.java).registerDefaultNetworkCallback(
            object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: Network) = sync.request()
            },
        )
    }
}
