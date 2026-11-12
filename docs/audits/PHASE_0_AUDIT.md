# Life OS — Phase 0 audit report

Read-only audit of `Nofal-Amr/life-os-foundation` at `f682e84` (the working branch is identical to `main`) and the live Supabase project. Nothing in the repository, database or deployments was changed.

**What I could not inspect:**
- **Master Build Specification:** it is not in the repository and was not attached, so deliverable 10 is provisional only.
- **Vercel:** the connector returned 403 for the team scope, and the sandbox blocked fetching the public site. Deployed headers, environment variables and deploy settings are unverified.
- **Android and iOS:** the apps were read, not built or run. Kotlin/Java tests and Playwright E2E were not executed (no SDK or browser target here).
- **Supabase Auth settings:** redirect allow-list, token lifetimes and rate limits are not readable through SQL.
- **RLS behaviour:** assessed from live policy and grant metadata, not by cross-user tests. The one existing RLS script inserts into `auth.users`, so I did not run it against production.

## 1. Executive summary

- **Row-level security is sound.** All 51 public tables have RLS enabled with policies, the anonymous role has no policies, and no service-role key appears in the repo or is used by any code.
- **No Critical security vulnerability was confirmed.** The most serious are two High issues in the mobile sign-in hand-off, which passes full sessions through custom URL schemes.
- **The schema cannot be rebuilt from the repo.** This is the one Critical finding, and it is architectural. Five tables, many columns, a bucket and a function exist only in the live database, and migration history does not match the files.
- **Sync is the weakest subsystem.** Web and native Android use two unrelated engines. Neither detects conflicts, and both can silently lose writes.
- **Code health is reasonable.** 295 unit tests in 62 files pass, and `tsc --noEmit` is clean. Lint fails with 10,235 errors, 10,233 of them formatting.
- **There is no web CI and `main` is unprotected.** The only workflow compiles the iOS shell.

**Recommendation:** the foundation is suitable to keep, but it needs foundational corrections before more features: schema source of truth, sync protocol, and mobile auth hand-off.

## 2. Current verified architecture

```
 Web (TanStack Start + React 19, SSR shell, client-only data)
   supabase-js, implicit flow, session in localStorage
   src/lib/offline.ts: fetch interceptor -> IndexedDB response cache + outbox
        |
        |  same bundle, built with LIFE_OS_MOBILE=1
        v
 Android WebView app  app.lifeos 0.3.1  (Java, hand-built, no Gradle)
   serves bundle from APK assets at https://app.lifeos.local
   JS bridge LifeOSNative: reminders, widgets, Health Connect,
   fingerprint clock-in, SMS/call relay ("Life Connect"), spending inbox
        |
 Android native app   app.lifeos.kt 0.2  (Kotlin, Compose, Hilt, Room)
   Room table synced_rows (raw JSON + dirty/deleted flags), 17 of 51 tables
   SyncEngine: push dirty rows (upsert) -> pull whole table, every sync
        |
 iOS shell (WKWebView -> live site)     Wear OS app (prayer tile, no network)
        |
        v
 Supabase project (eu-central-1, Postgres 17)
   PostgREST + RLS: 51 tables, 22 functions, 13 callable SECURITY DEFINER RPCs
   Auth: email/password + Google (8 accounts, 0 MFA factors)
   Storage: avatars (private), project-images (public)
   Realtime: broadcast only, used by Life Connect with the anon key
   Edge Functions: none.  pg_cron: none.  Server functions in the app: none.
```

Hosting is Vercel from `main` according to `second-brain/Architecture/Hosting and deploy.md`; I could not verify it.

## 3. Critical security findings

None reach Critical. Security vulnerabilities are listed below, most severe first.

**S1 · High · Confirmed in code, not exploited — sessions leave the browser through custom URL schemes**
- **Evidence:** `src/lib/googleIdentity.ts:92` puts the access and refresh tokens in a `lifeos://` or `lifeosnative://` link. `src/routes/auth.tsx:69` triggers this for any visitor to `/auth?handoff=android|native`.
- **Problem:** any installed app can register the same scheme and receive the link.
- **Impact:** full, refreshable account takeover, including health, finance and the Life Connect key.
- **Fix:** PKCE code flow with verified Android App Links, or native Credential Manager sign-in only (it already exists in `feature/auth/GoogleSignIn.kt`).
- **Depends on / risks:** a real release signing key (S3), Supabase redirect allow-list, and an `assetlinks.json` on the web domain. Installed apps must keep working during the switch.

