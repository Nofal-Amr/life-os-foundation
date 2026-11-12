# Life OS — competitive benchmark

Date: 12 November 2026. Research and analysis only; no product code changed.

## How to read this

| Label | Meaning |
|---|---|
| **Verified** | Read on the product's own site or help centre on 12 Nov 2026 (links in Sources). |
| **Observed** | Seen working in Life OS in demo mode, on `main` and on the local `ux/` branches. |
| **Estimate** | My judgement from official material and the product's reputation, not from hands-on use. **Every competitor score is an estimate.** I had no accounts for them. |

What was not done: no competitor was used hands-on, no user testing, no screen readers.

Life OS evidence comes from:
- the UX audit of 11 Nov 2026 (28 screens measured at phone and desktop sizes);
- this week's work on the `ux/` branches;
- the code.

Its demo data is small. A real account after months of use will be denser.

---

## 1. Who actually competes

No product covers Life OS's whole scope. Its scope is tasks, projects, goals and habits, plus money, body, food, medication, prayer and azkar, calendar, notes, study, shared spaces, work attendance and Android phone linking.

| Group | Products | Relation to Life OS |
|---|---|---|
| **Whole-life systems** | **Lunatask**, **Griply**, Timestripe | Closest in intent. They connect daily actions to life areas. None has money, prayer or health logging. |
| **All-in-one workspaces** | Notion, ClickUp | They compete for the "one place for everything" slot, through flexible pages and databases. They are built for work and teams, and you build your own system. |
| **Task execution** | Todoist, TickTick, Things 3 | The bar for capture and everyday task handling. TickTick is the most relevant: it combines tasks, habits, calendar, focus and an Eisenhower matrix in one app. |
| **Daily planning** | Sunsama, Motion, Morgen, Structured | They set the bar for "what do I do today". They plan the day for you, place tasks on a calendar, or show the day as a timeline. |
| **Neurodivergent-friendly planning** | Tiimo, Amazing Marvin | The closest to Life OS's ADHD-aware principles: visible time, one thing at a time, and features you switch on only when needed. |

Life OS's realistic rivals are **Lunatask and Griply** (whole life), **TickTick** (breadth done coherently) and, for its ADHD users, **Tiimo and Marvin**.

The others matter as **specialists that set the bar** in one capability each. A user who picks Life OS is usually choosing it *instead of three apps*: a task app, a budget app and a prayer app.

### Positioning map

```
                    Broad scope (many life areas)
                              ▲
              Notion ●        │        ● Life OS (today)
              ClickUp ●       │   ● Lunatask
                              │        ● Griply
   You build    ◄─────────────┼─────────────►   Ready-made,
   the system                 │  ● TickTick       opinionated
                 ● Marvin     │      ● Timestripe
                              │  ● Todoist   ● Sunsama
                  ● Morgen    │  ● Things 3  ● Tiimo
                     ● Motion │      ● Structured
                              ▼
                    Narrow scope (tasks / time)
```

Life OS sits where few products do: **broad and ready-made**. That is its opportunity, and also why it can feel crowded. Notion and ClickUp avoid that crowding by making the user build the system; Life OS has to avoid it through restraint.

---

## 2. What each one teaches (verified facts, then the lesson)

**Todoist** (verified; help article updated 11 Nov 2026)
- Quick Add understands:
  - plain-language dates ("every other Tuesday");
  - `#Project /Section`, `%label` and `p1`–`p3` priorities;
  - deadlines in `{braces}`.
- **Q** opens Quick Add, and the desktop app has a global shortcut.
- Free: 5 projects and 3 filters. Pro: $5/month billed yearly.
- *Lesson:* the most common action is one keystroke and one line, and the syntax grows with you without ever being required.

