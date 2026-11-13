# Phase 0 gap analysis — repository against the Master Build Specification

This is deliverable 10 of the Phase 0 audit. It measures `main` at `f682e84` and the live Supabase
project against `docs/MASTER_SPEC.md` as written. It changes nothing and proposes no scope: Phase 1
scope is `docs/phase1/EXECUTION_PROMPT.md`.

## How to read it

- **Basis.** Files on `main`, plus live database metadata gathered read-only in Phase 0. Each row
  names the file or object that supports it.
- **Not included.** The `at-a-glance` branch (8 commits ahead of `main`) is not measured. It
  rebuilds most native screens, so native rows below understate what exists on that branch.
- **Not run.** Android apps were read, not built or run. "Built" means the code is present, not
  that it was seen working.
- **Status words.** Built · Partly · Not built · Different approach (the feature exists but not the
  way the specification describes).
- Specification sections are cited by their heading text, because several phase numbers are used
  twice.

## Summary

1. **The specification's product core does not exist yet.** There is no goal engine: no goal
   hierarchy, capacity budget, realism check or rebalancing. Goals are a flat list with a progress
   percentage.
2. **The foundation items are almost all open.** No organizations model, no per-record versioning,
   no CI for web or Android, no error monitoring, no staging. This matches the audit.
3. **Much of the "planned" list is already built**, in a first form: skins, prayers, health logs,
   the Week screen, electricity tiers, an onboarding flow, a landing page, Arabic and right-to-left
   layout.
4. **Several built modules have no place in the specification**: Work attendance and pay sheets,
   Together, Finance, Resources, time tracking, Study (partly), and Life Connect in its current
   form.
5. **Three areas are built differently from the specification**: document reading (on-device, not
   a server call to an AI provider), device sync (Supabase Realtime, not FCM), and the Android app
   (two apps, not one).
6. **Nothing exists for** medical records, vehicle service history, family and relationships,
   workout logging, passkeys, subscriptions, or the launch-readiness security list beyond RLS.

## Section by section

### "Phase 1 — Foundation" and "Non-functional requirements"

| Requirement | Status | Evidence | Gap |
|---|---|---|---|
| Critical and high audit findings fixed | Not built | `docs/audits/PHASE_0_AUDIT.md` | A1, S1–S3, A2–A5 all open |
| `organizations`, `memberships`, roles; `org_id` on user rows | Not built | No such tables. `org_id` exists only on the six `work_*` tables | Work and Together each have their own membership model (`work_members`, `pod_members`) |
| Idempotent writes with client ids | Partly | Web adds ids to queued inserts (`src/lib/offline.ts:503`); native uses `newId()` (`data/Repositories.kt:26`) | Not uniform; upserts on natural keys behave differently |
| Per-record versioning, conflict policy | Not built | No version column on any table | Audit A2 |
| Retry with backoff | Partly | Web retries every 30 s with no backoff (`src/lib/offline.ts:766`); native uses WorkManager retry | Audit A3 |
| Multi-device edit tests | Not built | One Kotlin file, eight web tests, none across devices | |
| Unit tests | Built | 295 tests in 62 files pass | |
| Integration tests against a staging database | Not built | One manual SQL script for the work tables | |
| End-to-end tests for core flows | Partly | `e2e/intro.e2e.ts`, public pages only | No signed-in coverage |
| CI: lint, type check, tests on every pull request | Not built | Only `.github/workflows/ios.yml` | Audit A6 |
| Error monitoring, structured logging | Not built | No monitoring library in either app | WebView app keeps a local crash log only (`CrashLog.java`) |
| Staging environment | Not built | One Supabase project | |
| Offline-first on web and Android | Partly | `src/lib/offline.ts`; `core/sync/SyncEngine.kt` | Two engines; native covers 17 of 51 tables |
| WCAG 2.1 AA | Unverified | Not assessed in Phase 0 | |

### "Phase 2 — Design system and UX foundation"

