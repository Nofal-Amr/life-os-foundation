---
tags:
  - roadmap
  - ideas
updated: 2026-09-22
---

# Ideas backlog

Every idea raised so far, from you, your friend and your Development Notes. Size: S (a day or less), M (a few days), L (a week or more), XL (a project of its own). Status: **exists**, **partial**, **new**, **unclear** (needs a decision first).

> [!warning] Rules still apply
> Analytics, predictions and suggestions must follow [[Product rules]]: real data only, sample sizes shown, "not enough data" when there isn't.

## Planning and tasks

| Idea | Status | Size | Notes |
|---|---|---|---|
| Due date **and time** on tasks | new | S | add \`due_time\`; reminders at that time |
| Duplicate a task | new | S | from your notes |
| Task → step-by-step roadmap of mini-tasks | partial | M | steps and "shrink it" exist; add a guided breakdown |
| Start/end time and Pomodoro for mini-tasks | partial | M | timers exist ([[Time tracking]]) |
| **Pre-made plans** (get fit in N days, learn German in N days) | new | M | a template creates a project with tasks spread over days (reuses split-across-days) |
| **Study mode**: courses, assignments, deadlines, milestones, progress | partial | L | projects and goals cover part; add courses, schedule import (.ics from the uni portal), exam and assignment types |
| Goals that give rewards | partial | M | goals exist; RPG gives XP; add your own rewards unlocked by goals or levels |

## Insight

| Idea | Status | Size | Notes |
|---|---|---|---|
| Analytics from your history | partial | M | charts exist per area; add a history page across areas |
| Suggest relations between past events (e.g. sleep vs tasks done) | new | M | correlations with sample size, never causation claims |
| Predict habits | new | M | only transparent forecasts ("done 5 of the last 7 Mondays") |
| Export data and analytics to Excel | new | S-M | .xlsx download, one sheet per area |
| Helpful AI assistant | new | L | server-side Claude call, API key never in the app, clear consent for what data it sees |

## People

| Idea | Status | Size | Notes |
|---|---|---|---|
| Friends | new | XL | new tables and sharing rules; the biggest security change |
| Collaborate on tasks / co-tasking at the same time | new | XL | depends on friends; live presence for "doing it together" |

## Device and look

| Idea | Status | Size | Notes |
|---|---|---|---|
| Rotation | exists | — | the app isn't locked to portrait |
| Tablets, foldables, wide dashboard | partial | M | side menu appears from 768px; Today needs a multi-column wide layout |
| Dark and light mode | exists | — | |
| Multi-colour customisation | new | S-M | accent colour picker on top of the tokens ([[Design system]]) |
| Arabic and English | new | L | translate every string and mirror the layout (RTL) |
| Personality-type versions (optional, removable) | unclear | M-L | could be presets of modules, layout and tone chosen in setup |
| Set standards for the app | unclear | ? | needs a definition |

## Phone and integrations

| Idea | Status | Size | Notes |
|---|---|---|---|
| Water alarm | partial | S | reminders exist; add repeating interval reminders |
| Voice to text | new | M | web speech on the site; Android needs a native bridge |
| OCR | unclear | M | e.g. photo of a receipt → spending; needs a use case |
| App and phone lock for a task (focus lock) | new | L | Android screen pinning is feasible; blocking other apps needs invasive permissions |
| Access other apps | unclear | ? | needs a definition |
| National holidays per country (optional) | new | S-M | public holiday data, opt in per country, reject any day |
| Google Keep sync | not possible | — | Keep has no API for personal accounts; backup file or Drive backup instead |
| Google Flow | unclear | ? | needs a definition |
| Alexa | new | XL | needs an Alexa skill, account linking and a server |
| Car maintenance and fuel tab | new | M | from your notes |
| Sleep score, BMI method | new | S | from your notes |
| Notes more like Obsidian (headings, links) | new | M | from your notes |

## From the 23 Sep notes: after the weekly reset

Done on 23 Sep: multi-line task add (Enter = new line), daily log with medication, meter readings, food and spending details, pick accent from a photo, Life OS favicon, any day as week start, travel icons, diary page per day, delete account.

| Idea | Size | Notes |
|---|---|---|
| Accounts on their own Money tab | M | editing exists under Money › More › Accounts; move it to a tab |
| Resource usage graph (per day / month) | M | readings are stored; needs a chart per resource |
| Fuel as a resource: fill-ups with litres, price for 92/95, odometer | L | km per litre from real fill-ups, range left from your own usage (e.g. 300 km per tank) |
| Food onboarding: cuisines and foods you eat, then suggestions per meal | M | breakfast shows ful, taameya, sandwiches first; editable later |
| Most-used foods per meal in the log sheet | S | from your own logs, then search |
| Reminders as their own item in + (not only tasks) | M | native notification scheduling exists for prayers and task digests |
| Rant box that turns a paragraph into points | S | sentence split, no AI needed |
| On-device AI to split tasks | L | or a server model; decide privacy first |
| Receipts on spending with OCR | L | Storage bucket + OCR; note field already exists |
| Brand-style logos with a black-and-white minimal fallback | M | licensing; lucide has plane, ticket, hotel, taxi now |
| Friends or family: shared calendar, invite code "pods" | XL | competitor video pairs two people with a 6-letter code |
| Modes for students, engineers | L | module presets; Classroom sync and OCR task input |
| Google sync (Calendar, Keep) | L | Keep has no personal API |
| Workday cost | ? | needs a definition |
| Enterprise / accounting version, monetisation | XL | vision, not a feature |

Video direction from the competitor clip: talking head cut with top-down phone shots on a cutting mat, one-word captions, big sticker-style words, one large progress ring on Home.

## About the way we work (not the app)

| Idea | Status | Notes |
|---|---|---|
| Keep every message sent to an AI agent in a Word document | unclear | a Claude Code hook could log prompts; needs a decision on what exactly |
| A Claude skill for saving tokens | new | could be written with the skill creator |

Related: [[Roadmap and known issues]] · [[Features]]
