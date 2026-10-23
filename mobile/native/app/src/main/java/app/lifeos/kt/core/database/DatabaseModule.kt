package app.lifeos.kt.core.database

import android.content.Context
import androidx.room.Room
import app.lifeos.kt.core.common.ApplicationScope
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {
    @Provides
    @Singleton
    fun database(@ApplicationContext context: Context): LifeOsDatabase =
        Room.databaseBuilder(context, LifeOsDatabase::class.java, LifeOsDatabase.NAME)
            .addMigrations(LifeOsDatabase.ADD_ROWS, LifeOsDatabase.TASKS_INTO_ROWS)
            .build()

    @Provides
    fun rows(db: LifeOsDatabase): RowDao = db.rows()

    @Provides
    @Singleton
    @ApplicationScope
    fun applicationScope(): CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
}
