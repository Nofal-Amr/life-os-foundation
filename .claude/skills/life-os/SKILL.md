---
name: life-os
description: The owner's working rules for Life OS, the calm-first personal operating system covering tasks, money, body, Spirit (prayer and azkar), calendar, notes and Life Connect. It is the React/TanStack website on Vercel, the Kotlin native Android app, the Java web-view app and the Wear OS app. Use this skill at the start of ANY work in the life-os-foundation repo or its worktrees (lo-ux, lo-dev, lo-build, .claude/worktrees/*): building features, fixing bugs, UX or design work, audits, research, Android builds, pushes, pull requests and database changes. Also use it when the user mentions Life OS, Spirit, prayer times, azkar, Today, Reflect, Life Connect, the native app or the second brain, even if they don't name the skill. It holds the product rules (real data only, no streaks or verdicts), the git, push and database safety rules, the mandatory competitive benchmark, and the owner's standing product decisions.
---

# Life OS: how the owner wants work done

Life OS is one person's calm, honest operating system for the day: tasks, money until payday, body, faith (prayer, azkar, Qibla), calendar, notes, and Life Connect (a SIM phone paired with the main phone). The owner is getting it ready for the general public. Their bar is "maturity level top notch, smooth, easy to adapt, no security concerns, ready for marketing and user adoption, not a mess of features on a page".

Read `second-brain/Handoff - next session.md` first. Its top section says what is in progress, which branches exist and what comes next. The owner wants a new session to read it and keep going without asking again. Before ending a session, update it.

## 1. Product rules: they define the product

Every screen, string and colour must pass these rules.

- **Real data only.** Show numbers and trends from rows the user actually logged. Never invent scores, targets, percentages or composite indices.
  - A chart with fewer than 2 points shows "not enough data yet".
  - A ring needs a real stored denominator.
- **No streaks, no guilt, no verdicts.**
  - No loss framing ("you missed 3").
  - No "you're doing great".
  - Colour never judges good or bad, and never carries meaning on its own.
  - Use calm, factual, gain-framed wording.
- **No medical, health or financial advice.**
- **Gaming is opt-in.** The RPG skin may show XP, levels and quests, derived transparently from real rows. It has no random loot and no estimated energy or focus meters. The Serious skin is the default and follows every rule above.
- **ADHD-first.** The owner's reference is How to ADHD (Jessica McCabe): tiny first steps, less friction, external reminders, and rewarding starting. The real problem is stuck tasks, not missing features.
- **Simple, not a feature pile.**
  - One clear next action. Short forms with "More options".
  - Areas the user can switch off. Settings that stay short, with sub-pages.
  - Asking whether a feature is needed comes before asking how to add it.
- **Never copy other apps.** Take principles, adapt them in Life OS's own voice, and say what was adapted and why. This includes a friend's app the owner shares. If a borrowed idea conflicts with a rule above, ask the owner instead of silently adopting or dropping it.

## 2. Safety rules: the owner set these, so don't bend them

