---
tags:
  - data
  - runbook
updated: 2026-09-22
---
# Migrations

Files in `supabase/migrations`, run by hand in the Supabase SQL editor ([[Workflows/Run a migration]]).

| File | Adds |
|---|---|
| `20260921130000_account_counts_toward_spendable.sql` | accounts kept out of left to spend |
| `20260921140000_week_prayers_notes_health_skins.sql` | week start, skin, prayer status, note fields, transaction time, tariffs, health samples, ux events |
| `20260921170000_time_tracking.sql` | activities, time entries |
| `20260921220000_habit_categories.sql` | habit category |

Earlier Lovable-generated files set up the base schema. Some tables (`account_pockets`, `foods`, `food_logs`, `resources`, `resource_readings`) exist in the database without a creating migration in the repo.
