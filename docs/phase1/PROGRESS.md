# Phase 1 progress

Read this first when resuming. Scope and rules are in `EXECUTION_PROMPT.md` (owner's text,
verbatim). The audit this phase acts on is `../audits/PHASE_0_AUDIT.md`; the specification is
`../MASTER_SPEC.md`; the comparison between the two is `../audits/PHASE_0_GAP_ANALYSIS.md`.

Last updated: 2026-11-10, during 1.1 (three pull requests open, formatting not started).

## Where things stand

| Sub-phase | State |
|---|---|
| 1.0 Preparation | **Approved by the owner.** The owner will merge its pull request after reading the gap analysis. |
| 1.1 Delivery gate (A6, S13) | **In progress.** Lint, CI and documentation pull requests are open. The formatting pull request, the hygiene cleanup and the `.env` change are not started; see "1.1 state". |
| 1.2 Schema source of truth (A1) | Not started. Needs the staging answer. |
| 1.3 Mobile sign-in and signing (S3, S1, S2) | Not started. Needs the production domain. |
| 1.4 Data-exposure fixes (S4, S5, S7, S8 default, S12) | Not started. |

**Next step:** wait for the owner's answers under "Waiting on the owner". Then make the
formatting-only pull request from whatever `main` is at that moment, followed by the hygiene
cleanup and, last, the `.env` change.

## Waiting on the owner

1. **`at-a-glance` branch.** Merge or keep open. Only three of its files overlap with the
   formatter (see "1.1 state"), so either works. The owner decides.
2. **What the formatting pull request covers.** Four choices listed under "1.1 state".
3. **Vercel build-time variables.** The owner confirms they are set for Production and Preview
   before the tracked `.env` is replaced. That change is done last in 1.1.
4. **Review of pull requests 2, 3 and 4**, and merging pull request 1 first.
5. **Staging (decision 7).** Needed for 1.2: the staging project ref (no keys), or a request to be
   guided through creating it.
6. **Production domain (decision 9).** Needed for 1.3.

## 1.1 state

Owner's decisions for 1.1 (2026-11-10):

- Nothing that needs a connector is delegated. The owner is disconnecting the Supabase connector
  until 1.2 and the Lovable connector for good. No connector was used in 1.1 except GitHub, for
  pull requests.
- One branch per pull request, named `phase1/<topic>`. No force-push, no merge, no direct push to
  `main`. The owner is enabling protection on `main` (require pull requests, block force-push).
- Run `tsc`, `vitest` and `eslint` before every commit; never rely on a subagent's report.
- CI must trigger on `pull_request`, pin actions to full commits, use minimal permissions and no
  secrets. The owner sees the workflow files before they merge.
- The `.env` change is last in 1.1 and only after the owner confirms the Vercel variables.

Done so far:

- **Lint** (`phase1/lint`): the 38 non-formatting issues are at 0. Three fixed, two suppressed
  with the reason beside the line (both in sign-in code that 1.3 replaces), and the 33
  fast-refresh export warnings listed as per-file exceptions in `eslint.config.js`. The owner
  had expected those 33 to be fixed by moving exports; that was not done because the executor
  could not be loaded (below). It remains available as a later task; the exception list then
  shrinks.
- **CI** (`phase1/ci`): `.github/workflows/ci.yml` with three jobs: web (types, unit tests, lint
  with `--max-warnings 0`), native Android (unit tests, debug build), WebView Android (Java tests,
  build). Its lint step stays red until the formatting and lint pull requests are merged.
- **Documentation** (`phase1/agent-rules-and-docs`): README and `AGENTS.md` corrected, `CLAUDE.md`
  added (imports `AGENTS.md`), `.claude/agents/phase1-executor.md` added.

Executor findings:

- A subagent definition's `tools` list is an allow-list; connectors are excluded unless listed.
- The definition format cannot deny single shell commands. A `disallowedTools` entry such as
  `Bash(git push *)` removes the whole shell tool. Deny rules in settings do work at command
  level but apply to the main session too. A hook in the definition could block commands for
  that subagent only; none was added, given the owner's position on hooks.
