package app.lifeos.kt.core.datastore

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.SharedPreferencesMigration
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.appSettings: DataStore<Preferences> by preferencesDataStore(
    name = "app_settings",
    // 0.1's "owner" (whose data is on the phone) and "sync" (when it last synced).
    produceMigrations = { context ->
        listOf(SharedPreferencesMigration(context, "owner"), SharedPreferencesMigration(context, "sync"))
    },
)

/** Settings that belong to this phone, not the account. */
@Singleton
class AppSettings @Inject constructor(@ApplicationContext context: Context) : SyncClock {
    private val store = context.appSettings

    /** The account whose data is on this phone; another account's sign-in clears it first. */
    suspend fun owner(): String? = store.data.first()[OWNER]
    suspend fun setOwner(userId: String?) = store.edit { if (userId == null) it.remove(OWNER) else it[OWNER] = userId }

    override val lastSynced: Flow<Long?> = store.data.map { it[LAST_SYNCED] }
    override suspend fun setLastSynced(millis: Long) {
        store.edit { it[LAST_SYNCED] = millis }
    }

    /** Material You: the wallpaper's colours instead of Life OS's own. Off by default. */
    val dynamicColor: Flow<Boolean> = store.data.map { it[DYNAMIC_COLOR] ?: false }
    suspend fun setDynamicColor(on: Boolean) = store.edit { it[DYNAMIC_COLOR] = on }

    /** Light, dark, or "system" (follow the phone). The phone's choice by default. */
    val theme: Flow<String> = store.data.map { it[THEME] ?: "system" }
    suspend fun setTheme(value: String) = store.edit { it[THEME] = value }

    /** Phone reminders (prayers, tasks, azkar, water) as JSON; null = the defaults. Per phone, as on the web. */
    val reminders: Flow<String?> = store.data.map { it[REMINDERS] }
    suspend fun setReminders(json: String) = store.edit { it[REMINDERS] = json }

    /** The ids of the alarms set last time, so they can be cancelled before setting new ones. */
    val scheduledAlarms: Flow<String?> = store.data.map { it[SCHEDULED] }
    suspend fun setScheduledAlarms(json: String) = store.edit { it[SCHEDULED] = json }

    /** Whether the app has asked for notification permission once already. */
    val askedNotifications: Flow<Boolean> = store.data.map { it[ASKED_NOTIFY] ?: false }
    suspend fun setAskedNotifications() = store.edit { it[ASKED_NOTIFY] = true }

    /** Touch feedback on actions. On by default; the phone's own setting still applies. */
    val haptics: Flow<Boolean> = store.data.map { it[HAPTICS] ?: true }
    suspend fun setHaptics(on: Boolean) = store.edit { it[HAPTICS] = on }

    /** Notes: the label Notes opens on ("only #Work"), or null for everything. */
    val notesFocus: Flow<String?> = store.data.map { it[NOTES_FOCUS] }
    suspend fun setNotesFocus(label: String?) = store.edit { if (label == null) it.remove(NOTES_FOCUS) else it[NOTES_FOCUS] = label }

    /** The locked-notes key, wrapped by a fingerprint-only hardware key; null when fingerprint unlock is off. */
    val vaultWrapped: Flow<String?> = store.data.map { it[VAULT_WRAPPED] }
    suspend fun setVaultWrapped(value: String?) = store.edit { if (value == null) it.remove(VAULT_WRAPPED) else it[VAULT_WRAPPED] = value }

    /** A running focus session as JSON (startedAt, minutes, habit to tick); null when none. */
    val focusSession: Flow<String?> = store.data.map { it[FOCUS_SESSION] }
    suspend fun setFocusSession(json: String?) = store.edit { if (json == null) it.remove(FOCUS_SESSION) else it[FOCUS_SESSION] = json }

    /** "Not today" on a stuck task: task id → the day it was hidden. */
    val stuckSnoozes: Flow<String?> = store.data.map { it[STUCK_SNOOZE] }
    suspend fun setStuckSnoozes(json: String) = store.edit { it[STUCK_SNOOZE] = json }

    suspend fun clearAccountData() = store.edit {
        it.remove(OWNER)
        it.remove(LAST_SYNCED)
        it.remove(NOTES_FOCUS)
        it.remove(VAULT_WRAPPED)
    }

    private companion object {
        val OWNER = stringPreferencesKey("userId")
        val LAST_SYNCED = longPreferencesKey("lastSynced")
        val DYNAMIC_COLOR = booleanPreferencesKey("dynamicColor")
        val HAPTICS = booleanPreferencesKey("haptics")
        val THEME = stringPreferencesKey("theme")
        val REMINDERS = stringPreferencesKey("reminders")
        val SCHEDULED = stringPreferencesKey("scheduledAlarms")
        val ASKED_NOTIFY = booleanPreferencesKey("askedNotifications")
        val NOTES_FOCUS = stringPreferencesKey("notesFocus")
        val VAULT_WRAPPED = stringPreferencesKey("vaultWrapped")
        val FOCUS_SESSION = stringPreferencesKey("focusSession")
        val STUCK_SNOOZE = stringPreferencesKey("stuckSnooze")
    }
}