**TickTick** (verified)
- Tasks, a calendar (year, month, week, agenda, multi-day), habit tracker, Pomodoro, Eisenhower matrix, countdowns and widgets.
- Free: 9 lists, 5 habits. Premium: $49.99/year.
- *Lesson:* breadth works when every feature is a separate tab with the same task model underneath, not cards stacked on one home screen.

**Things 3** (verified)
- Apple only.
- One-time prices: Mac $49.99, iPhone $9.99, iPad $19.99.
- Inbox, Today with **This Evening**, Upcoming, Anytime, Someday, Areas, and Projects with headings.
- *Lesson:* a few fixed lists with clear meanings, plus extreme visual calm.

**Sunsama** (verified)
- There is no free plan, by design. Pro is $17/month billed yearly.
- The planning assistant drafts your day from your notes, theme and rules. It shows every change and lets you undo each one.
- **Shutdown**:
  - reviews the day;
  - drafts your highlights;
  - asks for a short reflection with an emoji;
  - rolls unfinished tasks over.
- *Lesson:* start-of-day and end-of-day **rituals** turn planning into a habit, and every automated change stays visible and undoable.

**Motion** (verified)
- Auto-scheduling places tasks on your calendar in this order:
  1. ASAP tasks;
  2. hard deadlines (even outside working hours);
  3. soft deadlines;
  4. priority.
- It also respects working hours and splits tasks into chunks.
- It reschedules whenever anything changes.
- Pro AI: $19/seat/month; no free plan shown.
- *Lesson:* remove repeated decisions ("when do I do this?"), not add AI for its own sake.

**Amazing Marvin** (verified)
- Any feature can be turned on or off; it has more than 300 settings.
- Anti-procrastination tools:
  - Super Focus (one task at a time);
  - Task Jar (picks a task at random);
  - Procrastination Wizard;
  - Pomodoro.
- $8/month; no free plan.
- *Lesson:* complexity is **opt-in**. The default app is small, and power users switch features on.

**Notion** (verified)
- Home is a set of sections (Upcoming events, Recents, Favorites and others) that you can hide, reorder and resize.
- Free plan: unlimited pages for one person. Plus: $10/month. Notion Calendar is included free.
- *Lesson:* a flexible product stays calm because its home lets *you* hide sections, not because it shows less.

**ClickUp** (verified)
- Free Forever: unlimited tasks, 5 Spaces, 100 automation actions a month.
- *Lesson (estimate):* an example to avoid for individuals. Enormous breadth, with complexity that is visible everywhere.

**Lunatask** (verified)
- It covers:
  - tasks, prioritised for you with Must/Should/Want or an Eisenhower matrix;
  - habits;
  - mood and journaling;
  - notes;
  - a personal relationship manager with reconnect reminders.
- It claims **end-to-end encryption**, no in-app analytics or tracking, and asks only for an email address.
- Free: 2 life areas, 7 habits, 30 relationships. Premium: $6/month billed yearly.
- *Lesson:* the closest whole-life rival, and its privacy story is stronger than Life OS's.

**Griply** (verified)
- One hierarchy: **Vision → Life areas → Goals → Subgoals → Projects → Tasks and habits**. Habits link to the goals they serve.
- A single insights dashboard shows goal progress and habit trends.
- Free: 2 goals, 2 habits, 5 projects. Premium: $49.99/year or $149.99 lifetime.
- *Lesson:* the "whole life" idea only means something when daily actions visibly roll up into life goals.

**Tiimo** (verified)
- Built by and for neurodivergent people (ADHD and autism).
- A visual timeline, colours and icons, a countdown timer.
- AI breaks a messy brain-dump into steps with time estimates.
- Also: routines, mood tracking and reflection, and widgets.
- Free version on iOS and Android.
- *Lesson:* time shown as space, and starting made easy.

**Structured** (verified via App Store listing; prices vary by region)
- Free: a drag-and-drop timeline and an inbox.
- Pro adds:
  - calendar and Reminders sync;
  - routines;
  - an AI that drafts your day;
  - Replan, which moves missed tasks.