- Definitions are read when a session starts. `phase1-executor` could not be used in the session
  that created it, so nothing was delegated in 1.1 so far. A new session will have it once the
  documentation pull request is merged.

Formatting analysis (not started; `prettier --check .` on `main`):

- 317 files would change: 142 under `.agents/` and `.claude/` (the design tool, due for removal),
  92 under `src/`, 61 under `second-brain/`, 5 under `.lovable/`, 3 under `docs/superpowers/`,
  3 under `mobile/ios/`, and 11 others (build scripts, `public/`, `e2e/`, `roadmap.md`,
  `AGENTS.md`).
- Choices for the owner: (1) remove the design-tool folders first, so 142 files are deleted
  instead of formatted; (2) exclude `mobile/ios/`, since iOS is not to be touched; (3) exclude the
  three documents saved "unchanged" or "verbatim" (`docs/MASTER_SPEC.md`,
  `docs/audits/PHASE_0_AUDIT.md`, `docs/phase1/EXECUTION_PROMPT.md`); (4) format or exclude the
  owner's notes in `second-brain/` and `.lovable/`.
- `at-a-glance` overlaps the formatter in three files only: `src/components/app/LifeConnectCard.tsx`,
  `src/lib/native.ts` and `second-brain/Handoff - next session.md`. Its Kotlin and Java files are
  not formatted by Prettier.
- The formatting pull request must be generated last among the source-changing ones, from the
  `main` of that moment, so it cannot conflict with them.

Read-only items delivered before 1.1 (2026-11-10):

- `at-a-glance` summary: no schema, deployment or dependency changes. It adds 12 tables to the
  native app's sync list (17 to 29), a demo mode with a placeholder session, coarse location in
  the native app, and a Life Connect music remote in the WebView app and website. `tsc` and the
  295 unit tests pass on it; Kotlin tests were not run. It is a fast-forward of `main`.
- Hook scripts: static text scan of the committed Windows binary shows calls to
  `impeccable.style/api`, an update check, telemetry with opt-out switches, and an OpenAI
  image path used when `OPENAI_API_KEY` is set. Which of these `hook` triggers is unknown; the
  binary was not run. Recommendation: remove in the hygiene cleanup, with the four
  `.claude/agents/impeccable-*.md` files.

## Decisions made so far

- Hooks: the owner disabled them locally. They are not to be re-enabled. Removing them from the
  repository belongs to the S13 cleanup in 1.1.
- The specification is the product target. `EXECUTION_PROMPT.md` is the only definition of scope
  and wins any conflict; conflicts are raised with the owner.
- The specification was committed as the owner wrote it, with the owner's status header. Its body
  is not to be edited in 1.0; the owner will revise it after reading the gap analysis.
- Android: the native Kotlin app (`app.lifeos.kt`) is the long-term app. The WebView app
  (`app.lifeos`) gets security fixes only.
- Life OS is a multi-user public product. All stored data is other people's data.
- Sync is out of scope for Phase 1. iOS is out of scope.
- Lovable is no longer used.
- Existing modules: Work, Study, Finance, Resources and Together are kept. Life Connect is frozen
  apart from the one-time-code default. The owner will confirm any change.

## Notes for later phases (not Phase 1)

- Plan `org_id` and the sync columns as one schema pass in Phase 2. Before that, decide whether
  `org_id` belongs on every table, given that Work and Together already have their own membership
  models (`work_members`, `pod_members`).
- The owner's intended order: foundation (Phase 1), sync contract with the schema pass (Phase 2),
  consolidation (Phase 3), hardening (Phase 4), then passkeys, subscriptions and the hosting move,
  then the v1 feature modules.
- Leave the client-side column stripping in `src/lib/offline.ts` alone in Phase 1; it is a Phase 2
  item.

## Hook report (operating rule 9)

`.claude/settings.local.json` and `.codex/hooks.json` both run `impeccable hook` after every Edit
or Write and again when the agent stops. Findings from reading the files on `main` at `f682e84`:

- `.claude/skills/impeccable/scripts/impeccable` (identical copy under `.agents/`) is a launcher,
  not a checker. It looks for a compiled program next to itself, then in `~/.impeccable`, then on
  `PATH`, and runs the first it finds.
