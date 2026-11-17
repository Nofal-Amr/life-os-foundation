# Simplify before adding: screens and flows

Status: **for the owner's approval.** Nothing here is built yet. No new features, no database
changes. Every feature stays reachable; what changes is _when_ and _where_ it shows.

## Why

The owner (2026-11-17): the app "seems too crowded"; check that every feature works and works well
before adding more from the vision plan.

## What was checked (2026-11-17, live site, demo mode)

- **All 31 pages open** at phone (375 px) and desktop width with no errors, no crashes and no
  sideways scrolling. 535 unit tests pass in CI.
- **Core flows work:** one-line capture, task, spending and prayer logging save and come back.
- **But the app is busy.** Phone page lengths, in screens (812 px each):

| Page         | Screens | What makes it long             |
| ------------ | ------- | ------------------------------ |
| Settings     | **10**  | 22 cards on one page           |
| Insights     | 5       | five reports stacked           |
| Transactions | 4.4     | every day of the month at once |
| Health       | 3.7     | habits, log, charts, history   |
| Quests       | 3.4     | five sections (RPG look only)  |
| Spirit       | 2.8     | four tabs plus "At a glance"   |
| Work         | 2.5     | five tabs plus "Your month"    |
| Today        | 2.2     | eight blocks                   |

- **The menu:** five sections, 14 tools under More, and tabs inside sections. About 31
  destinations for a new user who wanted a to-do list and prayer times.
- **Flow problem found:** capture "call the plumber tomorrow" from Do: it saves, then disappears,
  because Do opens on "Now" and the task is in "Upcoming". Nothing says where it went.

The benchmark (`docs/research/2026-11-12-competitive-benchmark.md`) already said why this matters:
Todoist and Things win on everyday polish; ClickUp's everything-visible density is the thing to
avoid; Marvin keeps the default app small and lets people switch power on. Its one-line
recommendation still holds: **don't add areas; make the ones Life OS has calm, connected and
trustworthy.**

## The rule for every screen

1. **One job per screen.** If a screen needs a second heading to explain itself, the second part
   moves to its own page or tab.
2. **A new account starts small:** Today, Do, and the areas the person picked. Everything else is
   off until switched on, and switching on is one tap from where it would be useful.
3. **Every action says what happened and where it went** ("Added to Upcoming · Show").
4. **History and charts live in Insights**, not on top of working lists.
5. **About two phone screens at most** for any main page before "Show more".

## The changes, in order

Each is one branch and one pull request, checked green at 375 px and desktop.

1. **Settings becomes a short list** (10 screens → 1). Rows that open their own page:
   Profile · Areas · Prayer · Money · Body · Phone and watch (Life Connect, watch, bank
   notifications) · Work · Calendar and holidays · Language and look · Your data (export, crash
   reports, delete account). Cards for areas that are off don't show.
2. **Capture always confirms.** After any add, a short message names where it went, with "Show".
   Fixes the plumber case everywhere at once.
3. **Do opens on its list.** The "Tasks completed per week" chart moves to Insights.
4. **Choose your areas at sign-up** (benchmark essential #2). "What do you want help with?" Tasks
   is always on; Money, Body, Spirit, Study, Work, People are ticks. More shows only what is on.
5. **More gets shorter** (14 → about 8 for someone with everything on):
   - Week and Calendar become one **Plan** (week ahead, with the calendar a tap away).
   - Daily review and Insights become one **Review** (today's review first, history below).
   - Relationships and Together become **People** (your people; shared lists inside).
   - Messages shows only once Life Connect is set up; Quests only in the RPG look; Import a plan
     moves into the + menu; Time moves into a task's focus timer.
6. **Today keeps four blocks:** Next action · Today's list (overdue and today only; "coming up"
   lives in Plan) · Log tiles · **one** helpful card at a time (a birthday, the workload line, a
   stuck task), not all of them. The "4 of 12" ring and counters move to Review, since the ring
   mixes tasks, habits and prayers into one number.
7. **Long pages fold:** Insights shows one report at a time (tabs); Transactions shows this week
   with "Earlier"; Health puts history behind "Show history".
8. **Then** the evening ritual (move unfinished to tomorrow, plus the day in one screen), which
   the benchmark calls essential.

Only after these: new vision-plan features, one at a time, each asking first "does this need its
own place, or does it fit an existing one?"

## Would make this a failure

- Logging anything daily takes more taps than today.
- A feature someone uses becomes unreachable, or an old link breaks (moved pages redirect).
- A new number appears that isn't from the person's own entries.

## Questions for the owner

| #   | Question                                                                  | Recommendation                                                    |
| --- | ------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Q1  | Approve the order above?                                                  | Yes; Settings and capture feedback first (most felt, least risk). |
| Q2  | Merge Week + Calendar into Plan, and Daily review + Insights into Review? | Yes.                                                              |
| Q3  | Move the "4 of 12" ring off Today?                                        | Yes; it's the only mixed number on Today.                         |
| Q4  | Existing accounts: keep every area they have on, or ask them once?        | Keep what's on; offer "Tidy up areas" once.                       |
