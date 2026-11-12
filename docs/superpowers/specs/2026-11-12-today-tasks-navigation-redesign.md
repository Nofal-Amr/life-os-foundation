# Today, Tasks and navigation: redesign draft

Status: **draft for the owner's decision.** Nothing here is built. It turns
items 3 to 8 of the UX audit (11 November 2026) into one design, so the web
and the native Android app can be built once, to the same plan.

## Why

The audit found that the app is calm to look at but busy to use:

- Today is 4.1 phone screens long with 61 controls, and shows the same tasks
  up to three times.
- Every row shows every action (six on a task).
- New task asks 14 questions before the task exists.
- Tasks opens with an empty chart.
- Ten tools sit in one flat list.

The five sections and the quick paths (typed capture, one-tap logging, Next
action) are the strengths, and stay exactly as they are.

## Goals

- Today fits on about two phone screens and answers one question: what do I
  do now?
- Each thing appears once.
- Every row works the same way in every section.
- A new task, habit or project needs only its name.
- Nothing is deleted. Everything that moves still has a place you can reach.

## Not goals

- No new features, data, tables or services.
- No visual restyle. Colours, type face and cards stay; only sizes change
  where the audit measured a problem.
- Quests and the RPG look are untouched.

## Would make this a failure

- Logging anything daily (a prayer, spending, a habit, a meal) takes more
  taps than today.
- A number appears that isn't from your own entries, or a streak or score
  appears outside the RPG look.
- A saved link stops working. Moved pages keep their old addresses as
  redirects.

---

## 1. Navigation

### Phone bottom bar

Done already on `ux/add-button`: the **+** is part of the bar, in the middle.

```
 Today   Do   Money   [ + ]   Body   Spirit   More
```

Seven items is tight at 375 px but fits, with labels at 12 px.

**Decision for the owner (D1).** The audit suggests five items: Today, Do,
+, Money, More, with Body and Spirit at the top of More. My recommendation
is the opposite: **keep Body and Spirit on the bar.** Prayers are logged five
times a day, and moving Spirit adds a tap to the most frequent action in the
app. The app records its own screen visits (`ux_events`); your counts there
would settle it.

### More, grouped

```
 Plan       Calendar · Week · Daily review · Insights
 Library    Notes · Study
 Shared     Together · Work · Messages      (each only when in use)
 ─────────
 Settings
```

- **Messages** shows only once Life Connect is set up. **Work** already shows
  only for members of a company.
- **Theme** and **Sign out** move into Settings. The header keeps the theme
  button.
- On desktop, the side menu has the same three groups under the five
  sections.

### Section tabs

| Section | Tabs now | Tabs after |
|---|---|---|
| Today | Today, Week, Time | none (Week goes to Plan; Time folds into the task timer, history under Insights) |
| Do | Tasks, Projects, Goals, Habits, Capabilities | Tasks, Projects, Goals, Habits (Capabilities becomes a part of each goal) |
| Money | Overview, Accounts, Home and bills, Transactions, Recurring, Categories | Overview, Transactions, Accounts, Recurring, Home and bills (Categories opens from Transactions) |
| Body | Health, Food | unchanged |
| Spirit | its own pill switcher | the same tab style as every other section |

Where a tab row is still wider than the screen, the last tab fades at the
edge, so it's clear the row scrolls.

Old addresses (`/week`, `/time`, `/capabilities`, `/finance/categories`)
redirect to the new place.

---

## 2. Today

### Now (phone, top to bottom)

Date and ring · Next action (5 buttons) · four count tiles · Today's focus
(three groups) · Last 7 days · mood and energy · prayers · medication ·
health log · calories · money · Coming up · Today so far.

### After

```
┌───────────────────────────────────────┐
│ Thursday, 12 November         ( 4/12 )│  date, greeting, the ring
│ Good morning, Demo                    │
├───────────────────────────────────────┤
│ NEXT ACTION                           │
│ Finish the kaitech proposal           │
│ Moved 3 times since 13 Oct.           │
│ [   Done   ]                   [ … ]  │  … = Focus, Start timer,
├───────────────────────────────────────┤      This feels hard, Open
│ From earlier                          │
│ ○ Book dentist appointment   3 days ago│
│ Today                                 │
│ ○ Write the summary paragraph   11:00 │
│ Unsorted                              │
│ ○ Call the electricity company        │
│ ○ Buy printer ink                     │
├───────────────────────────────────────┤
│ LOG                                   │
│ [Prayer] [Mood] [Meal] [Money]        │  each opens its quick panel
├───────────────────────────────────────┤
│ Today so far ▸                        │  one line; tap to open
└───────────────────────────────────────┘
```

