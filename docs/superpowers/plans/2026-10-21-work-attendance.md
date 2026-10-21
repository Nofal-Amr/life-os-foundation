# Work attendance and monthly pay sheet — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A work space in Life OS where a company's people clock in and out with fingerprint + location at places the admin marks, and get a monthly attendance and pay sheet computed from HR-made rules (the ADO sheet is one preset).

**Architecture:** A pure TypeScript rules engine (`src/data/work/rules.ts`) turns clock events, leaves and corrections into a month sheet; it is the only place pay is computed. Supabase tables scoped by company with row-level security hold the data; joining copies Together's invite-code pattern. The Android app adds one bridge call that does the fingerprint prompt and a single location reading; the web app does everything else.

**Tech Stack:** TanStack Start + React 19 + TanStack Query, Supabase (Postgres + RLS), Vitest, the no-Gradle Android build (`mobile/android/build.mjs`, platform `android.hardware.biometrics.BiometricPrompt`), existing `src/lib/xlsx.ts`.

**Spec:** `docs/superpowers/specs/2026-10-21-work-attendance-design.md`

## Global Constraints

- Rules are a builder: no calculation may hard-code the example's numbers; the ADO sheet is the preset `ADO_PRESET` only.
- Location is read only at a clock-in/out or attempt. No background location.
- No fingerprint data is stored or sent; the app records only `verified: "biometric" | "credential"`.
- Clock events are never edited or deleted; changes are `work_corrections` rows, shown on the sheet.
- Salaries readable only by the owner, admins, and the member themself (enforced by RLS, not the UI).
- Work data earns no XP and doesn't appear on Today or insights.
- Clock-in only from the Android app; the website shows records and sheets.
- Applying the migration to the live database needs Amr's explicit OK first (project `albrfuugjiimogrtepql`).
- UI copy in English with Arabic in `src/lib/i18n.ar.ts`; plain, calm wording; no scores.
- Defaults: radius 50 m (20–500), accuracy refused when worse than 100 m, currency EGP, time zone Africa/Cairo, money rounded to the nearest pound per line.

## Review Focus

1. **Clock-out after midnight** belongs to the clock-in's day — test `belongs to the day it started` (Task 1).
2. **Several in/out pairs in a day** — first in and last out count — test `uses first in and last out` (Task 1).
3. **Corrections override events but keep the original** — test `a correction replaces the time and is marked` (Task 1).
4. **Offline events arrive late and out of order** — the sheet sorts by `at`, not insert order — test `orders events by time, not arrival` (Task 1).
5. **A member reading another member's salary or events** — RLS check in the migration's rolled-back test block (Task 2).

---

### Task 1: Rules engine and the ADO preset

**Files:**
- Create: `src/data/work/rules.ts`
- Test: `src/data/work/rules.test.ts`

**Interfaces:**
- Produces:
  - `type Clock = "HH:mm"` strings; `type LeaveType = { id: string; name: string; percent: number }`
  - `type LateStep = { after: string; penalty: { kind: "ladder"; minutes: number[]; thenAdd: number } | { kind: "day" } }`
  - `type WorkRules = { timezone: string; currency: string; workDays: number[] /* 0=Sun */; dayStart: string; dayEnd: string; graceMinutes: number; lateSteps: LateStep[]; overtime: { beforeStart: boolean; afterEnd: boolean; dayOffAllOvertime: boolean; minimumMinutes: number }; rate: { kind: "fixed"; perHour: number } | { kind: "fromSalary" }; earlyLeaveCounted: boolean; leaveTypes: LeaveType[]; dayPenaltyDivisor: number; absenceFromTotal: boolean; outsideRadius: "refuse" | "refuseAndRecord" | "allowWithReason" }`
  - `const ADO_PRESET: WorkRules`
  - `type ClockEvent = { kind: "in" | "out"; at: string /* ISO */; placeKind?: "office" | "site" }`
  - `type Correction = { day: string; field: "in" | "out"; at: string | null; reason: string }`
  - `type Leave = { day: string; typeId: string }`
  - `type DayRow = { day: string; weekday: number; kind: "work" | "off" | "leave" | "holiday"; in: string | null; out: string | null; late: number; penalty: number; dayPenalty: boolean; earlyLeave: number; overtime: number; site: boolean; corrected: ("in" | "out")[]; note: "no-clock-out" | "absent-unexplained" | null; leaveTypeId: string | null }`
  - `type MonthSheet = { rows: DayRow[]; totals: { late: number; penalty: number; earlyLeave: number; overtime: number; dayPenalties: number; siteDays: number; leaves: Record<string, number> }; money: { base: number; ratePerHour: number; deductions: number; overtimePay: number; leaveDeductions: number; dayPenaltyDeductions: number; total: number } }`
  - `function monthSheet(input: { rules: WorkRules; month: string /* yyyy-MM */; baseSalary: number; overtimeRate?: number | null; events: ClockEvent[]; corrections: Correction[]; leaves: Leave[]; holidays: string[] }): MonthSheet`

