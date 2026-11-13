# Phase 1 — execution instructions (owner's text, verbatim)

This file records the owner's Phase 1 instructions and follow-up answers exactly as given, so a
fresh session can resume from files alone. It is the only definition of Phase 1 scope. Where it
conflicts with `docs/MASTER_SPEC.md`, this file wins and the owner is asked.

Bracketed text such as `[FINAL DOMAIN]` is unfilled template text in the original. Those values
are still open; see `PROGRESS.md`.

---

## Message 1 — Phase 1 instructions

PHASE 1 — EXECUTION INSTRUCTIONS

Life OS: Delivery Foundation, Schema Source of Truth and Auth Exposure

I approve your Phase 0 audit and authorize Phase 1 only, limited to the scope below.

Inputs
- Your Phase 0 audit report. If it is not already in the repo, save it unchanged as docs/audits/PHASE_0_AUDIT.md (documentation-only commit, own branch).
- The Master Build Specification, which I have added at docs/MASTER_SPEC.md.
- Re-inspect the repository and branch at the start of every sub-phase. Do not rely on memory of the audit.

Approved scope (audit finding IDs)
A1, A6, S1, S2, S3, S4, S5, S7, S12, the repository hygiene items in S13, and the small S8 default change in 1.4.

Not approved, do not start
A2, A3, A4 (Phase 2 sync contract); A5, S6, the S8 redesign (Phase 3); S9, S10, S11 (Phase 4); the design system, goal engine, feature modules, passkeys, subscriptions, hosting migration, Rust, iOS.

Decisions
1. Master spec: deliver your deliverable-10 gap analysis as docs/audits/PHASE_0_GAP_ANALYSIS.md as the first step.
2. Android target: the native Kotlin app (app.lifeos.kt) is the long-term app. The WebView app (app.lifeos) receives security fixes only until the native app reaches parity. No new features in it.
3. Life OS is a multi-user product for the public. Treat S5 and S6 as real risks and all stored data as other people's data.
4. Sync approach is undecided. Phase 2 begins with a design comparison (build vs adopt, conflict policy per entity type). Do nothing on sync now.
5. Life Connect: default one-time-code forwarding to off. No other change.
6. iOS is out of scope. Do not touch the iOS shell.
7. Staging: [I HAVE CREATED / I AUTHORIZE YOU TO GUIDE ME THROUGH CREATING] a separate Supabase project. Never create billable resources yourself. Never copy production data into staging; production holds real people's health and finance data, so use synthetic seed data only.
8. Lovable is no longer used. README.md and AGENTS.md may be corrected to match reality.
9. Production domain: [FINAL DOMAIN]. Needed for Android App Links.

Operating rules
1. One branch and pull request per concern, small commits. Do not merge to main, deploy, or change anything in production without my explicit approval.
2. Production database is read-only unless I approve a specific statement. For every migration, show: the SQL, a rollback script, affected tables, expected effect on existing rows, and risks. Confirm a verified backup exists first.
3. Use expand/contract. Never drop or rewrite a structure in the same release that replaces it.
4. Never expose secrets or user data in code, logs, tests, commits or reports. Keystores and passwords never enter the repo. I generate keys; you write instructions and wire the config to read from outside the repo.
5. Every change ships with tests that fail without the change.
6. Stay inside the approved scope. No unrelated refactors, no new dependencies without justification.
7. If something is inaccessible or unverifiable, say so. Do not assume.
8. Existing user data must not be lost or altered. Prove it with before/after checks.
9. Before editing anything, read the committed agent hook scripts (.claude/settings.local.json, .codex/hooks.json and the script they run) and tell me what they do. If they do anything beyond local formatting or linting, stop and wait for my decision.
10. At every checkpoint, update docs/phase1/PROGRESS.md (decisions made, current state, next step) so a fresh session can resume from files alone.

Sub-phases (stop at each checkpoint and wait for my approval)

1.0 Preparation
- Save the audit, write the gap analysis, report on the hook scripts.

1.1 Delivery gate (A6, S13)
- First, one formatting-only PR applying the project's configured formatter to the whole codebase, with no logic changes, listed in .git-blame-ignore-revs. Do it while no other branches are open.
- Resolve or justify the 38 non-formatting lint issues.
- GitHub Actions: lint, tsc --noEmit and unit tests for web; Gradle build and unit tests for the native Android app (and the WebView build if practical).
- Correct README.md and AGENTS.md. Replace the tracked .env with .env.example, but first confirm how the host supplies build-time variables so the deployed build does not break, and tell me what to set at the host.
- Tell me exactly which branch-protection settings to enable once CI exists. I will enable them.
Checkpoint: CI green on a pull request.

