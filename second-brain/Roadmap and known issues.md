---
tags:
  - roadmap
updated: 2026-09-22
---
# Roadmap and known issues

## To do
- [ ] Run `20260921220000_habit_categories.sql` in Supabase.
- [ ] Switch Supabase auth to the **PKCE** flow (blocks login injection via `lifeos://auth-callback`).
- [ ] Add a script **CSP** with nonces.
- [ ] Commit schema for `account_pockets`, `foods`, `food_logs`, `resources`, `resource_readings` as a migration.
- [ ] E2E tests for signed-in screens with a dedicated test account.
- [ ] Goals: link habits directly (needs a column).
- [ ] Remove design-tool files accidentally committed in `cf2ddd8` (`.agents/`, `.claude/skills`, ...).

## Fixed 2026-09-22
- Offline asked to sign in (the page gate needed the server).
- Prepaid balance missing from Resources at a glance; daily rate wrong after same-day readings or top-ups.
- Note editor jumped while typing.

New ideas: [[Ideas backlog]].

## Known issues
- Hydration warning (React #418) at startup; recoverable.
- Samsung watch steps may be missing from Health Connect.
- README still describes Lovable.
