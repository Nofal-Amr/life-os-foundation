# Life OS native Android app — design and migration plan

Date: 2026-10-23 · Owner decisions in **bold** · Builder's calls marked *(call)*

## Why

The web-view Android app fails offline (black screen, "trying to load") and feels like a
website. The first native pass (`mobile/native`, v0.1) fixed offline loading but is, in the
owner's words, "severely low and basic". The owner wants:

- **A 100% native app (no WebView, no PWA) that matches or beats the web app's UI, animations
  and features.**
- **Everything migrated, and refined, not simplified.**
- **Android features where they are better than the web: premium haptics, gestures, widgets,
  notifications.**

## Goals

1. Feature parity with every page of the web app (inventory below), on a phone, offline.
2. Feels premium: motion, haptics, gestures, typography and spacing at least as good as the web.
3. Every Android-only feature of the old app is ported (SMS/notification spending, widgets,
   prayer and reminder notifications, call alerts, Life Connect, Work clock with fingerprint and
   location, watch link).
4. Opens instantly with or without internet; never loses a change made offline.

## Non-goals

- A new backend. Supabase (tables, row-level security, 8 RPCs) stays as is; the web app keeps
  working unchanged beside the native one.
- iOS.
- Server-side AI (owner decision: on-device only).

## Anti-goals (a failure even if it works)

From the owner's standing rules:
- Invented numbers, scores, targets, or composite percentages. Real logged data only.
- Streaks, loss framing, guilt ("31 days late" in red is a verdict and must go).
  Colour never carries meaning alone and is never good/bad.
- Medical or financial advice. Calm, factual, gain-framed wording.
- Skins change presentation, never numbers. RPG stays opt-in.
- Reading one-time codes from SMS/notifications (owner rule for spending capture).
- Losing data during the switch from the v0.1 native app or from the old app.

## Constraints

- Kotlin 2.0.21, AGP 8.9.1, compileSdk 35, minSdk 26 (what this PC already builds with).
- Builds with `npm run build:native` (Gradle, no Android Studio needed).
- AGENTS.md: never rewrite pushed history; keep `main` working (it deploys the website).
- The v0.1 native app is installed on the owner's phone: the database must migrate, not reset.

## Stack (owner-specified)

| Concern | Choice |
|---|---|
| UI | Jetpack Compose, Material 3 |
| Architecture | MVVM: `ViewModel` exposes one `StateFlow<UiState>`; screens are stateless |
| Async | Coroutines + Flow |
| Network | Retrofit + OkHttp (+ kotlinx.serialization) against Supabase REST (PostgREST) and Auth (GoTrue) |
| Local | Room (synced data), DataStore (session, settings) |
| DI | Hilt |
| Background | WorkManager (sync), AlarmManager (exact prayer/reminder times) |

## Package structure

```
app.lifeos.kt
├─ LifeOsApp.kt                 @HiltAndroidApp
├─ MainActivity.kt              single activity, edge to edge, splash
├─ navigation/                  type-safe routes, bottom bar, transitions
├─ core/
│  ├─ designsystem/             tokens, theme, type, motion, haptics, components
│  ├─ network/                  Retrofit services, auth interceptor + authenticator
│  ├─ database/                 Room db, DAOs, migrations
│  ├─ datastore/                session + app settings
│  ├─ sync/                     SyncEngine, SyncWorker, connectivity trigger
│  ├─ model/                    @Serializable domain models (one per table)
│  └─ common/                   dates, money formatting, result types
├─ data/                        one repository per area (TaskRepository, MoneyRepository…)
└─ feature/
   ├─ auth/  today/  tasks/  projects/  goals/  habits/  money/  body/  food/  resources/
   ├─ spirit/  calendar/  notes/  study/  reminders/  messages/  work/  insights/
   ├─ together/  quests/  review/  week/  time/  settings/  search/
   └─ each: XScreen.kt (UI), XViewModel.kt (state), components/
```

## Data layer

- **Transport and cache (kept from v0.1):** every synced table is mirrored on the phone in
  Room (`synced_rows`: table, id, JSON, dirty, deleted, stamp). Screens only read Room.
- **Typed on top *(call)*:** repositories decode rows into `@Serializable` models with
  kotlinx.serialization (`ignoreUnknownKeys`), so a new server column never breaks the app and
  50 tables don't need 50 hand-written Room schemas. Heavy queries (tasks, transactions) get
  indexed typed tables if profiling shows a need.
- **Writes:** a repository writes the row to Room as dirty, then asks the SyncEngine to run.
- **SyncEngine:** push dirty rows (deletes, then upserts grouped by key set, using each table's
  unique key: `user_id,log_date`, `habit_id,log_date`, …), then pull (paged, `select=*`).
  One table failing never blocks the others. Runs on launch, resume, network regained, after
  each write, and every 30 min via WorkManager.