**S2 · High · Confirmed in code, not exploited — apps accept any session handed to them**
- **Evidence:** `mobile/android/src/app/lifeos/MainActivity.java:222` forwards any `lifeos://auth-callback` fragment into `/auth`. The native app does the same at `MainActivity.kt:60`, decodes the token without verifying it (`SupabaseApi.kt:76`), and clears local rows if the user differs (`AccountRepository.kt:48`).
- **Problem:** no check that the app started the sign-in.
- **Impact:** a web link can sign the phone into an attacker's account, so the victim records data there. In the native app it also wipes unsynced changes or forces sign-out.
- **Fix:** same as S1, plus reject callbacks with no pending request and never clear unsent rows silently.
- **Depends on / risks:** fix together with S1. The project's own notes already list this.

**S3 · High (release-blocking) · Confirmed — both Android apps are signed with debug keys**
- **Evidence:** `mobile/native/app/build.gradle.kts:55` uses the debug signing config for release. `mobile/android/build.mjs:183` generates a debug keystore with the standard password.
- **Impact:** no trustworthy update chain, and App Links (the S1 fix) cannot be verified.
- **Fix:** a dedicated release key held outside the repo.
- **Depends on / risks:** changing the key means existing installs must be reinstalled once.

**S4 · Medium · Probable (code-traced, not reproduced) — web offline data is not tied to a user**
- **Evidence:** the cache key has no user id (`src/lib/offline.ts:137`). Queued writes drop their token and replay with whichever token is current (`:530`, `:612`). Clearing happens only on the sign-out button (`src/hooks/useAuth.tsx:62`), not when a session ends otherwise, including the hand-off's local sign-out at `src/routes/auth.tsx:84`.
- **Impact:** on a shared browser the next user can be shown the previous user's cached rows, and queued writes can land in the wrong account.
- **Fix:** namespace the store by user id, stamp outbox entries, clear on any user change.

**S5 · Medium · Confirmed design; brute-force feasibility unverified — weak invite codes**
- **Evidence:** `new_pod_code` and `new_work_code` make 6-character codes with `random()`. `join_pod` and `join_work_org` have no attempt limit or expiry, and work orgs have no member cap. Every member can read `work_orgs.invite_code` (policy `work_orgs_select`).
- **Impact:** any signed-in account can guess its way into a company and see its name, rules and workplace coordinates.
- **Fix:** longer cryptographic codes, expiry, throttling, admin approval for work orgs.

**S6 · Medium · Confirmed — attendance evidence is whatever the client sends**
- **Evidence:** `work_events.at`, location, `verified` and `mock` come from the client (`src/data/work/api.ts:226`). The server only stamps `user_id` and `created_at`.
- **Impact:** a member can post fabricated clock-ins that feed the pay sheet.
- **Fix:** server-side geofence and time checks, optionally device attestation. This is partly a product decision.

**S7 · Medium · Confirmed in live metadata — `project-images` bucket is public and unlimited**
- **Evidence:** `storage.buckets` shows `public = true` with no size or MIME limit. No migration creates it, and the code expects signed URLs (`src/data/projects.ts:39`).
- **Impact:** any object URL is readable without sign-in, and users can upload any file of any size. It holds 0 objects today.
- **Fix:** make it private, add limits, record it in a migration.

**S8 · Medium · Confirmed — Life Connect's secret lives on the server**
- **Evidence:** `user_preferences.connect_key` (migration `20261008150000`) derives both the channel and the AES key. Messages go over public Realtime broadcast with the anon key (`ConnectSender.java:83`), and one-time codes are forwarded by default (`ConnectConfig.java:86`).
- **Impact:** anyone who reads that row, including via S1, can read forwarded SMS and send SMS from the SIM phone.
- **Fix:** pair devices directly so the key never reaches the server, use authorised private channels, default code forwarding to off.

**S9 · Medium · Confirmed — secrets and data stored unencrypted on the phone**
- **Evidence:** tokens in plain DataStore (`SessionStore.kt:67`), all synced rows as JSON in an unencrypted Room database, Life Connect secret in SharedPreferences. `allowBackup` is off in both apps, which helps.
- **Fix:** Keystore-wrapped storage for the session; consider database encryption.

**S10 · Medium · Confirmed in code, deployment unverified — no script CSP**
- **Evidence:** `src/lib/security-headers.ts:14` restricts framing only.
- **Impact:** any XSS yields the session, and inside the WebView app also the SMS bridge.
- **Fix:** nonce-based script policy.

**S11 · Low · Confirmed — ownership of linked rows is not always checked**
- **Evidence:** live policies `evidence_insert_own` and `transactions_update_own` check only `user_id`. The same holds for `goals`, `recurring_costs` and `time_entries`.
- **Impact:** a user who learns another user's row id can attach rows to it. Ids are unguessable, so exposure is small.
- **Fix:** composite foreign keys or ownership checks.

