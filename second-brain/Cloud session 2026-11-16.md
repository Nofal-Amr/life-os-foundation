---
tags: [handoff, cloud]
updated: 2026-11-17
---

# Cloud session, 2026-11-16

A Claude session in the cloud built these and they were merged into `main` on 2026-11-16. The website
has them; the phone apps only get them when the APK is rebuilt (see [[Handoff - next session]]).

| PR | What |
|---|---|
| #49 | **Work → Sheets → From WhatsApp**: paste or pick an exported group chat; match senders to members, tick days, save. Reads copied messages without a year, Android/iPhone exports, Arabic digits and ص/م. "in"/"out" count only as the whole message. |
| #50 | Both WhatsApp features are **test options per company**, off by default (Work → Rules → Test options). The second one offers "Post in WhatsApp: In 08:31" after a clock-in/out (opens `wa.me` with the text; the person picks the group). |
| #51 | **Goals → plan steps**: one step per line with an optional time ("Read chapter 1 · 45m"); spread over 7-day blocks up to the goal's date (or 12 weeks); each step becomes a task linked to the goal. Optional hours a week says plainly when it won't fit. |
| #52 | **Today**: under Next action, "Due today: 4 tasks · about 3 h 30 estimated". If that's more than the time left today, it says so and links "Choose what moves". Facts only. |
| #53 | **Work late rules**: a tolerance (minutes) per step; a ladder can end in a whole day and start again (ADO: 120, 150, 180, day, repeat). |
| #54 | **Body → Gym**: log workouts (exercise, sets of weight × reps), "Last time" per exercise, history, heaviest set per exercise. No scores. **Needs migration `20261116120000_gym.sql`: not applied** (checked 2026-11-17; tables `workouts`/`workout_sets` don't exist). Waits for the owner's OK. |
| #55 | **ADO rules**: after 10:00 is a day's penalty outside the ladder; a day's penalty is 5% of base salary; on such a day the whole time from clock-in to clock-out counts as overtime (a rule, off for companies saved before). |