- **Auth:** OkHttp interceptor adds `apikey` + bearer; an `Authenticator` refreshes on 401
  once. Session in DataStore (migrated from v0.1's SharedPreferences, so no re-sign-in).
  Offline never signs you out.
- **RPCs:** `create_pod`, `join_pod`, `renew_pod_code`, `rename_me_in_pod`, `create_work_org`,
  `join_work_org`, `renew_work_code`, `delete_my_account`. These need the internet; the UI says so.
- **Logic ported, not reinvented:** `src/data/*.ts` holds the rules (balances, payday, prayer
  status, reminders' repeats, week view, stuck helper, insights…). Each is ported to Kotlin with
  its tests ported too, so the numbers match the website exactly.

## Design system (UI translation)

- **Tokens** from `src/styles.css`: background, card, primary, muted, border, the 5 chart
  colours and 8 entity colours, light and dark. Radius 12 dp cards, 8 dp controls.
- **Type:** Hanken Grotesk (Google downloadable font, system fallback), Noto Sans Arabic for
  Arabic. Tabular numbers for money and counts.
- **Components** mapped from the web (`src/components/app`): PageHeader (large title that
  collapses on scroll), SectionTabs (Do: Tasks/Projects/Goals/Habits…), StatCards, TodayRing
  (only with a real stored denominator), AnimatedNumber, HabitDots, PriorityBadge,
  EntityIdentity (icon + colour), DatePicker/DateNav, ConfirmDialog → bottom sheet,
  FormDialog → full-height sheet, States (loading skeleton, empty, error), QuickAdd (FAB menu).
- **Motion:** shared-axis transitions between pages, container transform from a card to its
  detail, spring list animations (`animateItem`), number roll-ups, predictive back.
- **Haptics *(Android-first)*:** one `Haptics` helper: `tick` (chip/toggle), `confirm`
  (task done, prayer logged, payment saved), `reject` (blocked action), `longPress`
  (menus), `gestureThreshold` (swipe passes the action point). Respects the system setting.
- **Gestures *(Android-first)*:** swipe a task right to finish, left to plan/delete (with undo
  snackbar); pull to refresh; long-press for quick actions; drag to reorder where the web does.
- **Material You *(call)*:** brand colours by default; an option in Settings to use the
  wallpaper's colours.

## Android-only features (ported from `mobile/android`)

Prayer notifications with log buttons, reminders (exact alarms), home-screen widgets (Today,
Next, Quick add, Money, Prayer), bank notification spending capture (ticked apps only, never
OTPs, confirm each), SMS spending (Full build only), call alerts and Life Connect, Work clock
(BiometricPrompt + location + mock-location check), focus lock, Qibla compass, timer
notification, Health Connect reading, Wear OS data link, crash report.

## Feature inventory (web → native)

| Web page | Native | Phase |
|---|---|---|
| Sign in / onboarding | Auth, onboarding | 1 |
| Today (dashboard, 1286 lines) | Today | 2 |
| Tasks, steps, stuck helper, focus | Do › Tasks, task detail | 2 |
| Projects, Goals, Capabilities, Habits | Do tabs | 3 |
| Money: overview, transactions, accounts, categories, recurring, payday | Money tabs | 4 |
| Health, Food, body stats, medication, Samsung/Zepp import | Body tabs | 5 |
| Resources (electricity, water, internet, vehicle, fuel) | Money › Resources | 5 |
| Spirit: prayers, sunnah, azkar, tasbih, Qibla, prayer settings | Spirit | 6 |
| Calendar (day/week/month/schedule), Week, Time | Calendar, Week, Time | 7 |
| Notes (checklists, colours, pins, templates) | Notes | 7 |
| Reminders | Reminders + alarms | 6 |
| Study (courses, timetable, assignments, exams) | Study | 8 |
| Work (clock, month sheet, places, people, rules, leaves) | Work | 8 |
| Together (pods, shared lists/events), Messages | Together, Messages | 9 |
| Insights, Daily review, Weekly reset, Quests (RPG), search | as named | 9 |
| Settings (all cards), export, delete account, language | Settings | 9 |
| Widgets, spending capture, Life Connect, watch | Android features | 10 |

## Roadmap

Each phase ends with: builds, unit tests for ported logic, run on the emulator in airplane
mode and online, screenshots beside the web app (demo mode, 375 px) for the owner, commit.

1. **Foundation:** Gradle deps (Hilt, Retrofit, OkHttp, serialization, Navigation, DataStore,
   WorkManager, splash), package restructure, Hilt modules, Retrofit services, session in
   DataStore with migration, SyncEngine + worker, design system (tokens, type, haptics,
   components), navigation shell with transitions. Old screens keep working on the new core.
2. **Today + Do › Tasks at full parity** (the screens used most).
3. Do: Projects, Goals, Capabilities, Habits.
4. Money, all tabs.
5. Body (health, food, medication), Resources.
6. Spirit (all), Reminders + notifications.
7. Calendar, Week, Time, Notes.
8. Study, Work.
9. Together, Messages, Insights, Review, Quests, Search, Settings.
10. Widgets, spending capture, Life Connect, watch link; then the native app takes the
    `app.lifeos` id and replaces the web-view app (with a data hand-over).

## Left to the builder

Exact component APIs, animation curves within the motion rules above, whether a heavy table
gets a typed Room entity, and test structure.
