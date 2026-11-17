# Running Life OS yourself

This folder is for you, the owner, and for anyone (person or AI) who continues the work. Everything
needed to keep building Life OS is in this repository; nothing depends on one PC or one AI.

| File                                                                  | What it holds                                                                                    |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [`rules`](../../.claude/skills/life-os/SKILL.md)                      | The product rules and safety rules every change must follow.                                     |
| [`decisions`](../../.claude/skills/life-os/references/decisions.md)   | Your decisions, newest first, so nobody asks again.                                              |
| [`repo notes`](../../.claude/skills/life-os/references/repo-notes.md) | Practical traps on the Windows PC (worktrees, line endings, emulator).                           |
| [`notes/`](notes/)                                                    | Longer background notes: the original vision, ADHD reference, hosting, prayer alarm, benchmark.  |
| [`../../second-brain/`](../../second-brain/)                          | The Obsidian vault: handoff, decisions, competitors, brand, vision. Open the folder in Obsidian. |
| [`../MASTER_SPEC.md`](../MASTER_SPEC.md)                              | The roadmap of future features (a list, not an order to restart).                                |

The rules are kept as a Claude skill in `.claude/skills/life-os/` (plain Markdown you can read), so any
Claude session in this repo picks them up. `AGENTS.md` points other AI tools here.

## Where things live

| Part                                 | Where                                                                      | How it goes live                                                                                     |
| ------------------------------------ | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Website                              | `src/` (React, TanStack Start)                                             | Every merge into `main` deploys to https://lifeos0.vercel.app (Vercel).                              |
| Database                             | Supabase project `albrfuugjiimogrtepql`; changes in `supabase/migrations/` | You apply each migration yourself (below). Nothing applies automatically.                            |
| Old Android app (`app.lifeos`)       | `mobile/android/` (Java, shows the website)                                | Build an APK and install it. It carries **a copy** of the website, so rebuild after website changes. |
| Native Android app (`app.lifeos.kt`) | `mobile/native/` (Kotlin)                                                  | Paused until the web design is approved.                                                             |
| Watch                                | `mobile/wear/`                                                             | Build an APK.                                                                                        |

## Making a change (the loop)

1. Install once: Node.js 22, [Bun](https://bun.sh), Git, and Android Studio for the apps.
2. `git switch main && git pull`, then `git switch -c my-change`.
3. `bun install`, then `bun run dev` and open the address it prints. Demo mode: open the browser
   console and run `localStorage.setItem("lifeos:demo", "1")`, then reload.
4. Make the change. Before pushing, all of these must pass:
   - `npx tsc --noEmit`
   - `bun run test`
   - `bun run lint` (`bun run format` fixes formatting)
5. `git push -u origin my-change`, open a pull request on GitHub, wait for the checks to go green,
   then merge. Vercel deploys `main` in a minute or two.

Never force-push and never rewrite history that is already on GitHub (the repo is linked to
Lovable). Keep `main` working: it is the live site.

## Changing the database

1. Write a new file in `supabase/migrations/`, named `YYYYMMDDHHMMSS_what.sql`. Every table needs
   row-level security with one policy per action, like the existing files.
2. Try it on a staging project first if you have one.
3. Apply it: Supabase dashboard → project → SQL Editor → paste the file → Run. Or with the
   Supabase CLI: `supabase db push`.
4. Regenerate the types: `supabase gen types typescript --project-id albrfuugjiimogrtepql > src/integrations/supabase/types.ts`.
5. Dashboard → Advisors → Security: check nothing new shows up.

**Waiting now:** `supabase/migrations/20261116120000_gym.sql` (Gym). Until it is applied, Gym says
it needs a one-time update.

## Building the phone apps

```sh
bun run build:android        # mobile/android/build/life-os-debug.apk  (installs from a file)
bun run build:android:full   # life-os-full.apk  (SMS + notifications; install with adb)
bun run build:wear           # life-os-wear.apk
bun run build:native         # life-os-native.apk
```

Install on a phone over USB: `adb install -r mobile/android/build/life-os-debug.apk`.
Debug builds are for your own phones. Anything given to other people must be a release build
signed with your key: see [`../android-release-signing.md`](../android-release-signing.md).

## Your to-do list (only you can do these)

- **Gym migration:** apply `20261116120000_gym.sql` (above).
- **Android release key:** create it (signing guide steps 1–2). Then it can be stored as a GitHub
  secret so GitHub builds a fresh APK on every merge that installs over the old one.
- **Google sign-in and Calendar:** add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_KEY`
  in Vercel → Project → Settings → Environment Variables.
- **Legal pages:** fill in `src/lib/legal.ts` (name, contact, country).
- **Supabase → Authentication → leaked-password protection:** turn it on.
- **A real domain** for launch (needed for Android App Links and the sign-in hardening, audit M2/M3).

## Working with an AI again

Point it at this file and at `second-brain/Handoff - next session.md`. The handoff's top section
says what is in progress; update it at the end of every session.