| Requirement | Status | Evidence | Gap |
|---|---|---|---|
| Design tokens | Partly | `src/styles.css`; `core/designsystem/Theme.kt` | Defined separately per platform |
| Dark mode | Built | `src/hooks/useTheme.tsx`; `values-night/themes.xml` | |
| Inter and IBM Plex Sans Arabic | Different approach | `package.json` ships Hanken Grotesk and Noto Arabic | Fonts differ from the specification |
| Tabular numerals | Built | `tabular-nums` in 63 files | |
| Arabic and English, right-to-left | Partly | `src/lib/i18n.ts`, `src/lib/i18n.ar.ts` | Arabic covers part of the web app; the native app has no Arabic strings |
| Serious and RPG skins | Built | `user_preferences.skin`; `src/components/app/HubCard.tsx:88` | Implemented as branches in components, not token sets |
| Lucide icons | Built | `lucide-react` in `package.json` | |
| Storybook, visual regression tests | Not built | No Storybook in the repo | |
| Reduced-motion support | Built | `src/styles.css:329` | |
| Skeleton, empty and error states | Built | `src/components/app/States.tsx` | |
| Command palette (Ctrl/Cmd+K) | Built | `src/components/app/UniversalSearch.tsx:78` | |
| Shortcut cheat sheet | Partly | `src/components/app/Shortcuts.tsx` | `?` binding not verified |
| Drag to reschedule | Not built | No drag handling in `src` | |
| Natural-language quick add | Partly | `src/data/capture.ts` | Coverage of repeating phrases not verified |
| Android swipe, haptics | Partly | `core/designsystem/Components.kt:53`, `Haptics.kt` | |
| Android widgets | Different approach | Five widgets in the WebView app (`MoreWidgets.java`, `PrayerWidget.java`, `TodayWidget.java`) | None in the native app |
| Quick Settings tile, Live Updates | Not built | No `TileService`; no promoted notifications | |
| Optimistic writes | Partly | `onMutate` in several web components | Not on every write |

### "Phase 3 — Core goal engine" and "Phase 4 — Focus and ADHD-friendly guardrails"

| Requirement | Status | Evidence | Gap |
|---|---|---|---|
| Goal → quarter → month → week → day | Not built | `goals` has name, status, progress, target date | No hierarchy tables or logic |
| Templates per goal type | Partly | Ready-made project plans in `src/data/plans.ts` | Not tied to goal types |
| Effort estimates | Partly | `tasks.estimated_minutes`, `tasks.energy` | None on goals |
| Capacity budget and overplanning warnings | Not built | Only `energyCapacity` for matching tasks to a check-in (`src/data/tasks.ts:44`) | |
| Realism check, buffer, rebalancing, goal status | Not built | Nothing found | |
| Progress per life dimension | Partly | `src/data/hub.ts` ("follow Maslow loosely") | Not a per-goal or per-year view |
| Daily cap of about three must-do items | Not built | Nothing found | |
| Minimum-viable-day mode | Partly | "Match my energy" on Today; `StuckHelper.tsx`, `ShrinkIt.tsx` | |
| Low-friction capture | Built | `CaptureBox.tsx`, quick-add widget, voice input | |
| No punishing streaks | Partly | Streaks appear only in the RPG skin (`HubCard.tsx:150`) | |
| Eisenhower matrix, protected time | Not built | Priority labels only (`src/data/focus.ts:38`) | |

### "Phase 5 — Health & Gym"

| Requirement | Status | Evidence | Gap |
|---|---|---|---|
| Workout logging, progression, programs | Not built | Workouts appear only as imported samples (`src/data/game.ts:138`) | The whole gym feature set |
| Food log with macros, saved meals | Built | `foods`, `food_logs`; `src/routes/_authenticated/food.tsx` | |
| Barcode scanning, Egyptian food database, meal prep | Not built | No barcode code; one Egyptian dish in a test only | |
| Weight, measurements | Partly | `body_stats`, `health_logs` | No smoothed trend, no photos |
| Health Connect sync | Different approach | `HealthReader.java` in the WebView app | Not in the native app |
| Ramadan mode, injury routing | Not built | Nothing found | |

### "Phase 6 — Family and relationships"

