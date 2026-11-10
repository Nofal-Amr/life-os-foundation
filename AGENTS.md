# Rules for any agent working here

Scope and rules for the current phase are in `docs/phase1/EXECUTION_PROMPT.md`. The current state
is in `docs/phase1/PROGRESS.md`. Read both before doing anything.

- Production database is read-only. No migration, deploy or merge to `main` without the owner's
  approval.
- Never run SQL against production or apply a migration without the owner's written approval of
  that exact statement.
- Do not use connector or MCP tools (Supabase, Vercel, GitHub merge) unless the owner's task names
  them.
- Stop at each sub-phase checkpoint and wait.
- No secrets, keystores or user data in code, logs, tests or commits.
- Every change ships with a test that fails without it. Stay inside the approved scope.
- One branch and pull request per concern. Never rewrite pushed history: no force-push, and no
  rebasing, amending or squashing commits that are already pushed.
