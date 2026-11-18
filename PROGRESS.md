# Life OS: progress

_Updated 2026-11-18. The detailed, always-current handoff is
[`second-brain/Handoff - next session.md`](second-brain/Handoff%20-%20next%20session.md);
decisions are in [`second-brain/Decisions.md`](second-brain/Decisions.md)._

## Current state

- **Website** is live at https://lifeos0.vercel.app and auto-deploys from `main`
  (TanStack Start + React Query + Tailwind, Supabase backend).
- **Android apps**, all built from `main` on 2026-11-18:

  | App                                    | File                 | Version |
  | -------------------------------------- | -------------------- | ------- |
  | Standard phone app (web view)          | `life-os-debug.apk`  | 0.3.1   |
  | Full phone app (adds bank-SMS reading) | `life-os-full.apk`   | 0.3.1   |
  | Global phone app (no Life Connect)     | `life-os-global.apk` | 0.3.1   |
  | Native Kotlin/Compose app              | `life-os-native.apk` | 0.2     |
  | Wear OS watch app                      | `life-os-wear.apk`   | 1.0     |

- **Checks on `main`:** CI green; 584 unit tests pass (the only local failure is
  `mobile/android/signing.test.mjs`, which needs the release key).
- **Open pull requests:** one, #74 (Work excuses, incentives and allowances), waiting on
  database approval.

## Done (most recent first)

- **#93** Lists no longer flick back to old data right after a save (the prayer "Log" flicker).
- **#92** Forwarded texts keep their real sender (they had all merged into one "sim" thread).
- **#91** `PROJECT_FULL.md`: the whole project in one file, secrets removed.
- **#90** Work and Study have a Projects tab; a moved project leaves personal Projects.
- **#89** Three Android builds: Full, Standard and Global (no Life Connect, for app stores).
- **#88** The SIM phone's battery shows on the main phone, with alerts at 20% and 10%.
- **#87** Life Connect music remote works as a real player, volume keys included.
- **#86** Life Connect no longer crashes when a setting is changed.
- **#85** This progress file and the second brain for 2026-11-18.
- **#84** Study → Timetable → "Make my schedule". The user shows a screenshot to any AI chat
  with our prompt and pastes the answer back. They can also read the screenshot on the phone
  instead. They check a preview before anything is added.
- **#83** Move a whole project, with its tasks and subtasks, into Work or Study and back.
- **#82** Work attendance:
  - Admins can remove any single wrong clock-in or clock-out tap.
  - The correction form opens fresh for each day, with the time already filled in.
  - Full Work test: 55 of 55 checks pass.
- **#81** Arabic across the app: about 1,300 strings and Arabic dates. A sweep of 38 pages
  showed no errors and no overflow.
- **#80** Close the day: from 6 pm, move unfinished tasks to tomorrow, with Undo.
- **#78** Work and Study as their own spaces (Tasks, Notes, Ideas and Calendar tabs).
- **Earlier in November:**
  - Simplified web design.
  - Owner handbook.
  - Security audit fixes.
  - Strict CSP.
  - Legal pages.
  - Spirit: prayer wake-up alarm, next prayer and Hijri date, Quran verse signs.
  - Egypt holidays.
  - Food and gym plans.
  - Native app screens at parity with the website: Body, Spirit and Calendar.

## In progress / waiting

- **#74 (Work excuses, incentives and allowances):** it needs the owner's written OK on two
  migrations:
  - `20261117140000_work_excuses.sql`
  - `20261117150000_work_pay_items.sql`
- **Native app catch-up:**
  - The native app has been paused since 2026-11-12.
  - It is missing what the website gained since late October, plus fingerprint clock-in
    and the workplace location.
  - It needs the owner's go-ahead.
- **Phone checks for the owner:** #87, #88, #89, #92 and #93 are only tested on the emulator.
  Also check the Full app's battery use on the POCO after a day (more than 5% → lengthen the
  heartbeat).
- **One data fix for the owner:** remove the wrong 9:12 tap on 17 Nov in Work → Sheets.
- **Local branches kept for reference:** some are behind `main` and some have no pull request.
  Any branch with commits that weren't on GitHub was pushed on 2026-11-18.

## Next steps

1. **Owner to-dos:**
   - Fill in `src/lib/legal.ts`.
   - Turn on Supabase leaked-password protection and PKCE.
   - Add a Google Calendar client ID.
   - Pick a production domain.
   - Enter the base salary in Work → People.
   - Run `/login` so claude-mem can save memories again.
2. **Approve or decline the #74 migrations.**
3. **Plan items, in order:**
   - Website error tracking (needs the OK to use an outside service).
   - A day timeline built around prayer times.
   - Purchase goals tied to payday.
   - The remaining short Arabic labels.
   - InBody input.
   - Photos next to to-dos (needs an owner decision).
4. **Native app:** catch up to the website once the owner approves, then add Life Connect and
   the Full / Standard / Global builds.
5. **Optional:** make the Global build ready for Google Play (release key and AAB).

## Ground rules (short version)

- **Real data only.** No streaks, scores or verdicts.
- **The production database is read-only** without the owner's written OK on the exact SQL.
- **Every change goes through a branch and a pull request.** No force-push, since the repo is
  connected to Lovable. The `at-a-glance` branch stays unchanged.
- **The full rules** are in the `life-os` skill and in `AGENTS.md`.
