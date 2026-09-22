---
tags:
  - architecture
  - android
updated: 2026-09-22
---
# Android app

No Capacitor, no Gradle. `mobile/android/build.mjs` builds with aapt2, javac, d8, zipalign and apksigner directly; output `mobile/android/build/life-os-debug.apk`.

- `MainActivity`: a WebView serving the SPA build (`LIFE_OS_MOBILE=1`) from assets at `https://app.lifeos.local`.
- **Bridge** `LifeOSNative` (answers only the app's own host): notifications, reminders, Health Connect status/read, open settings, ongoing timer notification.
- **Deep links**: `lifeos://auth-callback` (Google sign-in) and `lifeos://open/<path>` (always inside the app).
- **Security**: file and content access off; WebView debugging only in debug builds; external links open in the browser.
- **Native parts**: `Reminders` (exact alarms, channels prayers/tasks), `ReminderReceiver`, `BootReceiver`, `TimerNotice`, `HealthReader` (Health Connect via Android 14+ framework APIs).

Runbook: [[Workflows/Release web and Android]]. Health: [[Samsung Health]].