Not built. None of `people`, `relationship_cadences`, `interactions`, `activity_ideas` or
`important_dates` exists. The nearest feature is Together (`pods`, `pod_events`, `pod_lists`), a
shared calendar and lists for a small group, which the specification does not mention.

### "Phase 7 — Spirit"

| Requirement | Status | Evidence | Gap |
|---|---|---|---|
| Prayer times by location and method | Built | `adhan` in web, native and watch; `prayer_settings` | |
| Exact-alarm prayer reminders | Different approach | `Reminders.java` in the WebView app | The native app has reminders but "no ringing yet" (`second-brain/Handoff - next session.md`) |
| Prayer-aware scheduling across modules | Not built | Nothing found | |
| Silence phones at prayer time | Not built | No ringer or Do Not Disturb control | |

### "Phase 8 — Device sync (Poco ↔ S25 Ultra)"

| Requirement | Status | Evidence | Gap |
|---|---|---|---|
| Foreground agent | Built | `ConnectService.java` | In the WebView app only |
| FCM delivery, Supabase tables for state and commands | Different approach | Supabase Realtime broadcast (`ConnectSender.java:83`, `RealtimeSocket.java`); no tables | No Firebase in the repo |
| Battery, ringer, volume, network status | Not built | Nothing found | |
| Call mirroring with `TelephonyCallback` and `CallStyle` | Different approach | `CallStateReceiver.java` uses the phone-state broadcast; `IncomingCallActivity.java` shows a full-screen activity | The specification's fix is not implemented |
| Ringer, volume, media control, find my phone | Not built | A music remote exists only on `at-a-glance` | |
| Explicit pairing, signed and expiring commands | Different approach | One account secret seals messages; 90-second age limit and replay check (`ConnectConfig.java`, `ConnectService.java:156`) | No per-device pairing; audit S8 |
| SMS forwarding | Built, not in the specification | `SmsReceiver.java` | One-time codes forwarded by default |
| Play permission declaration | Not built | | |

### "Phase 9 — Existing backlog", "Phase 10 — Mass adoption", "Phase 11 — Enterprise and college"

| Requirement | Status | Evidence | Gap |
|---|---|---|---|
| Week screen | Built | `src/routes/_authenticated/week.tsx`, in navigation | "Real-data check" not verified |
| Skins switch | Built | Settings; `user_preferences.skin` | |
| Private, consent-based analytics | Partly | `ux_events`, `src/lib/analytics.ts` | No consent step found |
| Electricity tiers with tests | Built | `src/data/tariff.ts`, `tariff.test.ts` | |
| Notes redesign | Unverified | Notes exist; "redesign" has no stated target | |
| Landing page | Built | `src/routes/index.tsx` | |
| Onboarding that builds a first yearly goal | Different approach | `Onboarding.tsx` picks modules | No goal-building step |
| PWA, SEO basics | Partly | `public/manifest.webmanifest`, `public/sw.js`, `robots.txt` | No performance budget |
| Privacy policy | Not built | No such page | |
| Data export, account deletion | Built on web | `ExportDataCard.tsx`; `delete_my_account()` | Neither is in the native app |
| College: courses, assignments | Partly | `courses`, `class_sessions`, `study_items` | No semesters or cohorts |
| Enterprise: teams, roles, admin, SSO | Partly | `work_orgs`, `work_members` roles | Attendance only; no shared goals, no SSO |

### "Phase 9 — Document intelligence pipeline", "Phase 10 — Medical history", "Phase 11 — Vehicle history", "General receipts"

| Requirement | Status | Evidence | Gap |
|---|---|---|---|
| Server-side extraction through an AI provider | Different approach | On-device text recognition (`src/lib/ocr.ts`) and an optional on-device model (`src/lib/localAi.ts`) | No Edge Functions, no provider call, no schema validation, no review screen as specified |
| Medical profiles, lab results, records | Not built | Only `medications`, `medication_logs` | |
| Medication reminders | Not built | Not found in the reminder code | |
| Vehicles | Partly | `resources` of kind `vehicle`; `fuel_fillups`; `src/data/fuel.ts` | No make, model, plate or documents |
| Fuel log and consumption | Built | `src/data/fuel.ts`, `fuel.test.ts` | |
| Service log, intervals, expiry reminders, cost of ownership | Not built | Nothing found | |
| Receipt scanning to categories | Partly | `PhotoReader.tsx`; spending inbox from bank notifications | No itemised extraction or warranties |
| PDF export | Not built | No PDF library | |

