---
tags: [handoff]
updated: 2026-10-24
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
- Owner wants it **like the old app, not just tasks**: same five sections at the bottom
  (Today, Do, Money, Body, Spirit) + More for the tools.
- Every other table is synced generically (`data/Rows.kt`, `SYNCED_TABLES`, stored as JSON in
  `synced_rows`; upserts use each table's unique key). Add a table there to have it offline.
- Done: Today (next action, prayer, money left, due), Do (tasks), Money (left to spend, accounts,
  recent, add expense/income), Body (sleep, mood, water, trained, medication list, recent days),
  Spirit (five prayers with times from prayer_settings, status chips), More → Calendar (14-day
  agenda), Habits, Notes, Reminders (no ringing yet), Projects & goals. Work, Study, Messages,
  Insights, Together, Daily review still open the website.
- Tested on the emulator (Pixel_8_Pro_API_35): opens offline with tasks in ~1.3 s (release),
  tasks added offline survive a force-stop, 401 → refresh → sign-in. Not yet tested with a real account.

**Status 2026-10-24:** Today, Do, Money (pushed, 6a576e3), Body, Spirit (pushed, d0e622c) and Calendar (not pushed yet) are at website parity and remade (copy, critique, refine; see memory life-os-native-taste). 49 unit tests. Test in demo mode on the emulator against lifeos0.vercel.app demo; numbers must match.
**Next:** Week (web src/routes/_authenticated/week.tsx: a review of the week, day by day), then Work (fingerprint clock-in + sites from location), notifications (prayer + reminders + medication), widgets, then the remaining More tools. Then, Calendar/Week, Work (fingerprint + sites), notifications, widgets.
**Owner wants work to continue automatically after a session reset: a new session should read this and keep going without asking.**

Phase 1 done (commit bba1767): architecture, refined flows, locked notes, prayer windows. Plan: docs/superpowers/specs/2026-10-23-native-android-design.md (widgets table at the end).

Next, in order:
1. Work: fingerprint clock in/out (`androidx.biometric` or the platform BiometricPrompt as in
   `mobile/android/src/app/lifeos/WorkClock.java`), add a site/workplace from current location
   (`work_places`: org_id, name, kind office|site, latitude, longitude, radius_m 20–500), `work_events` saved offline.
2. Reminders/prayer notifications, then Study, Daily review, Insights, Together, Messages.
3. Deeper pages inside sections (task edit/steps, budgets, recurring, food, resources, Spirit settings).
4. Port the Java extras (widgets, SMS spending).

## Ideas / open
- Today (web) still dense ("Coming up" twice) — simplify.
- Google Calendar sync needs an OAuth client ID.
- Keep sessions short: one request at a time.
