# Phase 1 progress

Read this first when resuming. Scope and rules are in `EXECUTION_PROMPT.md` (owner's text,
verbatim). The audit this phase acts on is `../audits/PHASE_0_AUDIT.md`.

Last updated: 2026-11-10, at the 1.0 checkpoint.

## Where things stand

| Sub-phase | State |
|---|---|
| 1.0 Preparation | **Partly done, waiting on the owner.** Audit saved, hook report done, this file created. Gap analysis blocked: the specification is not in the repository. |
| 1.1 Delivery gate (A6, S13) | Not started. Needs a decision on the `at-a-glance` branch first (below). |
| 1.2 Schema source of truth (A1) | Not started. Needs the staging answer. |
| 1.3 Mobile sign-in and signing (S3, S1, S2) | Not started. Needs the production domain. |
| 1.4 Data-exposure fixes (S4, S5, S7, S8 default, S12) | Not started. |

**Next step:** once `docs/MASTER_SPEC.md` is pushed, write `docs/audits/PHASE_0_GAP_ANALYSIS.md`,
then stop for approval of 1.0. Do not start 1.1 before that approval.

## Waiting on the owner

1. **Specification.** `docs/MASTER_SPEC.md` is not on GitHub. Checked 2026-11-10 after a fresh
   fetch and through the GitHub API: `main` is still `f682e84`, `docs/` on `main` contains only
   `superpowers/`, and no commit on any branch touches that path. It is probably committed or
   saved locally and not pushed.
2. **Staging (decision 7).** Still template text in both owner messages. Needed for 1.2: either
   the staging project ref (no keys), or a request to be guided through creating it.
3. **Production domain (decision 9).** Still template text. Needed for 1.3.
4. **`at-a-glance` branch.** See "New since the audit".

## Decisions made so far

- Hooks: the owner disabled them locally. They are not to be re-enabled. Removing them from the
  repository belongs to the S13 cleanup in 1.1.
- The specification is the product target. `EXECUTION_PROMPT.md` is the only definition of scope
  and wins any conflict; conflicts are raised with the owner.
- Android: the native Kotlin app (`app.lifeos.kt`) is the long-term app. The WebView app
  (`app.lifeos`) gets security fixes only.
- Life OS is a multi-user public product. All stored data is other people's data.
- Sync is out of scope for Phase 1. iOS is out of scope.
- Lovable is no longer used.

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
  WebView app and website. The audit covered `main` only, so:
  - the audit's parity table understates the native app as it exists on that branch;
  - the music remote is a new feature in the WebView app, which decision 2 now limits to
    security fixes;
  - 1.1 asks for the formatting PR "while no other branches are open". This branch is open and
    would conflict heavily with a whole-codebase format.
  The owner needs to say whether it is merged first, kept open, or dropped. Nothing on it has
  been reviewed for security.
- The remote copy of the working branch `claude/elegant-hypatia-1enej8` had been deleted before
  1.0 began. It was recreated by the 1.0 push.
- The local clone is shallow (50 commits). Full history is needed for the blame-ignore work in
  1.1 and should be fetched then.

## Branches and pull requests

| Concern | Branch | Pull request | State |
|---|---|---|---|
| 1.0 preparation documents | `claude/elegant-hypatia-1enej8` | [Nofal-Amr/life-os-foundation#1](https://github.com/Nofal-Amr/life-os-foundation/pull/1) | Draft, documentation only; gap analysis still to be added |

## Environment notes for whoever resumes

- Production Supabase project: `life-os-foundation` in `eu-central-1`. Treat it as read-only.
  Phase 0 ran metadata and aggregate-count queries only.
- Vercel could not be read (the connector returned 403 for the team scope). How the host supplies
  build-time variables is therefore still unverified, and 1.1 must confirm it before the tracked
  `.env` is replaced.
- The cloud container cannot reach the public site and has no Android SDK. Android builds and
  device checks have to run in CI or on the owner's machine.
- Web checks that do run here: `npx vitest run`, `npx tsc --noEmit`, `npx eslint .`. Install
  with `npm install --no-save --no-package-lock --ignore-scripts` after `bun install` if the
  proxy refuses some packages.
