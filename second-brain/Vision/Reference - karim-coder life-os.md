---
tags: [vision, reference, competitor]
source: https://github.com/karim-coder/life-os
demo: https://life-os-me.vercel.app/
reviewed: 2026-09-25
---

# Reference: karim-coder/life-os

An open-source "digital brain": Next.js 16 + Prisma (SQLite or Postgres),
self-hosted, single user, MIT licence. About 12,800 lines. Reviewed from the
source (commit `052ae06`), not only the landing page.

## How their system is built

- **One universal `Item`** for everything: 17 types (task, note, journal,
  habit, event, finance, contact, idea, goal, document, bookmark, milestone,
  routine, symptom, medication, affirmation, vision). Type-specific fields live
  in a JSON string `metadata`.
- **8 life domains**: Mind & Soul, Time & Action, Health & Body, Wealth &
  Career, Network, Growth, Creativity & Joy, Admin. Every item can belong to a
  domain and a project ("thread").
- **Every item has `energy`** (none / low / medium / high) and `priority` 0–4,
  plus `status` inbox / active / done / archived / snoozed.
- **Bi-directional links** between any two items (related, blocks, parent,
  subtask, references, depends-on), shown as a force-directed graph.
- **Reviews**: daily / weekly / monthly with wins, challenges, learnings,
  gratitude, priorities, mood 1–5, energy 1–5.
- **Inbox-first capture**: ⌘K opens Quick Capture; Enter sends to Inbox,
  ⌘Enter creates it active, number keys 1–6 switch type. Process later.
- **Smart Inbox (optional AI)**: sends up to 20 inbox items to an LLM
  (Z.AI or any OpenAI-compatible endpoint), which suggests type, domain and
  project with a reason.
- **Focus view**: Pomodoro 25 / 5 / 15 (and custom), Web Audio chime, link
  the session to a task or a habit; finishing a session **auto-logs the habit**.
- **Sanctuary**: box breathing 4-4-6-2 with an animated circle, a daily
  affirmation, your "visions", recent reflections.
- **Dashboard widgets**: inbox / due today / overdue / active projects pills,
  today's focus (overdue, today, coming up), habits this week, life balance per
  domain, a reflection nudge ("it's been N days"), weekly income vs expenses,
  mood check-in, "on this day", reconnect with contacts, reading list, bucket
  list, idea vault, shopping list, subscriptions, health snapshot.
- **Contacts with cadence**: each relationship type has a reconnect interval
  (default 45 days); "Reconnect" lists who is overdue.
- **Master calendar with layers** (tasks, bills, appointments, birthdays) and
  a weekly agenda.
- **Insights**: mood and energy trend (30 days), activity created vs completed,
  habit consistency matrix (14 days), monthly finances, savings goals,
  project health (done / total, overdue).
- **Scheduler** (run on demand): rolls recurring bills forward, resets habit
  streaks after 2 missed days.
- **Security & data**: session auth, optional TOTP 2FA, QR login on another
  device, backup / restore, CSV export, PWA, browser notifications for overdue
  tasks, keyboard shortcuts (⌘K, ⌘P, `/`, `?`, G-then-D/I/C/A).

## Where Life OS is already ahead

| Area | Theirs | Ours |
|---|---|---|
| Accounts & privacy | One user; queries have no user filter (the AI route reads *all* items) | Multi-user, Postgres row-level security on every table |
| Offline & phone | PWA shell only | Offline cache + queued writes, native Android app with notifications, Health Connect |
| Money | Items with an amount in JSON | Real accounts, pockets, payday "left to spend", recurring costs, resources and tariffs |
| Health | Symptom / medication items | Sleep, steps, heart rate, weight, medication schedules with doses, food and calories |
| Faith | — | Prayer times, statuses (jamaah, on time, clutch, late, missed), Jumu'ah, reminders |
| Honesty | Streaks that reset to 0, coloured good/bad | No streaks, no scores; counts of what you logged |
| Data shape | JSON strings, no validation | Typed columns with check constraints |

## Take it and make it better (ADHD first)

Status: ✅ done · 🔨 building · ⏳ planned

| Their idea | Our better version | Size | Status |
|---|---|---|---|
| Energy on every item | Energy on tasks **and a "match my energy" switch on Today**: say how you feel (low / medium / high) and Today shows what fits. No guilt for low days | M | ⏳ |
| Mood check-in | Two taps on Today (mood 1–5 + energy 1–5), stored in the daily review, trend in Insights next to sleep, so patterns are visible without judgement | S | 🔨 |
| Sanctuary breathing | "Reset" button anywhere: 1 minute of breathing (4-4-6-2), haptic on the phone, no content to read | S | 🔨 |
| On this day | Diary pages and reviews from the same date in earlier years, on Today | S | 🔨 |
| Reflection nudge | "Last review 5 days ago" as a quiet line, never a red alert | S | 🔨 |
| Pomodoro + habit auto-log | Our Time tracker gains Focus mode (25/5/15 or custom). Finishing ticks the linked habit **and** logs the minutes to the task, so time and habits agree | M | ⏳ |
| Inbox-first capture | One capture box that understands what you typed: "120 lunch" → spending, "remind me 5pm call bank" → reminder, "- a - b - c" → several tasks, anything else → inbox. Process later in an Inbox view | M | ⏳ |
| Weekly review | Weekly review with a maintenance checklist computed from real data: inbox left, overdue tasks, bills due before payday, projects with no open task; then 3 priorities for next week | M | ⏳ |
| Master calendar layers | Layers for tasks, recurring bills, reminders, prayer times, events, meter/quota run-out dates | M | ⏳ |
| Contacts & reconnect | People (family first): birthdays, "reconnect every N days", gift ideas; ties into the shared family calendar later | L | ⏳ |
| Links / graph | Keep derived links (project ↔ goals ↔ tasks) and add "related" on notes; skip the graph view (low value on a phone) | M | ⏳ |
| Keyboard shortcuts | G-then-letter navigation and a `?` cheat sheet on desktop; Ctrl/Cmd+K search already exists | S | ⏳ |
| 2FA | Supabase TOTP multi-factor in Settings | M | ⏳ |
| Backup / restore | Excel export done; add a restore from our own export | L | ⏳ |
| Smart inbox AI | Only after a privacy decision; if yes, on-device first, else a per-user server call with explicit consent | L | ⏳ decision |
| Reading / bucket / idea / shopping lists | Note templates with a label (no new tables) | S | ⏳ |
| Subscriptions overview | Monthly total of recurring costs on Money | S | 🔨 |
| Symptoms | Symptom log with severity next to medication | M | ⏳ |

## What we deliberately don't take

- **Streak resets** after missed days: shame loops are the opposite of what an
  ADHD-friendly app should do.
- **Good/bad colours** on mood and energy (their low mood is red): ours stay
  neutral, labels carry meaning.
- **One JSON blob per item**: typed columns keep money and health figures
  trustworthy.

Related: [[Original plan vs today]] · [[Ideas backlog]]
