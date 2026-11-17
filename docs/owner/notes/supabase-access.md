The Life OS database is Supabase project `albrfuugjiimogrtepql` ("life-os-foundation", eu-central-1). Since 2026-09-25 the Supabase connector (`mcp__7830882e…__execute_sql`, `apply_migration`, `generate_typescript_types`, `get_advisors`) reaches it. The Lovable MCP still can't (`database_not_managed`). The other project in the same org, `jvgxldhshbyyuftjgfrw`, is dar-alekram, not Life OS.

Schema facts worth knowing:

- `resource_kind` is `meter` | `quota` | `vehicle` (vehicle added 2026-09-25 with `fuel_fillups`).
- `body_stats` is one upserted row per user, with no weight history.
- Tables use a `set_updated_at` trigger and one RLS policy per operation (`<table>_select_own`, …).
- `prayer_logs.status` allows jamaah, on_time, clutch, late, missed.

**Why:** the old note said the DB was unreachable; that stopped being true and cost a detour.

**How to apply:** read-only queries are fine to check state. Applying migrations to the live DB needs the user's explicit OK each time; write the file in `supabase/migrations/` first, then apply, verify, and regenerate `src/integrations/supabase/types.ts`. Run the security advisor after DDL.

Related: [core-rules](core-rules.md)
