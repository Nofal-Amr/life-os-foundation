Owner decision (2026-11-12):

- **Adhan sounds are postponed (not now), not dropped.** The alarm does NOT replace the adhan; they are different things.
- **Wanted:** beside each prayer (Fajr, Shurooq, Dhuhr, Asr, Maghrib, Isha), one tap sets an alarm on the phone's own Clock app. The alarm is set a chosen number of minutes before the prayer time (default 10). The offset comes from a slider in Spirit settings, and Shurooq could use, for example, 20.
- The alarm is a wake-up aid, mainly for Fajr. The use case: "I am sleepy, open the app, click the Fajr alarm" and it's done.

**Why:** the owner wants the phone's real alarm clock (reliable, loud, snooze), not an in-app ringer.

**How to apply:**

- Android: use `AlarmClock.ACTION_SET_ALARM` with HOUR/MINUTES/MESSAGE and `EXTRA_SKIP_UI` (needs the `com.android.alarm.permission.SET_ALARM` permission).
- In the WebView app, expose it through the `LifeOSNative` bridge in `mobile/android/src/app/lifeos/MainActivity.java`.
- Show the button only when the bridge exists. Plain web can't set a phone alarm, so say "available in the Android app".
- Learn from other apps; discard their bad parts. See [inspiration-not-copy](inspiration-not-copy.md) and [competitive-benchmark](competitive-benchmark.md).
