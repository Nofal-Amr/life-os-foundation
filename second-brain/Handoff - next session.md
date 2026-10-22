---
tags: [handoff]
updated: 2026-10-22
---

# Handoff for the next session

## Uncommitted work (finish first)
1. `src/data/demoSeed.ts`: expense amounts stored as negative (bug fix). Commit.
2. New widgets (Android side done, builds): `mobile/android/src/app/lifeos/MoreWidgets.java`, layouts `widget_next/quick/money.xml`, infos in `res/xml`, manifest receivers, `MainActivity.setTodayWidget` refreshes them.
   - TODO: `src/data/widgets.ts` (`widgetNextAction`, tested) → use in `src/components/app/TodayWidgetSync.tsx` to send `next` and `nextDetail`; widen `setTodayWidget` type in `src/lib/native.ts`.
3. Then: tsc, vitest, `npm run build`, `npm run build:android` + `:full`, commit, push `at-a-glance` and `main`, `gh release upload android-2026-10-08 ... --clobber`.

## Done this session (committed)
- Demo mode (`src/lib/demo.ts`, `src/data/demoSeed.ts`, "Try the demo" button, banner). Use it to test screens: localStorage `lifeos:demo=1`.
- Calendar: Day/Week/Month/Schedule, time grid (`src/components/app/calendar/TimeGrid.tsx`, `src/data/calendarLayout.ts`), prayer marks, Together events.
- Today: count boxes moved below the next action.
- Android: renderer-crash recovery, target API 36, edge to edge, predictive back, fuller crash report.
- Work (attendance + pay sheet), watch app, Life Connect fixes, notification pile-up fix, Messages page, stuck-task helper, weekly reset.

## Test results (demo mode, 375 px)
- All 28 screens load, no console errors.
- Fixed: month chips unreadable on phones, Health logs flooding calendar, prayer labels repeated in week view.

## Ideas / open
- Today still dense ("Coming up" twice; many blocks) — simplify.
- Kotlin/Compose native rewrite: proposed, not decided.
- Google Calendar sync needs OAuth client ID.
- Keep sessions short: one request at a time.