**S12 · Low · Confirmed by advisor — auth hardening gaps**
- Leaked-password protection is off ([remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)).
- No MFA is offered.
- The 8-character rule is client-side only (the password-update page has none).
- The advisor also flags 13 callable SECURITY DEFINER functions ([lint 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)); I reviewed them and each is scoped to `auth.uid()` with a pinned `search_path`.

**S13 · Low · Confirmed — repository hygiene**
- `.env` is tracked despite `.gitignore`. It holds only the anon key (verified `role=anon`); a pattern scan found no other secrets.
- `.claude/settings.local.json` and `.codex/hooks.json` auto-run a committed third-party script on every agent edit, and a Windows binary is committed under `.agents/`.

## 4. High-priority architectural findings

**A1 · Critical · Architectural · Confirmed — the database is not reproducible from the repo**
- **Evidence:** no migration creates `resources`, `resource_readings`, `account_pockets`, `foods`, `food_logs`, the `resource_kind` enum, `rls_auto_enable`, or columns such as `tasks.parent_task_id` and `user_preferences.enabled_modules`. Migration `20260921062632` alters `resources`, so a fresh rebuild fails. The live history lists 12 migrations against 25 files, with different version numbers. Live policies on `tasks`, `transactions` and `evidence` differ from the files.
- **Cause:** migrations are pasted by hand into the SQL editor (`second-brain/Data/Migrations.md`), and `types.ts` is hand-edited.
- **Impact:** no staging or test database, no recovery from the repo, no reviewable schema changes. The clients compensate by stripping unknown columns from writes (`src/lib/offline.ts:645`), which loses fields.
- **Fix:** generate a baseline from the live schema, mark it applied on production, move to CLI migrations with a staging database, generate types.
- **Risks:** the baseline must be repaired into history, never re-run.

**A2 · High · Architectural · Confirmed — two sync engines, no conflict detection**
- **Evidence:** web replays queued HTTP calls; native upserts the whole stored row (`SyncEngine.kt:146`). Neither compares versions.
- **Schema gaps:** 17 tables have no `updated_at`, `activities` and `time_entries` have the column but no trigger, and no table has `deleted_at`.
- **Impact:** a stale phone overwrites newer web edits. Editing a row deleted elsewhere resurrects it.

**A3 · High · Architectural · Confirmed — writes can be lost by design**
- **Web, rejected writes:** a server-rejected queued write is dropped after one transient message (`src/lib/offline.ts:636`).
- **Web, conflicting inserts:** replayed inserts are forced to ignore duplicates, so a conflicting offline insert vanishes (`:619`).
- **Web, stuck queue:** a 401 or 5xx blocks the whole queue with no limit (`:635`), and all reads then come from cache.
- **Native:** one refused row blocks its whole table every sync (`SyncEngine.kt:112`).

**A4 · High · Architectural · Confirmed in code; cost at scale probable — native pull downloads everything**
- **Evidence:** every sync reads all rows of 17 tables by offset (`SyncEngine.kt:160`). Sync runs on every resume and every save (`LocalStore.kt:40`).
- **Impact:** cost grows with history. Offset paging can skip rows, which are then deleted locally until the next sync (`LifeOsDatabase.kt:71`).

**A5 · High · Architectural · Confirmed — five clients, duplicated logic, no shared contract**
- Web, two Android apps, a Wear app and an iOS shell.
- Business rules are written separately in TypeScript (`src/data`) and Kotlin (`data/logic`).
- The native app handles rows as untyped JSON.

**A6 · Medium · Architectural · Confirmed — no delivery gate**
- No web or Android CI, no branch protection, no pull requests in the repo's history.
- Lint currently fails.

## 5. Database and synchronization review

| Area | Verified state |
|---|---|
| RLS coverage | 51 of 51 tables enabled, each with policies; own-rows or membership checks |
| Functions | 22, all with pinned `search_path`; anon cannot execute any SECURITY DEFINER function |
| Grants | Default Supabase grants to anon and authenticated on every table; RLS is the only barrier |
| Sync columns | `updated_at` on 34 tables, `deleted_at` on none, no version or device columns |
| Indexes | 32 foreign keys unindexed, 12 unused indexes |
| Policy cost | 136 policies re-evaluate `auth.uid()` per row; one duplicate policy pair on `work_places` |
| Migration readiness | Not ready (A1) |
| RLS tests | One manual script, work tables only |

Conflict handling as implemented:

