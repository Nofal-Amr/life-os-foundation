---
tags:
  - decision
  - moc
updated: 2026-09-22
---

# Decisions

## No Capacitor

The Android app is a hand-built WebView (aapt2/javac/d8). Smaller, no Gradle, full control of the bridge. See [[Android app]].

## Vercel, not Lovable

Deploys from `main`. See [[Hosting and deploy]].

## Redesign in place

Kept the two Stitch looks; unified radii and cards, Hanken Grotesk, 12px floor, one mobile menu (bottom bar "More"), sliding tab underline. See [[Design system]].

## Derived links over new columns

Projects ↔ goals come from task links, so no migration was needed. See [[Data model#Links (derived, no extra columns)]].

## Guess, then let the user choose

Habit categories are guessed from names and marked "(guessed)". See [[Habits]].

## Games are opt-in

XP, levels and streaks only in the RPG skin, each explained. See [[Skins - Serious and RPG]].

## Conservative security headers

No script CSP yet (needs nonces for the inline theme script); everything else on. See [[Supabase and security]].

## Script CSP with nonces (2026-11-12)

Branch `fix/csp`: per-request nonce, `strict-dynamic`, production only. Replaces the conservative headers above once merged.

## Ship the web first, calm and simple (2026-11-12)

Native app paused until the owner approves the web design. Today shows one next action plus Log tiles; one + button; Reflect compiles single lines into the daily review. See [[Handoff - next session]].

## Benchmark every audit against 14 products (2026-11-12)

Learn principles, never merge apps: lead with faith, payday money and one-line capture; make areas opt-in; goals drive daily actions; evening ritual. Full report: `docs/research/2026-11-12-competitive-benchmark.md` (branch `docs/competitive-benchmark`).

## Prayer wake-up alarms on the phone's own clock (2026-11-12)

The alarm is a wake-up aid, mainly for a sleepy Fajr. It is **not** a replacement for the adhan: adhan sounds are only postponed (not for now) and stay on the roadmap. Beside each prayer (including Shurooq) one tap sets an alarm in the phone's Clock app, a few minutes before the prayer (default 10, chosen with a slider; for example 20 for Shurooq). "I am sleepy, open the app, tap the Fajr alarm." Android only, via the app bridge; the plain website says it needs the Android app. See [[Competitor - Azka Qibla Finder]].

## Relationships as a people graph (2026-11-13)

Obsidian-style map with "Me" at the centre: closest, family, relatives. Picking a person makes their side glow, and nothing hides. Each person has a check-in cadence, a contact log, a goal, a birthday and basic info. Reminder rules are editable by group or person, with exceptions (for example "no birthday reminders for cousins, except X"). Calm, with no scores. Session: relationships.

## Daily notes first, markdown plans in (2026-11-13)

Notes opens on today's dated note, which autosaves and syncs live across devices. A documented plan-markdown format (goal, then projects, then tasks with dates, priority and weeks) plus an importer with a preview. A copyable prompt makes ChatGPT or Claude output that format, for example the 4-week career plan. Sessions: notes-and-import; Google Calendar sync in gcal-sync (needs the owner's Google OAuth client).

## at-a-glance merged into main (2026-11-13)

The owner approved it, so the native app and the music remote move onto main. Session: merge-at-a-glance.

## Duha live for real accounts (2026-11-15)

The owner asked Claude to run the `prayer_duha` migration; applied and checked (the prayer log constraint allows `duha`). PR #46 switched `DUHA_IN_DATABASE` on.

## Logo direction, parked (2026-11-15)

The **life** part of the life-and-death cycle (also energy, power), from Arabic calligraphy, readable in English, not a literal plant. Owner liked the swelling pen-stroke ن with a diamond nuqta; wants an English link (ل = L candidate). Parked by the owner; see [[Logo - status]].

## Simplify before adding (2026-11-17)

Before new vision-plan features, check that everything works and make the app calm, even with every area on. The order is in `docs/superpowers/specs/2026-11-17-simplify-before-adding.md`. Week + Calendar become **Plan**; Daily review + Insights become **Review**; the "4 of 12" ring moves from Today to Review.

## Areas as segments (2026-11-17, idea)

Each area (Work, Spirit…) gets its own tasks, notes and the rest. Needs an `area` column (DB change, ask first).

## Gym (2026-11-17)

Gym stays inside Body. Tables applied with the owner's OK. Wanted next: plan, then log, and Galaxy Watch workouts via Health Connect.

## Quran text (2026-11-17)

Quran passages carry full standard tashkeel, from Tanzil's text, never typed by hand.

## Everything on GitHub (2026-11-17)

The owner must be able to continue without any AI: `docs/owner/README.md`, with the rules in `.claude/skills/life-os/`.

## Plan side and doing side (2026-11-17)

Food and Gym each have a **plan** (what you mean to do) and a **log** (what happened), plus a `.md` import like Import a plan. Tables applied with the owner's OK (`20261117120000_food_gym_plans.sql`). Gym is built (#65); Food's plan side is next. Planned vs logged is shown side by side, never scored.

## Exercise library (2026-11-17)

Gym uses free-exercise-db (public domain, 876 exercises with steps and photos), not a typed list. Text ships with the app; photos load on tap from the source, pinned to one commit. English first.

## Work: corrections and holidays (2026-11-17)

Admin corrections win over raw taps everywhere, the clock card included. A wrong tap can be removed (the original stays stored). Every tap shows; pay is first in → last out. Days still to come are never "absent". Company official holidays live in the rules JSON. The day-penalty size is the company's setting (VONKAI is at 30 = 3.33%; the owner wants 5% = 20, and sets it).

## Quran verse signs (2026-11-17)

Each verse ends with its number in ornate brackets (﴿١﴾); the basmala sits on its own line when it isn't a numbered verse.

## Egypt holidays (2026-11-17)

Nager.Date is the source, with its decree-shifted dates (moved to Thursday). Egypt's missing Islamic days (Eid al-Fitr, Arafah) are filled in from Umm al-Qura as expected dates. Don't guess the Thursday shift for future years.

## InBody (2026-11-17, next)

InBody results go into `health_samples` (`source: "inbody"`), no new table.

## Work and Study as spaces, no new tables (2026-11-18)
Work and Study each have Tasks, Notes, Ideas and Calendar tabs. Tasks live in one project per space, notes and ideas carry the `work`/`study` (+`idea`) tags. The main calendar shows or hides each space (Settings → Calendar), stored as `calendar:hide-work` / `calendar:hide-study` in `enabled_modules`. Work is an opt-in module and shows without a company. (PR 78)

## Move whole projects into a space (2026-11-18)
A project (with every task and subtask) can be moved to Work or Study and back: Projects ⋯ menu, or "Bring in a project" in the space's Tasks tab. Stored as `space:<work|study>:<projectId>` in `enabled_modules`; no task is touched, so moving back is lossless. Moving in switches the space on. (PR 83)

## Study schedule from a screenshot, the user's own AI (2026-11-18)
Like Bring a plan: copy a prompt, paste it with the screenshot into any AI chat, paste the answer back, check the list, add. Life OS sends nothing to an AI. "Read it on this phone" uses the on-device reader (tesseract) for clean lists; grids are better read by the AI chat. Format: `CLASS | weekday | HH:MM | HH:MM | course | room` and `EXAM | YYYY-MM-DD | HH:MM | course | name`. (PR 84)

## Attendance: admins can remove any single tap (2026-11-18)
A wrong tap mid-day (e.g. out 9:12, in 9:44) is removed with a correction whose value is `drop:<time>` (no DB change). The sheet, clock card and Excel all read it via `tapCorrection`. (PR 82)

## Evening ritual (2026-11-18)
"Close the day" from 6 pm on Today and in the daily review: tick what's done, move the rest to tomorrow, with Undo. (PR 80)
