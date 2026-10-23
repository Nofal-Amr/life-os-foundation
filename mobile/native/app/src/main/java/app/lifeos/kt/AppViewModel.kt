package app.lifeos.kt

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.lifeos.kt.core.datastore.AppSettings
import app.lifeos.kt.core.datastore.SessionState
import app.lifeos.kt.core.designsystem.SyncStatus
import app.lifeos.kt.core.network.sessionFromCallbackFragment
import app.lifeos.kt.core.sync.SyncEngine
import app.lifeos.kt.data.AccountRepository
import app.lifeos.kt.data.LocalStore
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/** App-wide state for the shell: who's signed in, where the data is, and look-and-feel settings. */
@HiltViewModel
class AppViewModel @Inject constructor(
    private val account: AccountRepository,
    private val sync: SyncEngine,
    store: LocalStore,
    settings: AppSettings,
) : ViewModel() {
    val session: StateFlow<SessionState> = account.state

    val syncStatus: StateFlow<SyncStatus> = combine(sync.state, store.pending) { state, pending ->
        SyncStatus(state, pending, sync::request)
    }.stateIn(viewModelScope, SharingStarted.Eagerly, SyncStatus(syncNow = sync::request))

    val dynamicColor = settings.dynamicColor.stateIn(viewModelScope, SharingStarted.Eagerly, false)
    val haptics = settings.haptics.stateIn(viewModelScope, SharingStarted.Eagerly, true)

    fun syncNow() = sync.request()

    /** lifeosnative://auth-callback#access_token=… from the website after Google sign-in. Returns false if unreadable. */
    fun handleGoogleCallback(fragment: String?): Boolean {
        val fresh = fragment?.let(::sessionFromCallbackFragment) ?: return false
        viewModelScope.launch { account.signedIn(fresh) }
        return true
    }
}
