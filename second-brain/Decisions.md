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
