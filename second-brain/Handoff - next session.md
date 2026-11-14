---
tags: [handoff]
updated: 2026-11-13
---

# Handoff for the next session

## Web simplification (redesign draft steps), 2026-11-13
Plan: `docs/superpowers/specs/2026-11-12-today-tasks-navigation-redesign.md`. Each step is its own branch and PR, cut from `origin/main`, checked green (tsc, vitest, eslint, build, headless demo at 375/1280).
- Done, merged: one row pattern on seven list screens (`ListRow`, PR #17).
- **Open, green, waiting to be merged** (the merge was refused by this session's permission check, so the owner or a session allowed to merge must do it):
  - #28 `ux/short-forms`: New task = Title, Due, Project; habit and project = Name; the rest under "More options" (`MoreOptions`, "3 set" hint, opens when editing).
  - #29 `ux/nav-groups`: More sheet and side menu grouped Plan / Library / Shared (`src/data/navGroups.ts`); Week and Time moved from Today's tabs into Plan; Import a plan listed. No address changed, so no redirects.
  - #31 `ux/week-ahead`: Week = the next seven days (tasks, events, bills expected) with "+ Plan" per day; the look back moved to Insights as "Week by week" (`WeekReview`).
  - #34 `ux/goal-links`: goals show linked habits with days logged in the last seven; tick habits in the goal's edit dialog. **Needs the owner to approve `supabase/migrations/20261114090000_habit_goals.sql`** (nullable `habits.goal_id`); hidden until then, safe to merge before.
- The four touch different files; #31 also touches `ListRow.tsx` (padding only).
- Next: opt-in areas at sign-up; evening ritual (move unfinished to tomorrow + day summary); then text sizes, Capabilities into goals, Categories opened from Transactions, Messages shown only once Life Connect is set up.
- Worktrees: `../lo-forms`, `../lo-nav`, `../lo-week`, `../lo-goals` (each with its own `bun install`). Python isn't installed; use node or sed for scripted edits.

## Relationships — demo-only, 2026-11-13
- `/relationships`: people map (Me in the centre, rings; select someone and their side glows), list view, person sheet (log, goal, birthday, check-in rhythm), reminder rules with exceptions, People card in Today (max 3 check-ins).
- Opt-in area: Settings → Areas → Relationships. On in the demo.
- **Waiting on the owner:** `supabase/migrations/20261113120000_relationships.sql` is not applied. Approve the exact SQL, staging first. Until then the page says it needs a one-time update.
- Follow-up: on a phone the full family map draws small; pinch to read outer names. Consider a closer default zoom.
- Docs: `docs/research/2026-11-13-relationships-benchmark.md`, `docs/superpowers/specs/2026-11-13-relationships-design.md`.

## 2026-11-13: `at-a-glance` is merged into `main`

- The owner approved it. `at-a-glance` (native Kotlin app at website parity for Today, Do, Money,
  Body, Spirit and Calendar, plus the Life Connect music remote) is now on `main` through a pull
  request. The branch itself is kept, not deleted.
- **Work continues on `main`:** branch every change from `origin/main`, one pull request per
  concern. Don't add new work to `at-a-glance`.
- **The native app (`mobile/native`) is still paused** until the owner approves the web design
  (see the `life-os` skill). Ship the website first. The notes below on the native app are kept
  for when it resumes.
- The music remote (`MediaRemote.java`, `MediaAlert.java`, `MusicRemote.tsx`) sits beside the
  security gate in `MainActivity` (`AuthCallbackGate`); it still needs a try on two real phones.

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
**Life Connect music remote (8a1e2ec, old web-view app):** main phone controls play/pause/skip/volume on the SIM phone (MediaRemote.java, MediaAlert.java, MusicRemote.tsx). Compiled, not yet tried on two real phones. Port it with the rest of Life Connect into the native app (phase 10).
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
- Google Calendar sync (2026-11-13): built and merged behind "Not set up yet". It switches on when the owner adds GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_TOKEN_KEY in Vercel and approves `supabase/migrations/20261113120100_google_calendar_sync.sql`. Design: docs/superpowers/specs/2026-11-13-google-calendar-sync-design.md.
- Keep sessions short: one request at a time.
