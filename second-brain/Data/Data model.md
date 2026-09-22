---
tags:
  - data
updated: 2026-09-22
---
# Data model

All tables are per user (`user_id`, RLS). Grouped by area:

| Area | Tables |
|---|---|
| Do | `tasks` (project_id, goal_id, parent_task_id, capability_id) · `projects` · `goals` · `habits` (category) · `habit_logs` · `capabilities` · `evidence` |
| Time | `activities` · `time_entries` (one running per user) |
| Money | `accounts` (counts_toward_spendable) · `account_pockets` · `transactions` (occurred_time) · `finance_categories` · `recurring_costs` · `payday_config` |
| Home | `resources` (meter/quota, tariff) · `resource_readings` |
| Body | `health_logs` · `health_samples` · `body_stats` · `medications` · `medication_logs` · `foods` · `food_logs` |
| Spirit | `prayer_logs` (status) · `prayer_settings` |
| Other | `notes` · `events` · `daily_reviews` · `profiles` · `user_preferences` (skin, week_start) · `ux_events` |

## Links (derived, no extra columns)
- Project progress = its top-level tasks done / total.
- A project "moves" a goal when one of its tasks has that `goal_id`.
- Code: `src/data/links.ts` (tested).

Types: `src/integrations/supabase/types.ts` (hand-edited when migrations add columns). See [[Migrations]].