`ADO_PRESET` values (from the example sheet): timezone `Africa/Cairo`, currency `EGP`, workDays `[0,1,2,3,4]`, dayStart `08:00`, dayEnd `16:30`, graceMinutes `0`, lateSteps `[{ after: "09:00", penalty: { kind: "ladder", minutes: [120, 150, 180], thenAdd: 30 } }, { after: "10:00", penalty: { kind: "day" } }]`, overtime `{ beforeStart: true, afterEnd: true, dayOffAllOvertime: true, minimumMinutes: 0 }`, rate `{ kind: "fixed", perHour: 47 }`, earlyLeaveCounted `true`, leaveTypes `[{ id: "with", name: "Leave with permission", percent: 5 }, { id: "without", name: "Leave without permission", percent: 7 }, { id: "annual", name: "Annual leave", percent: 0 }]`, dayPenaltyDivisor `30`, absenceFromTotal `true`, outsideRadius `"refuseAndRecord"`.

Day rules the engine applies (the spec's, generalised):
- Times are read in `rules.timezone`. An event belongs to the local date of the day's first clock-in; a clock-out up to 12 h after a clock-in on the previous date belongs to that date.
- Late = minutes after `dayStart + graceMinutes`, unless the arrival is after a `lateStep.after` — then the latest matching step applies instead: `ladder` gives `minutes[n-1]` for the month's nth ladder occurrence (`minutes.at(-1) + thenAdd × (n − minutes.length)` beyond the list), `day` sets `dayPenalty` (no late, no ladder count).
- Overtime = minutes before `dayStart` (if `beforeStart`) + after `dayEnd` (if `afterEnd`); on a day off with a clock-in, all worked minutes (if `dayOffAllOvertime`); amounts below `minimumMinutes` count 0.
- Early leave = minutes before `dayEnd` on a work day (if `earlyLeaveCounted`).
- Money: rate = member `overtimeRate` ?? rules fixed `perHour` ?? `base ÷ (work days in month × day length in hours)`; deductions = round((late + penalty + earlyLeave) ÷ 60 × rate); overtimePay = round(overtime ÷ 60 × rate); leaveDeductions = Σ round(base × percent ÷ 100) per leave day; dayPenaltyDeductions = round(base ÷ dayPenaltyDivisor) × days; total = base − deductions + overtimePay − dayPenaltyDeductions − (absenceFromTotal ? leaveDeductions : 0).
- A work day with no clock-in, no leave and not a holiday → `note: "absent-unexplained"`, not deducted. A clock-in with no clock-out → `note: "no-clock-out"`, no overtime, no early leave.

- [ ] **Step 1: Write the failing tests** — fixture `ADO_SEPTEMBER` in the test file: Amr's September 2026 sheet as events (local Cairo times, 1–30 Sep), base 9,500, leaves `2026-09-02: with`, `2026-09-20: annual`, `2026-09-21: annual`, and the Saturday 19 Sep times 08:41–14:47 (the sheet printed them on the 20 Sep row).
  - `reproduces the ADO September sheet`: `totals.late === 276`, `totals.penalty === 450`, `totals.overtime === 1627`, `money.deductions === 569`, `money.overtimePay === 1274`, `money.leaveDeductions === 475`, `money.total === 9730`.
  - `ladder counts occurrences in the month`: the rows for 6, 8, 17 Sep have penalty 120, 150, 180 and late 0.
  - `after 10:00 costs a day`: a 10:05 arrival → `dayPenalty: true`, `dayPenaltyDeductions === round(9500 / 30)`, ladder count unchanged.
  - `belongs to the day it started`: in 2026-09-14 20:00, out 2026-09-15 01:30 → one row for the 14th, overtime counts to 01:30.
  - `uses first in and last out`: in 08:00, out 12:00, in 13:00, out 17:00 → in 08:00, out 17:00.
  - `a correction replaces the time and is marked`: an `out` correction at 16:30 on a no-clock-out day → `out` 16:30, `corrected: ["out"]`, note null.
  - `orders events by time, not arrival`: the same events shuffled give the same sheet.
  - `uses the salary rate when there is no fixed rate`: `rate: { kind: "fromSalary" }`, 22 work days × 8.5 h → `ratePerHour === 9500 / (22 * 8.5)`.
  - `marks unexplained absence without deducting`: an empty work day → note `absent-unexplained`, total unchanged.
- [ ] **Step 2:** Run `npx vitest run src/data/work/rules.test.ts` — Expected: FAIL (module missing).
- [ ] **Step 3:** Implement `src/data/work/rules.ts` with the exports above (date-fns + `Intl.DateTimeFormat` with `timeZone` for local times; no new dependency).
- [ ] **Step 4:** Run `npx vitest run src/data/work/rules.test.ts` — Expected: 9 passed.
- [ ] **Step 5:** Commit `feat(work): rules engine with the ADO preset`.

### Task 2: Database (migration, policies, types)

**Files:**
- Create: `supabase/migrations/20261021120000_work.sql`
- Modify: `src/integrations/supabase/types.ts` (regenerated)

**Interfaces:**
- Produces tables (all `id uuid pk default gen_random_uuid()` unless noted, `created_at timestamptz default now()`):
  - `work_orgs(name text 1–60, invite_code text unique ^[A-HJ-NP-Z2-9]{6}$, rules jsonb not null, created_by uuid)`
  - `work_members(org_id, user_id, display_name 1–40, role text in ('owner','admin','member') default 'member', base_salary numeric default 0, overtime_rate numeric null, place_ids uuid[] null, joined_at; pk (org_id, user_id))`
  - `work_places(org_id, name 1–60, kind text in ('office','site'), latitude double precision, longitude double precision, radius_m int check 20–500 default 50)`
  - `work_events(org_id, user_id default auth.uid(), kind text in ('in','out','attempt'), at timestamptz, place_id uuid null, latitude, longitude, accuracy_m real, distance_m real, verified text in ('biometric','credential'), mock boolean default false, sent_late boolean default false, reason text null ≤ 300)`
  - `work_corrections(org_id, user_id /* whose day */, day date, field text in ('in','out','leave'), value text null /* ISO time or leave type id */, reason text 1–300, made_by uuid default auth.uid())`
  - `work_leaves(org_id, user_id, day date, type_id text, status text in ('requested','approved') default 'requested', note text null; unique (org_id, user_id, day))`
  - Functions (SECURITY DEFINER, `search_path = ''`, only about `auth.uid()`): `is_work_member(org uuid) → boolean`, `is_work_admin(org uuid) → boolean` (owner or admin), `create_work_org(org_name text, my_name text, rules jsonb) → uuid` (creator becomes owner), `join_work_org(code text, my_name text) → uuid`, `renew_work_code(org uuid) → text` (admins).
- Policies:
  - orgs: select member; update admin; delete owner.
  - members: select own row or admin; update/delete admin (owner row can't be demoted by an admin); insert only through the functions.
  - places, leaves (approve), corrections: select member (corrections and leaves: own or admin); write admin; members insert their own leave requests (`status = 'requested'`).
  - events: insert own rows only (`user_id = auth.uid()` and member); select own or admin; **no update or delete policy**.

- [ ] **Step 1:** Write the migration, following `20261008170000_together.sql` (code generator, revokes, grants).
- [ ] **Step 2:** Write the rolled-back check block at the end of the file (commented, for running once): as user A create an org; as user B join it; assert B can't select A's `work_members` row salary nor A's events, can't update an event, can't insert an event with A's `user_id`; A (owner) can select both.
- [ ] **Step 3:** **Stop and ask Amr for OK to apply.** Then apply with the Supabase connector (`apply_migration`), run the check block via `execute_sql` inside `BEGIN … ROLLBACK`, and confirm every assertion passed.
- [ ] **Step 4:** Regenerate types (`generate_typescript_types`) into `src/integrations/supabase/types.ts`; `npx tsc --noEmit -p .` passes.
- [ ] **Step 5:** Commit `feat(work): companies, places, clock events, corrections, leaves`.

### Task 3: Place checks

**Files:**
- Create: `src/data/work/place.ts`
- Test: `src/data/work/place.test.ts`

**Interfaces:**
- Produces: `type Reading = { latitude: number; longitude: number; accuracy: number }`, `type PlaceLike = { id: string; name: string; latitude: number; longitude: number; radius_m: number; kind: "office" | "site" }`, `function distanceMeters(a, b): number` (haversine, R = 6 371 000), `function checkPlace(reading: Reading, places: PlaceLike[]): { status: "inside"; place: PlaceLike; distance: number } | { status: "outside"; nearest: PlaceLike | null; distance: number | null } | { status: "unclear" }`; `function parsePlaceInput(text: string): { latitude: number; longitude: number } | null` (accepts "30.0444, 31.2357" and Google Maps links with `@lat,lng` or `q=lat,lng`).

- [ ] **Step 1: Tests** — `distanceMeters` Cairo Tower ↔ Tahrir ≈ 1 200 m (±50); `inside when distance minus accuracy is within the radius` (distance 70, accuracy 30, radius 50 → inside); `outside names the nearest place and distance`; `unclear above 100 m accuracy`; `parses coordinates and maps links`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → 5 passed. **Step 5:** Commit `feat(work): place checks`.

### Task 4: Work data module

**Files:**
- Create: `src/data/work/api.ts`
- Test: `src/data/work/api.test.ts` (pure helpers only)

**Interfaces:**
- Consumes: Task 1 types, Task 2 tables/functions, `unwrap`/`currentUserId` from `@/lib/supabase-helpers`.
- Produces:
  - `workKeys = { orgs: ["work_orgs"], members: ["work_members"], places: ["work_places"], events: (month) => ["work_events", month], corrections: …, leaves: … }`
  - queries: `workOrgsQuery()`, `workMembersQuery(orgId)`, `workPlacesQuery(orgId)`, `workEventsQuery(orgId, month)`, `workCorrectionsQuery(orgId, month)`, `workLeavesQuery(orgId, month)`
  - mutations: `createWorkOrg(name, myName)` (passes `ADO_PRESET` as rules), `joinWorkOrg(code, myName)`, `renewWorkCode(orgId)`, `saveRules(orgId, rules)`, `savePlace(orgId, place)`, `deletePlace(id)`, `saveMember(orgId, userId, patch)`, `recordEvent(input)`, `addCorrection(input)`, `requestLeave(input)`, `approveLeave(id)`
  - `function readRules(json: unknown): WorkRules` — fills any missing field from `ADO_PRESET` so older saved rules keep working.
  - `function sheetInputFor(member, rules, month, events, corrections, leaves, holidays)` — maps rows to `monthSheet` input (events of kind `attempt` excluded; leave corrections become leaves).
- [ ] **Step 1: Tests** — `readRules fills missing fields from the preset`; `attempts never reach the sheet`; `a leave correction becomes a leave`. **Step 2–4** run fail/implement/pass. **Step 5:** Commit `feat(work): data module`.

### Task 5: Android: fingerprint and one location reading

**Files:**
- Create: `mobile/android/src/app/lifeos/WorkClock.java`
- Modify: `mobile/android/AndroidManifest.xml` (add `android.permission.USE_BIOMETRIC`), `mobile/android/src/app/lifeos/MainActivity.java` (bridge `workCheck(String json)`), `src/lib/native.ts` (`nativeRequest` method union gains `"workCheck"`; `export function workCheck(title: string): Promise<WorkCheck>`)

**Interfaces:**
- Produces: `type WorkCheck = { ok: true; verified: "biometric" | "credential"; latitude: number; longitude: number; accuracy: number; mock: boolean; at: number } | { ok: false; reason: "cancelled" | "no-lock" | "no-permission" | "no-location" }`
- Behaviour: `BiometricPrompt` with title = `title`, authenticators `BIOMETRIC_STRONG | DEVICE_CREDENTIAL` on API 30+; on API 28–29 a negative button "Use PIN" opening `KeyguardManager.createConfirmDeviceCredentialIntent`; then request `ACCESS_FINE_LOCATION` if missing and take one reading with `LocationManager.getCurrentLocation` (fused → gps → network, 20 s timeout; API < 30: `requestSingleUpdate`); `mock` from `Location.isMock()` (API 31+) else `isFromMockProvider()`. Nothing stored natively.
- [ ] **Step 1:** Implement `WorkClock` and the bridge; reply through `__lifeOSNativeCallback` like `listen`.
- [ ] **Step 2:** `npm run build:android` — Expected: `APK ready`. (No phone here: the device check is Amr's.)
- [ ] **Step 3:** Commit `feat(work): fingerprint and location check on Android`.

### Task 6: Work page for members, and joining

**Files:**
- Create: `src/routes/_authenticated/work.tsx`, `src/components/app/work/ClockCard.tsx`, `src/components/app/work/WorkSettingsCard.tsx`
- Modify: `src/routes/_authenticated/settings.tsx` (add `WorkSettingsCard`), `src/components/app/Navigation.tsx` (`/work` in TOOLS, shown only when `workOrgsQuery()` has a company)

**Interfaces:**
- Consumes: Tasks 3–5.
- Behaviour:
  - Settings → Work: "Make a test company" (name + your name) or "Join with a code".
  - Work page: company name; **Clock in / Clock out** (Android) or "Clock in from the Life OS app on your phone" (web); today's record; this month's sheet (Task 8 component) for yourself.
  - Clock flow: `workCheck("Clock in at <company>")` → `checkPlace` → inside: `recordEvent({ kind, place_id, … })`; outside: per `rules.outsideRadius` — `refuse`: message only; `refuseAndRecord`: ask for a reason, record `kind: "attempt"`; `allowWithReason`: ask for a reason, record the clock event with `reason`; unclear: "Location isn't clear here, step outside or near a window". Mock → recorded with `mock: true` and a note to the user that the admin will see it.
  - Offline: the existing offline layer queues the insert; set `sent_late` when `navigator.onLine` was false at the tap.
- [ ] **Step 1:** Build the screens; `npx tsc --noEmit -p .` passes.
- [ ] **Step 2:** In the browser preview (signed in as a test account Amr provides, or skip if none), the web shows the "use the phone" message; build passes (`npm run build`).
- [ ] **Step 3:** Commit `feat(work): work page, clocking in, joining`.

### Task 7: Admin: people, places, rules, attempts, corrections, leave

**Files:**
- Create: `src/components/app/work/PeopleAdmin.tsx`, `PlacesAdmin.tsx`, `RulesEditor.tsx`, `AttemptsList.tsx`, `CorrectionDialog.tsx`, `LeaveAdmin.tsx`
- Modify: `src/routes/_authenticated/work.tsx` (admin tabs: People, Places, Rules, Sheets)

**Interfaces:**
- Consumes: Task 4 mutations, Task 1 `WorkRules`/`ADO_PRESET`.
- Behaviour:
  - People: invite code with renew; each member's name, role (owner can make admins), base salary, own overtime rate, allowed places.
  - Places: add by "use where I am now" (`requestDeviceLocation`) or pasting coordinates / a maps link (`parsePlaceInput`); name, office/site, radius slider 20–500 (default 50); an "Open in Maps" link to check the pin. (No embedded map in this version.)
  - Rules editor: every `WorkRules` field as a form; late steps as a list (time → ladder minutes or "a day"); leave types (name, %); outside-radius choice; "Start from the ADO example" fills `ADO_PRESET`.
  - Attempts: date, person, distance, reason; "Count it" adds an `in`/`out` correction with the reason.
  - Corrections: from a sheet row, change in/out or mark leave, reason required.
  - Leave: approve requests.
- [ ] **Step 1:** Build; `npx tsc --noEmit -p .` passes. **Step 2:** Commit `feat(work): admin screens`.

### Task 8: The monthly sheet and Excel export

**Files:**
- Create: `src/components/app/work/MonthSheetView.tsx`, `src/data/work/sheetExport.ts`
- Test: `src/data/work/sheetExport.test.ts`

**Interfaces:**
- Consumes: `MonthSheet` (Task 1).
- Produces: `function sheetRows(sheet: MonthSheet, labels: (text: string) => string, fmt: { time: (iso: string) => string; date: (day: string) => string }): Cell[][]` (title row with company and person, header, one row per day, the totals and money lines in the example's order) and `exportSheets(sheets: { person: string; sheet: MonthSheet }[], company: string, month: string): Uint8Array` via `buildXlsx` (one worksheet per person).
- View: the example's layout — columns date, day, in, out, late, penalty, early leave, overtime; coloured rows for off days, leave, work on a day off, notes; corrected cells with a small mark and the corrections list below; totals and money; RTL in Arabic.
- [ ] **Step 1: Tests** — `sheet rows follow the example's order` (header labels, 30 day rows, totals line values 276/450/1627, money lines 569/1274/475/9730); `one worksheet per person`.
- [ ] **Step 2–4:** fail → implement → pass. **Step 5:** Commit `feat(work): month sheet view and Excel export`.

### Task 9: Arabic, notes, ship

**Files:**
- Modify: `src/lib/i18n.ar.ts`; Create: `second-brain/Features/Work.md`

- [ ] **Step 1:** Arabic for every new string (`t()` / primitives), no duplicate keys (`npx tsc --noEmit -p .`).
- [ ] **Step 2:** Feature note in the vault (what it does, the rules builder, privacy rules).
- [ ] **Step 3:** `npx vitest run` all pass; `npm run build`; `npm run build:android` and `build:android:full`.
- [ ] **Step 4:** Commit, push to `at-a-glance` and `main`, upload APKs to release `android-2026-10-08`, check the Vercel deploy.