- **Work autonomously, with one gate at the end** (owner's decision, 2026-11-13). Don't stop to ask about routine steps: editing, installing packages, running checks, committing, pushing your own branch, opening a pull request. A session that waits for an answer stalls overnight.
  - **The loop for every change:** produce, check, fix, repeat until green, with **at most 3 attempts**. If it still fails after 3, stop and report what failed and why.
  - **Green means all of these pass:**
    - `npx tsc --noEmit`;
    - `npx vitest run`;
    - `npx eslint` on the files you touched;
    - the production build (`NITRO_PRESET=node-server npm run build`);
    - a headless demo run of the pages you touched at 375 px and desktop width, with no console errors;
    - for Android changes, `npm run test:android` / `build:android` / `build:native`.
  - **When green:** push the branch, open the pull request (description: what changed, the check results, screenshots for UI), then merge it with `gh pr merge --merge`. The owner approved merging green pull requests (2026-11-13). Check that the live site deploys (lifeos0.vercel.app returns 200) and report.
- **Still always ask the owner first:**
  - any database write or migration;
  - deleting data or user-visible content;
  - spending money;
  - changing secrets or keys;
  - anything that can't be undone.
- **Never push directly to `main`; always go through a pull request.** `main` auto-deploys to https://lifeos0.vercel.app (Vercel, not Lovable).
- **No force-push, and never rewrite pushed history.** The repo is connected to Lovable, so rewriting history loses the owner's project history.
- **The `at-a-glance` branch stays unchanged.**
- **One branch and one pull request per concern.** Branch from `origin/main`. Demo mode is localStorage `lifeos:demo`=`1`.
- **The production database is read-only.**
  - No SQL that writes, and no migrations, without the owner's written approval of that exact statement. Staging comes first.
  - Write the migration file, explain it in plain words, and wait.
- **Don't use the Supabase, Vercel or Lovable connectors** for changes. **Don't re-enable the agent hooks** (`.claude/settings.local.json`, `.codex/hooks.json`).
- **Privacy:**
  - Never read one-time codes (OTPs).
  - Don't send account data to third parties.
  - On-device processing is preferred: photo reading, the AI assistant.
- **Files other people send** (APKs and the like): put them in an isolated scratch folder and inspect them without running them. Run them only on the emulator, and only after the owner says yes. Never install them on the owner's phone.

## 3. Mandatory in every product audit: the competitive benchmark

Benchmark against Notion, ClickUp, Amazing Marvin, Lunatask, Griply, Todoist, TickTick, Things 3, Sunsama, Motion, Morgen, Structured, Tiimo and Timestripe. For Spirit, also the prayer apps: Muslim Pro, Athan, Pillars, Mawaqit, Sajda, Prayer Now and Hisn al-Muslim.

The deliverable has:

- a matrix and a 1–10 scorecard;
- advantages, weaknesses, unnecessary complexity and differentiation;
- the patterns to adopt;
- answers to the strategy questions;
- a positioning map;
- a roadmap with essentials kept apart from optional items.

Use official sources with dates, and label estimates as estimates.

The owner's own words on the goal: "I don't want Claude to conclude that Life OS should become Notion plus Todoist plus TickTick plus Sunsama." Lead with what nobody else combines: faith, payday money and one-line capture, in one honest day.

The brief is `docs/research/competitive-benchmark-brief.md`. The past results are `docs/research/2026-11-12-*.md`.

## 4. Standing product decisions: don't re-ask these

`references/decisions.md` lists them with dates. The ones most likely to matter:

- **The master spec is a roadmap of future features,** not a restart of phases.
- **Ship the website first.** The native Kotlin app (`mobile/native`) is paused until the owner approves the web design. Stay with Kotlin, not Flutter. Decide on iPhone later, between Kotlin Multiplatform and React Native.
- **Prayer wake-up alarm:**
  - One tap beside a prayer (mainly Fajr, also Shurooq and the others) sets an alarm in the phone's own Clock app, N minutes before the prayer (a slider, default 10).
  - It is a **wake-up aid, not a replacement for the adhan**. Adhan sounds are only postponed.
- **No paywall and no ads on worship, ever.** If a paid plan ever exists, it charges for power features: sync, export, AI reading of receipts and photos, Life Connect.
- **Spirit:**
  - The calculation method follows the country (Egypt uses Egyptian).
  - Prayer tracking stays guilt-free.
  - Azkar are offered at the right moment.
- **Reflect:** one line at a time (good, hard, grateful, idea, note), compiled into the daily review.
- **Auto-spending** reads only notifications from the bank apps the user ticks, and asks the user to confirm each one. The watch is Wear OS only.

## 5. How to talk to the owner

- **Write plain words.** The owner reads on a phone over Remote Control: short, concrete, no jargon. Give a recommendation, not a survey of options.
- **Terse or all-caps messages** are usually urgency, not cancellation. If one could mean either, ask.
- **Keep the second brain current.** It lives in `second-brain/`, an Obsidian vault: Handoff, Decisions.md and competitor notes. Memory notes are in `~/.claude/projects/C--Users-ASUS-030T-life-os-foundation/memory/`.
- **Big separate pieces of work go to their own session,** with a brief that points here.

`references/repo-notes.md` has the practical how-to: worktrees, CRLF, headless checks, Android builds and the emulator.