| Case | Web | Native |
|---|---|---|
| Same row edited on two devices | Last replay wins per changed columns | Last push wins, whole row |
| Edit against a deleted row | Edit silently matches nothing | Row is re-created |
| Server rejects a write | Dropped with a message | Table blocked until fixed |
| Delete propagation | Hard delete | Hard delete, inferred from full pull |

## 6. Web and Android consistency

| Capability | Web | WebView app | Native app |
|---|---|---|---|
| Today, tasks, money, body, prayers, notes, habits, calendar | Yes | Yes | Yes (simplified) |
| Work, Study, Together, Insights, Daily review, Messages | Yes | Yes | No (opens website, per the hand-off note) |
| Food, Resources, Time tracking, Settings, Week, finance sub-pages | Yes | Yes | No |
| Locked notes | Shown as locked only | Shown as locked only | Yes |
| Widgets, reminders, Health Connect, fingerprint clock-in | No | Yes | No |
| Tables available offline | Whatever was viewed | Whatever was viewed | 17 fixed tables |

The native column for the last two feature rows is inferred from its 17 synced tables and screen list, not from running the app. The iOS shell loads the live site with a small notification and file bridge.

## 7. Technical debt and performance

- **Tests:** unit tests cover pure logic well. Signed-in screens have no E2E coverage, and sync conflict behaviour is barely tested (8 web tests, one Kotlin file).
- **Size:** about 60,700 lines of TypeScript; six route files exceed 1,000 lines.
- **Lint:** 38 non-formatting issues, mostly component-export warnings.
- **Docs:** `README.md` and `AGENTS.md` describe Lovable hosting, while the project notes say Vercel.
- **Tooling clutter:** about 350 design-tool files are committed twice (`.agents/`, `.claude/skills/`).
- **Performance:** fine at the current size (8 accounts). A4 and the per-row policy evaluation are the items that will not scale.

## 8. Proposed target architecture

**Schema and environments**
- Baseline migration from the live database, CLI-managed migrations, a staging database.
- Generated types for TypeScript and Kotlin.

**One sync contract for every client**
- Every synced table gets a server-set `updated_at`, a `deleted_at` tombstone and client-generated ids.
- Pull is incremental from a cursor.
- Push carries the base version, so the server can report a conflict instead of overwriting.
- Local stores are scoped to the user id.
- Failed writes go to a visible quarantine, not the bin.

**Auth**
- PKCE, verified App Links, native Google sign-in, encrypted session storage.

**Multi-user modules (Work, Together)**
- Joins, invites and attendance validation move into server functions.

**Delivery**
- CI running lint, types, unit tests, RLS tests and Gradle tests.
- Protected `main` and a real signing key.

**Migration considerations**
- All column additions are nullable with defaults, then backfilled.
- Tombstones change delete behaviour, so installed apps that still hard-delete must keep working during a transition window.

## 9. Prioritized implementation roadmap

1. **Phase 1 — foundation and exposure**
   - Baseline schema, staging database and CI gate (A1, A6).
   - Auth hand-off and signing (S1, S2, S3).
   - User-scoped offline store (S4), private bucket (S7), invite hardening (S5), leaked-password protection (S12).
2. **Phase 2 — sync contract**
   - Server columns and triggers, incremental pull, conflict reporting.
   - Both clients moved to it, with tests (A2, A3, A4).
3. **Phase 3 — consolidation**
   - One Android app, shared rules, server-side Work validation (A5, S6, S8).
4. **Phase 4 — hardening**
   - CSP, encrypted storage, policy and index tuning, signed-in E2E tests (S9, S10, S11).

Phase 2 depends on Phase 1's staging database. The App Links fix depends on the signing key.

## 10. Outstanding questions and decisions requiring your input

1. Can you provide the Master Build Specification? The gap analysis cannot be done without it. The repo's own plans (`docs/superpowers/specs/`, `second-brain/Vision/`) are the nearest substitute.
2. Which Android app is the target: native Kotlin replacing the WebView app, or both kept?
3. Is Life OS personal, or a multi-user product? This sets the severity of S5 and S6 and the scope of Work and Together.
4. Sync: build the contract in-house or adopt an existing engine, and what should win in a conflict?
5. Should Life Connect keep forwarding SMS one-time codes?
6. Is iOS in scope?
7. Will you authorise Vercel access for the team scope, and a staging Supabase database for RLS and sync tests?
8. Is the Lovable connection still live, or can its files and README text be retired?

**Recommendation:** continue on this foundation, but only after the Phase 1 corrections and the Phase 2 sync contract. Building more features on the current sync and auth hand-off would compound the two largest risks.

Phase 0 is complete. I have made no code changes and will wait for your explicit approval before starting Phase 1. I can also turn this report into a shareable page if you want one.
