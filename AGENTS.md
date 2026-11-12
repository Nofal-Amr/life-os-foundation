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

- **Ask the owner before every push.** Never merge to `main` or deploy without the owner's
  approval in the conversation.
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
