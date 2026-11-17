Decided 2026-10-08 by the owner:

- Auto spending: read only notifications from bank/wallet apps the user ticks (NotificationListener), confirm each ("Log 250 EGP?"). Owner explicitly asked that OTPs are never read: drop anything with OTP/code/verification/رمز/كود, require amount+currency+spend word, never store raw text.
- Photo reading (meters, odometer, receipts): on-device only (free, offline); user always confirms the number.
- Watch: Wear OS only (Galaxy Watch 4+); skip Tizen and Apple Watch for now.
- Student/enterprise: modes inside the one app; Student mode built now (timetable, courses, assignments, exams); enterprise is a vision doc only for later.
- Also requested same day: azkar sabah/masaa with counts as reminders + loggable, electronic tasbih, Qibla finder that works held upright (camera/AR like Google's), Arabic language support.

**Why:** owner answered these directly; they set scope for the next builds.
**How to apply:** don't re-ask these; see [core-rules](core-rules.md) for data rules.

More decisions 2026-10-08:

- Gaming mode: "honest game layer" — RPG stays an opt-in skin; add achievements, titles, daily/weekly quests, projects as bosses (HP from real tasks), streak shields, level-up moment, gold from real actions spent in a shop of user-defined rewards. NO random loot, NO estimated energy/focus meters.
- Friends/family sharing: build now (shared calendar + shared lists via 6-letter invite code; careful RLS).
- AI assistant: on-device only (no server/Claude API).
- "Workday cost" = cost of going to work (fuel, transport, food out on workdays), per day and per month.
- Life Connect SMS: forward one-time codes by default, with a switch to keep them on the SIM phone.
