package app.lifeos.kt.core.datastore

import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.flow.Flow

/** The session as sync and token refresh need it; SessionStore on the phone, a fake in tests. */
interface SessionSource {
    fun current(): Session?
    suspend fun save(session: Session)
    suspend fun clear()
}

/** When the phone last synced; AppSettings on the phone, a fake in tests. */
interface SyncClock {
    val lastSynced: Flow<Long?>
    suspend fun setLastSynced(millis: Long)
}

@Module
@InstallIn(SingletonComponent::class)
abstract class SeamsModule {
    @Binds abstract fun session(store: SessionStore): SessionSource
    @Binds abstract fun clock(settings: AppSettings): SyncClock
}
