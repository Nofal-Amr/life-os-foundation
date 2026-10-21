---
tags:
  - feature
  - work
updated: 2026-10-21
---

# Work (attendance and the monthly pay sheet)

The first piece of the work side ([[Enterprise and business]]). Design: `docs/superpowers/specs/2026-10-21-work-attendance-design.md`.

## What it does
- **Companies**: Settings → Work → *Make a test company* (you're the owner) or *Join with a code*. Roles: owner, admin, member.
- **Places**: the admin adds the office and sites (here / coordinates / a Maps link) with a radius, 20–500 m (default 50).
- **Clock in / out** (Android app only): fingerprint or screen lock, then one location reading. Inside when distance − accuracy ≤ radius; readings worse than 100 m are refused. Outside: the company's setting — refuse, refuse but keep the attempt with a reason (default), or allow with a reason.
- **Rules**: a rule builder (work days and hours, grace, late steps with ladders by occurrence or a day's penalty, overtime, hourly rate, leave kinds and their %, whether leave comes off the total). The ADO sheet is one preset.
- **Sheets**: a month per person like the ADO sheet, in Arabic or English, Excel export (one person, or everyone). Admins correct a day (time or leave) with a reason; corrections are marked on the sheet.

## Privacy rules
- Location only at clock-in/out; no tracking. No fingerprint data reaches the app.
- Members see only their own row (salary), events, corrections and leave; owners and admins see everyone's (row-level security, tested on the live database).
- Clock events can't be edited or deleted; "sent later" is worked out by the server.
- Work earns no XP and stays off Today.

## Code
- Engine: `src/data/work/rules.ts` (tests reproduce the ADO September 2026 sheet: late 276, penalties 450, overtime 1627 min; total 9,730 with the leave deduction).
- Data: `src/data/work/api.ts`, places: `place.ts`, export: `sheetExport.ts`, time zones: `time.ts`.
- Screens: `src/routes/_authenticated/work.tsx`, `src/components/app/work/*`.
- Android: `WorkClock.java` (bridge `workCheck`).
- Database: `supabase/migrations/20261021120000_work.sql`; access check `supabase/tests/work_rls_check.sql`.

## Not yet
Company public holidays, invoices and expenses, shared schedules, paid tiers.