- *Lesson:* the day as one timeline is instantly understood.

**Morgen** (verified)
- A unified calendar across Google, Outlook, iCloud and Fastmail, task integrations, and an AI planner for time blocking.
- $15/month billed yearly; 14-day trial.

**Timestripe** (prices unverified: the official site didn't load; aggregators list a free Basic plan and Pro at about $5/month)
- Planning across time "horizons", from day to year.
- *Lesson:* goals at several time scales on one screen.

---

## 3. Feature comparison matrix

Ratings: **E** excellent, **G** good, **B** basic, **W** weak, **–** missing, **n/a** not applicable.
- Life OS ratings are **observed**.
- Competitor ratings are **estimates** from official material.
- Execution quality counts, not only whether a feature exists.

| Dimension | Life OS | Lunatask | Griply | TickTick | Todoist | Things 3 | Sunsama | Motion | Marvin | Notion | Tiimo |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Product clarity | W→G¹ | G | G | G | E | E | E | G | B | B | E |
| Navigation | B | G | G | G | E | E | G | B | B | B | G |
| Home experience | W→G¹ | G | G | G | G | E | E | G | B | B | E |
| Ease of use | B | G | G | G | E | E | G | B | B | B | E |
| Task capture | G² | G | B | E | E | E | G | G | G | B | G |
| Projects | B | B | G | G | G | E | B | G | G | E | – |
| Goals | B | B | E | – | – | – | B | B | B | B | – |
| Habits | G | G | G | G | – | – | – | – | G | B | B |
| Calendar | B³ | G | G | E | B | B | E | E | G | G | G |
| Life areas | G | E | E | – | – | B | – | – | B | B | – |
| Finance | **E**⁴ | – | – | – | – | – | – | – | – | B | – |
| Health and food | G | B | – | – | – | – | – | – | – | B | B |
| Spiritual practice | **E**⁵ | – | – | – | – | – | – | – | – | – | – |
| Notes | B | G | – | B | – | B | B | – | B | E | – |
| Reflection and review | G⁶ | G | B | – | – | – | E | – | B | B | G |
| Personalisation | B | G | B | G | G | B | G | G | E | E | G |
| Mobile UX | B→G¹ | G | G | E | E | E | B | B | B | B | E |
| Offline | **G**⁷ | G | B | G | G | E | B | B | G | B | G |
| Consistency | B | G | G | G | E | E | G | B | B | G | G |
| Privacy | G⁸ | **E** | B | B | B | G | B | B | B | B | B |
| Arabic and RTL | **G**⁹ | – | – | B | B | – | – | – | – | B | – |
| Accessibility | B | B | B | G | G | G | B | B | B | G | G |

Notes:
1. On `main` the audit measured Today at 4.1 phone screens and 61 controls. The local `ux/today-focus` branch takes it to 1.9 screens. Not yet live.
2. One line understands spending ("85 lunch"), income ("+500 bonus") and tasks with a day ("call mom tomorrow"), including Arabic digits. It has no syntax for project, priority or repeats. Since this week's fix, quick-added tasks appear on Today.
3. Life OS shows tasks, events, prayers and holidays. It doesn't sync Google or Outlook calendars; it only imports `.ics` files for study.
4. "Left to spend before payday" with an explanation, recurring costs, accounts and pockets. No competitor here has finance.
5. Prayer times, logging, Sunnah and Witr, azkar, tasbih and Qibla. Unique in this group.
6. Daily review. The local `ux/reflect` branch adds one-line capture of good things, hard things, gratitude, ideas and notes, compiled into the day.
7. Offline-first on Android and the web. Two fixes on local branches stop data showing to the wrong user and stop rejected changes being lost.
8. Data is limited to its owner and there are no third-party trackers. It is not end-to-end encrypted, and the Phase 0 audit still has open items on mobile sign-in.
9. Arabic and right-to-left are built in. Most competitors are English-first.

---

## 4. Scorecard (1–10)

Competitor scores are **estimates**. Life OS is scored as it is on `main` today, with the local branches' effect in brackets.

| | Breadth | Depth | Usability | Cohesion | Maturity |
|---|---|---|---|---|---|
| **Life OS** | **9** | 5 | 4 (6) | 4 (6) | 4 (5) |
| Lunatask | 7 | 6 | 7 | 7 | 7 |
| Griply | 5 | 6 | 7 | 8 | 6 |
| TickTick | 7 | 7 | 8 | 7 | 9 |
| Todoist | 4 | 9 | 9 | 8 | 10 |
| Things 3 | 3 | 8 | 10 | 10 | 10 |
| Sunsama | 4 | 8 | 8 | 9 | 8 |
| Motion | 5 | 7 | 6 | 6 | 7 |
| Amazing Marvin | 8 | 8 | 5 | 6 | 7 |
| Notion | 8 | 7 | 5 | 6 | 9 |
| Tiimo | 4 | 6 | 9 | 8 | 7 |

What drives each Life OS score:
- **Breadth 9:** nothing else spans tasks, money, health, prayer, study and shared spaces.
- **Depth 5:** money and spirit are deep; calendar, notes and projects are basic; there's no goal-to-day breakdown yet (spec phase 3).
- **Usability 4:** the audit found:
  - a long Today;
  - six actions on every row;
  - a 14-field task form;
  - 12 px text on two-thirds of Today.
- **Cohesion 4:** sections share components, but goals, habits and life areas don't visibly feed each other. Ten tools sit in one flat list.
- **Maturity 4:** no CI on `main` yet, open sign-in hand-off findings, no error tracking, schema not reproducible from the repo.

| Overall | Life OS |
|---|---|
| UX | **4/10** today, about 6 once the local branches merge |
| Functionality | **7/10**: wide, uneven depth |
| Cohesion | **4/10** |
| Competitive position | **Unique scope, weakest polish.** Nobody offers this combination, but each specialist does its own part more smoothly. |

---

## 5. Winning and losing

### Life OS advantages (keep and sharpen)
1. **Faith built in.** Prayer times, logging, azkar, tasbih and Qibla next to tasks and money. No competitor here has it. For Muslim users it's a reason to choose Life OS on its own.
2. **Money that answers a real question.** "How much can I spend before payday", with the working shown. Whole-life rivals have no finance at all.
3. **One-line capture across areas.** "85 lunch" logs spending and "call mom tomorrow" makes a task. Todoist parses tasks only.
4. **Honest, calm numbers.** Only your own entries, "not enough data yet" instead of invented scores, and no streak pressure unless you choose the RPG look.
5. **ADHD-aware basics:** one next action, stuck-task help, "This feels hard", and energy-aware ordering.
6. **Offline-first and Arabic/RTL**: rare among these products, and important for its first market.

### Competitive weaknesses (others are clearly better)
1. **Everyday polish.** Todoist and Things make the commonest action effortless. Life OS still shows everything at once.
2. **Planning the day.** Sunsama, Motion, Structured and Tiimo help you decide *when*. Life OS shows lists, but has no day timeline, no rituals and no rescheduling help.
3. **Goals that drive the day.** Griply's chain from vision down to daily actions makes "whole life" meaningful. Life OS goals sit beside the tasks rather than above them.
4. **Calendar sync.** Every planning product syncs Google or Outlook; Life OS doesn't.
5. **Trust and privacy story.** Lunatask's end-to-end encryption and "no analytics" are simple promises. Life OS is private by design, but can't yet say "even we can't read it".

### Unnecessary complexity (effort without equal value)
1. On `main`, Today repeats tasks three times and shows four count tiles plus a "Last 7 days" card. (Fixed on `ux/today-focus`.)
2. Ten tools in one flat list, including Messages, which is shown to users without a second phone.
3. Capabilities, a fifth concept beside tasks, projects, goals and habits.
4. Every row shows every action; Recurring shows each cost twice.
5. Forms ask every question up front: 14 for a task, 7 plus colours for a habit.
6. Reminders are a separate tool, so you have to classify something before you can capture it.

### Differentiation opportunities
1. **Prayer-aware days.** Plan tasks around prayer times automatically. Motion schedules around meetings; nobody schedules around Salah.
2. **"Can I afford it?" goals.** Purchase goals tied to the payday figure ("Laptop: 400 a month, on track for March"). Finance and goals together, which no competitor can do.
3. **A ritual that compiles the day.** Morning: one next action and the Log tiles. Evening: Reflect compiles good, hard, grateful, ideas and money spent into one page. Like Sunsama's shutdown, but for a whole life.
4. **Simple first, more when wanted.** Marvin's opt-in model applied to whole sections. New users see Today, Do and one more area; Money, Body, Spirit, Study and Work join when chosen.
5. **Honest realism.** Show your actual completion rate and warn before over-planning ("this week is 140% of what you usually finish"). Spec phases 3–4. No competitor here is this candid.

---

## 6. Design patterns worth adopting

| # | Pattern | Seen in | Why it works | Fit for Life OS |
|---|---|---|---|---|
| 1 | **One-line capture with an optional grammar** (`#project`, `p1`, "every Friday") | Todoist | The fast path never asks a question; the syntax is there when you want it. | **Adopt.** Extend `parseCapture` with project, priority and repeats, and keep the preview. |
| 2 | **Opening and closing rituals** | Sunsama | A fixed moment to decide and to let go lowers the daily load. | **Adopt, lightly.** Evening Reflect plus "move unfinished to tomorrow"; morning is Today itself. |
| 3 | **Features you switch on** | Marvin; Notion's Home sections | The default stays small; power is there for whoever wants it. | **Adopt.** The module switches exist; make them the onboarding question and show tools only once enabled. |
| 4 | **Vision → area → goal → action chain** | Griply | Daily effort visibly adds up to something. | **Adopt.** Show which goal each task or habit serves, and goal progress from linked work. |
| 5 | **The day as a timeline** | Structured, Tiimo | Time made visible helps ADHD users the most. | **Adapt.** A Day view: prayers as fixed anchors, events, and tasks you drop in. |
| 6 | **Undoable automation** | Sunsama, Motion | Help that you can see and reverse gets trusted. | **Adopt for any planning help.** Show what moved and allow undo, never silent changes. |
| 7 | **Fixed lists with clear meanings** (Today, This Evening, Upcoming, Someday) | Things 3 | Each list means one thing, so there's nothing to configure. | **Adapt.** "Later today" and "Someday" for Unsorted. |

**Avoid copying:**
- Notion's build-it-yourself blank page.
- ClickUp's everything-visible density.
- Motion's fully automatic calendar (it takes away control, and is costly to build well).
- Gamified streak pressure (against Life OS's rules).
- Sunsama's no-free-plan model (wrong for mass adoption in Egypt).

---

## 7. Strategy: answers to the ten questions

1. **From Notion:** a home whose sections the user can hide, and flexibility that's earned rather than imposed.
2. **From Todoist:** make capture one line, with optional grammar, everywhere.
3. **From TickTick:** breadth survives when each area is its own clear tab sharing one task model. Don't stack it all on the home screen.
4. **From Sunsama:** rituals at the start and end of the day, with every automated change visible and undoable.
5. **From Marvin:** features are opt-in; the default app is small.
6. **From Motion:** remove repeated scheduling decisions, but suggest rather than move things silently.
7. **From Griply, Timestripe and Tiimo:** daily actions roll up to life goals, and time is shown as space for ADHD users.
8. **Avoid copying:**
   - blank-page building;
   - visible density;
   - fully automatic calendars;
   - streak pressure;
   - paywalling the basics.
9. **Keep unique:**
   - faith built in;
   - payday-aware money;
   - one-line capture across areas;
   - honest numbers;
   - Arabic first;
   - offline-first.
10. **Why choose Life OS over two or three apps:** one place where today's task, today's money and today's prayers sit side by side. Planning respects prayer times and payday, which no pair of specialist apps can do together.

---

## 8. Prioritised roadmap

### Essential (needed to compete)
1. **Finish the simplification already in progress.** Today (done locally), one way of handling rows, short forms, grouped navigation, readable text. It fixes "weakness 1" and most of "unnecessary complexity".
2. **Opt-in areas at sign-up.** Ask "What do you want help with?" and show only those sections. (Pattern 3)
3. **Goals that show their actions.** Link habits to goals and show each goal's progress from linked work. (Pattern 4)
4. **Evening ritual.** Reflect (done locally), plus "move unfinished to tomorrow" and a one-screen summary of the day. (Pattern 2)
5. **Fix the trust basics:**
   - the open audit items (sign-in hand-off, signing keys, invite codes, public bucket);
   - error tracking;
   - a public, plain privacy promise.

### Strong next steps
6. **Capture grammar:** project, priority and repeats. (Pattern 1)
7. **Day timeline anchored on prayer times.** (Pattern 5, differentiation 1)
8. **Purchase goals tied to payday.** (Differentiation 2)
9. **Google and Outlook calendar sync**, read-only first.

### Optional, later
10. Planning suggestions, always shown as undoable changes.
11. End-to-end encryption for sensitive areas (health, medical, journal).
12. Over-planning warnings from your real completion rate. (Spec phases 3–4)

**The recommendation in one line:** don't add areas. Make the ones Life OS has calm, connected and trustworthy, and lead with what no one else can do: faith, money and tasks in one honest day.

---

## Sources (all read 12 Nov 2026)

- Todoist pricing: <https://todoist.com/pricing>
- Todoist Quick Add (updated 11 Nov 2026): <https://www.todoist.com/help/articles/use-task-quick-add-in-todoist-va4Lhpzz>
- TickTick Premium: <https://ticktick.com/about/upgrade>
- TickTick features: <https://ticktick.com/features>
- Things 3: <https://culturedcode.com/things/>
- Things 3 App Store listings: <https://apps.apple.com/us/app/things-3/id904280696>, <https://apps.apple.com/us/app/things-3/id904237743>
- Sunsama pricing: <https://www.sunsama.com/pricing>
- Sunsama daily planning: <https://help.sunsama.com/docs/daily-planning>
- Sunsama shutdown and highlights: <https://help.sunsama.com/docs/usage-guides/daily-highlights>
- Motion pricing: <https://www.usemotion.com/pricing>
- Motion auto-scheduling: <https://www.usemotion.com/help/time-management/auto-scheduling.md>
- Amazing Marvin pricing: <https://amazingmarvin.com/pricing/>
- Amazing Marvin home page: <https://amazingmarvin.com/>
- Notion pricing: <https://www.notion.com/pricing>
- Notion Home and My Tasks: <https://www.notion.com/help/home-and-my-tasks>
- ClickUp pricing: <https://clickup.com/pricing>
- Lunatask pricing: <https://lunatask.app/pricing>
- Lunatask home page: <https://lunatask.app/>
- Griply pricing: <https://griply.app/pricing>
- Griply home page: <https://griply.app/>
- Tiimo pricing: <https://www.tiimoapp.com/pricing>
- Tiimo home page: <https://www.tiimoapp.com/>
- Morgen pricing: <https://www.morgen.so/pricing>
- Structured App Store listing (regional prices vary): <https://apps.apple.com/app/structured-daily-planner/id1499198946>
- Timestripe, aggregator only (official site didn't load): <https://www.capterra.com/p/10016105/Timestripe/pricing/>
