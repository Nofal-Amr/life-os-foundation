Owner said "accept everything and merge" (2026-11-13) after sessions stalled overnight waiting on approval prompts.

**The rule now:** don't stop to ask about routine steps (editing, installing, checks, commits, pushes, PRs).

- Loop: produce, check, fix, at most 3 attempts.
- Green means tsc, vitest, eslint on touched files, the production build, a headless demo of touched pages, and the Android builds/tests when touched.
- When green: push, open the PR with check results and screenshots, merge it, and verify the live deploy.

**Still ask first:** DB writes or migrations, deleting data, spending money, secrets, and anything irreversible.

**Why:** the per-push approval made 3 sessions sit idle for 20 hours.

**How to apply:**

- Permissions in `~/.claude/settings.json` allow git push and gh pr create/merge, and deny force-push.
- `gh auth setup-git` is done, so git pushes as Nofal-Amr.
- This replaces the earlier "ask before every push" rule. See [core-rules](core-rules.md).
