---
tags: [handoff]
updated: 2026-10-23
---

# Handoff for the next session

## Native Android app (Kotlin + Compose) — started 2026-10-23
Owner said yes to the rewrite: the web-view app "fails miserably". Pain, in order:
1. **Offline loading** (black screen, "trying to load") — worst.
2. Fingerprint clock-in.
3. Adding a location for a site / workplace.

Where it is: `mobile/native` (Gradle), `npm run build:native` → `mobile/android/build/life-os-native.apk`.
- Own app id `app.lifeos.kt`, installs beside the old app (`app.lifeos`) until it covers enough.
- Offline-first: Room database on the phone; screens only read it. `data/Sync.kt` pushes local
  changes (dirty rows) then pulls the server copy, on launch, resume, back-online and after each edit.
- Session kept on the phone (`data/Session.kt`); offline never signs out. A refused refresh does.
- Sign-in: email/password, or Google via the website (`/auth?handoff=native` →
  `lifeosnative://auth-callback#…`). Needs the website change in `src/routes/auth.tsx` deployed.
- Done: Tasks (late / today / coming up / no date / done today; add, finish, undo, long-press delete).
- Tested on the emulator (Pixel_8_Pro_API_35): opens offline with tasks in ~1.3 s (release),
  tasks added offline survive a force-stop, 401 → refresh → sign-in. Not yet tested with a real account.

Next, in order:
1. Work: fingerprint clock in/out (`androidx.biometric` or the platform BiometricPrompt as in
   `mobile/android/src/app/lifeos/WorkClock.java`), add a site/workplace from current location
   (`work_places`: org_id, name, kind office|site, latitude, longitude, radius_m 20–500), `work_events` saved offline.
2. Money (transactions) and Today.
3. Then the other screens one by one; port the Java extras (widgets, SMS spending, reminders, prayer).

## Ideas / open
- Today (web) still dense ("Coming up" twice) — simplify.
- Google Calendar sync needs an OAuth client ID.
- Keep sessions short: one request at a time.
