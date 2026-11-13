> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

# Rules for any agent working here

Life OS is a calm, honest personal operating system. `main` deploys automatically to the live
site (https://lifeos0.vercel.app), so everything that reaches `main` is live within minutes.

**Read these first:**

- `second-brain/Handoff - next session.md`: what is in progress and what comes next.
- `second-brain/Decisions.md`: the owner's decisions.
- `docs/MASTER_SPEC.md`: a roadmap of future features. It is not a sequence of phases to restart.

## Safety

- **Work on your own, and let the checks be the gate.** Don't stop to ask about routine steps.
  Each change loops through produce, check and fix, at most 3 attempts. Green means type check,
  unit tests, lint on the touched files, the production build and a headless demo run all pass.
  When green, open a pull request with the results and merge it. If still red after 3 attempts,
  stop and report. Never push directly to `main`.
- **Always ask the owner first** before any database write, deleting data, spending money,
  changing secrets, or anything that can't be undone.
- **The production database is read-only.** Never run SQL that writes, and never apply a
  migration, without the owner's written approval of that exact statement. Staging comes first.
- **Connector or MCP tools** (Supabase, Vercel, Lovable) are off limits unless the owner's task
  names them.
- **No secrets, keystores or user data** in code, logs, tests or commits. Never read one-time codes
  (OTPs).
- **One branch and pull request per concern.** Every change ships with a test that fails without
  it.
- **Never rewrite pushed history.** No force-push, and no rebasing, amending or squashing commits
  that are already pushed.

## Product rules

- **Real data only.** No invented scores, targets or percentages.
- **No streaks, guilt or good/bad colour verdicts.** Use calm, factual wording.
- **No medical, health or financial advice.**
- **Simple over more features.** Other apps are inspiration, never something to copy.
- **Benchmark every product audit against the competition.** See
  `docs/research/competitive-benchmark-brief.md`.