### "Phase 1A — Launch readiness"

| Requirement | Status | Evidence | Gap |
|---|---|---|---|
| RLS on every table and bucket | Partly | 51 of 51 tables; `avatars` private | `project-images` is public (audit S7) |
| Automated cross-user tests | Not built | | In Phase 1.2 |
| Service-role key only on the server | Built | Not in the repo; `supabaseAdmin` never imported | |
| Secret scanning, Dependabot | Not built | No configuration in `.github/` | Enabled-in-settings state unverified |
| Rate limiting, bot protection, CSP | Not built | CSP restricts framing only (`src/lib/security-headers.ts:14`) | Audit S10 |
| Android: Keystore, encrypted storage | Partly | Vault key in Keystore (`core/vault/Vault.kt`) | Session and database unencrypted (audit S9) |
| R8 | Built | `isMinifyEnabled = true` in `mobile/native/app/build.gradle.kts` | Release signed with the debug key (audit S3) |
| Play Integrity, audit log, penetration test, legal pages | Not built | | |
| Backups with a tested restore | Unverified | Not readable from here | |
| Passkeys, app unlock, step-up approval, session management | Not built | `BiometricPrompt` is used only for locked notes | |
| Subscriptions and entitlements | Not built | No billing code | |
| Native app: Kotlin, Compose, Room, WorkManager | Built | `mobile/native` | |
| FCM, crash reporting, in-app updates | Not built | | |
| Hosting move to Cloudflare | Not built | Hosting is Vercel per project notes; unverified | Out of Phase 1 scope |

## In the repository but not in the specification

| Module | What it is | Evidence |
|---|---|---|
| Work | Companies, geofenced clock-in, corrections, leave, monthly pay sheet with a rules builder | `work_*` tables; `src/data/work/` |
| Together | Shared calendar and lists for up to 12 people, joined by code | `pods` and four related tables |
| Finance | Accounts, pockets, categories, transactions, recurring costs, payday planning | `src/data/finance.ts` |
| Resources | Meters, quotas and prepaid balances with tariffs | `resources`, `resource_readings` |
| Time tracking | Activities and a running timer | `activities`, `time_entries` |
| Capabilities and evidence | Skills with proof linked to tasks and goals | `capabilities`, `evidence` |
| Daily review, habits, projects, calendar, notes | The original core | Base migration |
| Locked notes | Notes encrypted on the phone | `core/vault/` |
| RPG shop and quests | Rewards bought with earned points | `rpg_rewards`, `rpg_purchases` |
| Watch app, iPhone shell | Prayer tile and Qibla; a web shell | `mobile/wear`, `mobile/ios` |
| WebView Android app | The app most features run in today | `mobile/android` |

The owner's notes after the audit: Work, Study, Finance, Resources and Together are kept; Life
Connect is frozen apart from the one-time-code default.

## Where the specification and the Phase 1 execution scope differ

The execution prompt wins each of these. They are listed so the specification can be revised.

| Specification says | Execution scope says |
|---|---|
| Phase 1 fixes all critical and high findings | A2, A3, A4 and A5 are deferred to later phases |
| Phase 1 delivers robust sync | No sync work in Phase 1 |
| Phase 1 adds `organizations` and `org_id` | Not in Phase 1; to be planned with the sync columns as one schema pass, after checking whether every table needs it |
| Phase 1 adds error monitoring | Not listed in Phase 1 |
| Passkeys, subscriptions and the hosting move are "top priority" | All three are explicitly not approved for Phase 1 |
| The native app gets widgets and the device-sync agent | Native is the long-term app; the WebView app gets security fixes only, and Life Connect is frozen |