1.2 Schema source of truth (A1)
- Generate a baseline migration from the live schema via read-only access: tables, enums, functions, triggers, policies, grants, storage buckets and storage policies.
- Prove it: build an empty database from the baseline and diff it against live. The diff must be empty, or every difference explained.
- Give me a plan to reconcile production's migration history (12 applied vs 25 files): mark the baseline as applied, never re-run it, archive (do not delete) the legacy files. Wait for my approval before touching production's migration history.
- Build staging from the baseline with synthetic seed data.
- Move to CLI-managed migrations and generate TypeScript types from the schema. Leave the client-side column stripping (src/lib/offline.ts) alone and note it for Phase 2.
- Tests on staging: every public table has RLS enabled; anon has no access; every SECURITY DEFINER function pins search_path; and two-user tests (user A cannot read, update or delete user B's rows) for every table and storage bucket, built so they fail if a policy is removed. Retire the manual script that writes into auth.users.
Checkpoint: empty diff, staging running, tests passing.

1.3 Mobile sign-in and signing (S3, S1, S2)
- Design note first, for my approval. Constraints: Google blocks OAuth inside embedded WebViews, and the native app already has Credential Manager sign-in (feature/auth/GoogleSignIn.kt). Preferred direction: the native app uses Credential Manager only and the lifeosnative:// hand-off is removed; the WebView app uses PKCE with verified Android App Links, so the code verifier never leaves the app.
- Release signing: wire both Android builds to a release keystore read from outside the repo and remove the debug-keystore generation in mobile/android/build.mjs. Give me step-by-step instructions to generate and back up the key. Tell me which certificate fingerprint is needed for sideloaded builds and which for Play-distributed builds (Play App Signing).
- Host /.well-known/assetlinks.json on the production domain.
- Callback validation: reject any auth callback with no pending request created by this app. Never clear unsynced local data on a user switch without explicit user confirmation.
- Web: switch to PKCE. Verify email confirmation, password reset and Google sign-in end to end, including when the link is opened on a different device from the one that started it.
- You cannot read Supabase Auth settings. Give me a checklist (redirect allow-list, token lifetimes, rate limits, email confirmation, leaked-password protection) to read from the dashboard and paste back before you change anything.
- Existing installs must reinstall once because the key changes. Give me the cutover sequence so nobody is locked out.
- Test on staging first, then production with a dedicated test account.
Checkpoint: demo on a real device; the old hand-off URL no longer yields a session.

1.4 Data-exposure fixes (S4, S5, S7, S8 default, S12)
- S4: namespace the web offline store (cache and outbox) by user id, stamp queued writes with their user, and refuse replay or clear on any user change, including session expiry and the hand-off sign-out. Minimal change; the sync rewrite is Phase 2.
- S5: longer cryptographically random invite codes, expiry, per-user attempt throttling, a member cap for work orgs, restrict who can read work_orgs.invite_code, and rotate existing codes. Ask me before adding admin approval for work-org joins (my inclination is yes).
- S7: make project-images private, add size and MIME limits, record it in a migration, confirm the code uses signed URLs.
- S8: default one-time-code forwarding to off in ConnectConfig.java. Nothing else.
- S12: enable leaked-password protection and server-side password rules where the plan allows; tell me what to change in the dashboard and verify the result.
Checkpoint: each fix with its test, on staging and then production.

Definition of done for each fix
Traceable to a finding ID; tests that fail without it; verified on staging with before/after evidence; existing data proven intact; documented with how to roll it back.

Final report
1. Findings fixed (ID, evidence, test, PR).
2. Migrations applied, with rollback status.
3. CI and test results.
4. Findings not completed, with reasons.
5. New risks discovered.
6. Settings or keys I must change myself.
7. Decisions needed before Phase 2, starting with the sync design.

STOP after the report. Do not begin Phase 2 until I explicitly approve it.

---

## Message 2 — answers before starting 1.0

Answers for Phase 1:

1. Hooks: I have disabled them locally. Still read the scripts they referenced and report what they do. Do not re-enable them; any removal from the repo goes through the S13 cleanup in 1.1.

2. Specification: it is now in the repo at docs/MASTER_SPEC.md. Its phase numbers do not match the execution phases. Treat the spec as the product target and the Phase 1 execution prompt as the only definition of scope. If they conflict, the execution prompt wins and you ask me.

3. Staging: [I have created it at <project ref, no keys> / guide me through creating it]. Never copy production data into it.

4. Production domain: [DOMAIN] (not needed until 1.3).

Begin with 1.0 only, and stop at that checkpoint. also save a progress .md across contexts