- If none is found it downloads one from `github.com/pbakaus/impeccable` releases into
  `~/.impeccable` and runs it. The checksum it verifies is fetched from the same place.
- A 14.7 MB Windows binary is committed in both copies
  (`scripts/bin/windows-x64/impeccable.exe`). It is closed, so what `hook` does could not be
  verified. Its bundled documentation (`reference/hooks.md`) says it scans edited UI files and
  feeds design findings back to the agent, and that it can write `.impeccable/config.json`.
- This goes beyond local formatting or linting. The owner was told and decided as recorded above.
- In the cloud container used for this work the launcher cannot run: it is committed without the
  executable bit, no Linux binary is shipped, and `~/.impeccable` does not exist. No hook output
  appeared when files were written in 1.0.

## New since the audit

- **`at-a-glance` is 8 commits ahead of `main`** (`568df72`, dated 2026-10-23 and 2026-10-24),
  about 11,300 added lines across 68 files. It rebuilds the native app's Today, Do, Money, Body,
  Spirit and Calendar screens "at website parity" and adds a Life Connect music remote to the
  WebView app and website. The audit and the gap analysis cover `main` only, so:
  - both understate the native app as it exists on that branch;
  - the music remote is a new feature in the WebView app, which is now limited to security fixes,
    and it extends Life Connect, which is now frozen;
  - 1.1 asks for the formatting pull request "while no other branches are open". This branch is
    open and would conflict heavily with a whole-codebase format.
  Nothing on it has been reviewed for security.
- The specification's phase numbers collide and several of its statements about the current state
  are out of date. The gap analysis lists ten such defects.
- Third-party claims in the specification were checked by web search on 2026-11-10. Verified:
  Supabase passkeys are in beta behind an opt-in; Vercel Hobby is non-commercial. Partly verified:
  the Play closed-testing rule. Not verified: Polar and Paddle seller support for Egypt. Details
  and links are in the gap analysis.
- The local clone is shallow (50 commits). Full history is needed for the blame-ignore work in
  1.1 and should be fetched then.

## Branches and pull requests

| Concern | Branch | Pull request | State |
|---|---|---|---|
| 1.0 preparation documents | `claude/elegant-hypatia-1enej8` | [Nofal-Amr/life-os-foundation#1](https://github.com/Nofal-Amr/life-os-foundation/pull/1) | Open, approved, the owner merges it |
| 1.1 CI | `phase1/ci` | [Nofal-Amr/life-os-foundation#2](https://github.com/Nofal-Amr/life-os-foundation/pull/2) | Open |
| 1.1 lint | `phase1/lint` | [Nofal-Amr/life-os-foundation#3](https://github.com/Nofal-Amr/life-os-foundation/pull/3) | Open |
| 1.1 README, agent rules, executor | `phase1/agent-rules-and-docs` | [Nofal-Amr/life-os-foundation#4](https://github.com/Nofal-Amr/life-os-foundation/pull/4) | Open; merge after pull request 1 |
| 1.1 formatting | not created | | Waiting on the owner |
| 1.1 hygiene cleanup and `.env` | not created | | Waiting on the owner |

Commits on that branch, in order: audit with the progress record, pull request link, the
specification, the gap analysis, this progress update. The audit shares its commit with the two
`docs/phase1` files; that commit was already pushed when the owner asked for separate commits, and
pushed history is not rewritten.

## Environment notes for whoever resumes

- Production Supabase project: `life-os-foundation` in `eu-central-1`. Treat it as read-only.
  Phase 0 ran metadata and aggregate-count queries only. Nothing in 1.0 touched it.
- Vercel could not be read (the connector returned 403 for the team scope). How the host supplies
  build-time variables is therefore still unverified, and 1.1 must confirm it before the tracked
  `.env` is replaced.
- The cloud container cannot reach most public sites and has no Android SDK. Android builds and
  device checks have to run in CI or on the owner's machine.
- Web checks that do run here: `npx vitest run`, `npx tsc --noEmit`, `npx eslint .`. Install
  with `npm install --no-save --no-package-lock --ignore-scripts` after `bun install` if the
  proxy refuses some packages.