## Defects in the specification itself

1. **Phase numbers collide.** Phases 9, 10 and 11 each appear twice, and "Phase 1A" sits beside
   Phase 1.
2. **A stale instruction.** "Start with Phase 0. Do not change any code until I approve the audit
   report" appears mid-document and contradicts every later phase.
3. **"Current state" is out of date.** There are two Android apps, a watch app and an iPhone
   shell; email and password sign-in is in use beside Google; there are two sync engines; skins,
   prayers, health logs, the Week screen and electricity tiers are already built. The web stack is
   TanStack Start, not Vite alone.
4. **Existing modules are missing** (table above).
5. **No single order.** "Phase 1A is top priority" and its v1 list conflict with the numbered
   sequence.
6. **Its Phase 1 overlaps the execution phases** (table above).
7. **Third-party claims are stated as fact** (next section).
8. **Open choices are written as plans**: Polar or Paddle, RevenueCat or an own table, and FCM for
   device sync when the code uses Supabase Realtime.

Two further points found while writing this:

9. **"Encryption at rest" is ambiguous.** It could mean the database host's disk encryption or
   encryption by the app before upload. Locked notes already do the second.
10. **Sending documents to an AI provider reverses a current property.** Today nothing a user
    scans leaves the device. The specification's consent step covers this, but the change should
    be a stated decision.

## Third-party and platform claims

Checked on 2026-11-10 by web search. "Verified" means an official page supported it.

| Claim in the specification | Status | Note |
|---|---|---|
| Supabase JS has passkey methods behind an experimental opt-in | Verified | Beta announced 2026-05-28; needs `supabase-js` 2.105 or later and `auth.experimental.passkey`. Method names differ between Supabase's own pages. [Docs](https://supabase.com/docs/guides/auth/passkeys), [changelog](https://supabase.com/changelog/46458-passkeys-for-supabase-auth-beta) |
| Android: Credential Manager runs the ceremony, Supabase verifies | Unverified | The Supabase pages found cover JavaScript and Flutter; no Kotlin reference was found |
| Vercel Hobby does not allow commercial use | Verified | [Hobby plan](https://vercel.com/docs/plans/hobby), [fair use guidelines](https://vercel.com/docs/limits/fair-use-guidelines) |
| New personal Play accounts must run a closed test; organization accounts skip it | Partly verified | Google's help page confirms 12 testers for 14 days for personal accounts created after 2023-11-13. The organization exemption and the D-U-N-S detail came from third-party pages only. [Google help](https://support.google.com/googleplay/android-developer/answer/14151465) |
| Polar supports sellers in Egypt | Unverified | The country list could not be read from this environment. The owner's adviser reports having checked it. [Polar list](https://polar.sh/docs/merchant-of-record/supported-countries) |
| Paddle supports sellers in Egypt | Unverified | Paddle lists Egypt as a country buyers can pay from, which is a different question. [Paddle list](https://developer.paddle.com/concepts/sell/supported-countries-locales) |
| Paymob and Fawry support recurring billing | Unverified | Not checked |
| Android 16 Live Updates for timers and calls | Partly verified | The full behaviour arrived in Android 16 QPR1, not the first stable release, and needs a declared permission. Official developer pages were not among the results |
| Call-log permissions are restricted on Play | Unverified | Not checked; consistent with the WebView app's "Full build" note in `mobile/android/AndroidManifest.xml` |
| `TelephonyCallback`, `CallStyle`, `setTimeoutAfter` exist as described | Unverified | Not checked against Android documentation |
| Egypt's Law 151 of 2020 governs personal data | Unverified | Needs legal review, as the specification itself says |

## What this means for the specification's next revision

- Decide the order once: foundation, sync contract with one schema pass, consolidation, hardening,
  then passkeys, subscriptions and hosting, then the v1 feature modules.
- Add the existing modules with a status for each.
- Rewrite "Current state" from the audit.
- Turn the open choices into a decisions list.
- Before planning `org_id`, decide how it relates to `work_orgs` and `pods`.