- **One list.** From earlier, Today, Unsorted. A circle completes, the row
  opens. The Unsorted group is already built on `ux/quick-add-unsorted`.
- **Coming up** (the next three days) goes to Week, which is where you look
  ahead.
- **The four count tiles** go. Each count is now visible as the list itself.
- **Last 7 days** moves to Insights.
- **Mood, energy, prayers, medication, health, calories and money** become one
  row of four Log buttons. The prayer button shows the next prayer's name and
  time, so the daily glance stays.
- **Bills due** stay in the list, as they are now.

Target: under two phone screens and about 20 controls, down from 4.1 and 61.

**Decision for the owner (D2).** Which four Log buttons? I propose Prayer,
Mood, Meal and Money, shown only for sections you have turned on, with the
next prayer time on the Prayer button. Medication would show as a fifth
button only on days with doses due.

---

## 3. Rows: one pattern everywhere

```
 ○  Title of the thing                       …
    Due Thu · Work: Q4 report
```

- **Tap the row** to open it (edit).
- **One primary action** on the left: the circle for a task, Log for a habit
  or prayer, Log or Skip for a recurring cost.
- **"…"** holds everything else: timer, This feels hard, Duplicate, Delete.
- Delete is never visible by default. After deleting, Undo appears for a
  few seconds, as it does now.
- Tap targets are at least 44 px on phones.

Where this applies: Tasks, Projects, Habits, Transactions, Recurring,
Accounts and Categories. Recurring keeps one list, not two.

---

## 4. Tasks

```
 Tasks                                [ New task ]
 [Now] Upcoming  Overdue  Unsorted  Done  All
 ○ Finish the kaitech proposal              …
   6 Nov · Work: Q4 report · Waiting 38 days
 ○ Write the summary paragraph              …
   Today 11:00 · Work: Q4 report · 1 of 2 steps
```

- **List first.** The "Tasks completed per week" chart moves to Insights.
- **Now** is the default view: from earlier, today and unsorted. Already built
  on `ux/quick-add-unsorted`.
- **New task** asks for Title, Due and Project. **More options** opens the
  other eleven fields: status, priority, start, latest date, time, repeat,
  estimate, energy, goal, capability and description. No field is removed.
- New habit and new project work the same way: the name first, then icon and
  colour under More options.

---

## 5. Week, looking ahead

The audit found that Week looks back ("what was due and what you logged"),
while people open it to plan.

```
 This week                     ‹  9 – 15 Nov  ›
 Thu 12   ○ Write the summary paragraph  11:00
          Prayer times · 2 events
 Fri 13   (nothing yet)              [ + plan ]
 Sat 14   ○ Renew car licence
 ...
 Weekly reset  ▸  4 steps, 1 done
```

- **The next seven days**, each with its tasks, events and bills.
- **Plan a task** onto a day: tap **+ plan** on that day and pick from Unsorted
  or Upcoming. On desktop you can also drag a task onto a day.
- **The weekly reset** collapses to one line. Its steps open in place instead
  of sending you to another page.
- **What you logged last week** moves to Insights.

**Decision for the owner (D3).** Should Week be the forward plan above, or
stay a review? The native Week page waits for this answer.

---

## 6. Text size

- Body text is 16 px on phones and 14 px on desktop.
- 12 px is only for labels of two or three words.
- The eight one-off sizes go, leaving five sizes in total.
- Do this after sections 2 and 3, otherwise pages get longer before they get
  shorter.

---

## Order of work

1. **Ready on branches:** the two P0 fixes (`ux/quick-add-unsorted`,
   `ux/add-button`).
2. Rows (section 3), with component tests first, since there are none for the
   interface yet.
3. Today (section 2) and Tasks (section 4).
4. Navigation regroup and redirects (section 1).
5. Week (section 5), once D3 is answered.
6. Text sizes (section 6).

Each step is its own branch and pull request.

**The native app follows this design, not the current website.** Its Today, Do
and Money screens on `at-a-glance` copy today's layout. They are updated
after the web version of each step is approved, so the two never drift.

## Open decisions

| # | Question | My recommendation |
|---|---|---|
| D1 | Body and Spirit: on the bottom bar, or under More? | Keep them on the bar |
| D2 | Which Log buttons on Today? | Prayer, Mood, Meal, Money (+ Medication on dose days) |
| D3 | Week: plan ahead, or review? | Plan ahead; the review moves to Insights |
| D4 | Reminders: their own tool, or a kind of task? | A task with "ring at" set; the ringing stays |
