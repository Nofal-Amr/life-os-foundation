# Life OS roadmap

- [x] Technical audit of the foundation
- [x] Database schema (14 tables, enums, indexes, triggers)
- [x] Row Level Security: owner-only policies on every table
- [x] Email/password auth + password reset + profile trigger
- [x] Protected layout, sidebar + mobile navigation
- [x] Dashboard, Projects, Tasks, Habits, Goals, Notes, Calendar, Daily Review
- [x] Calm warm-neutral visual direction
- [x] Executive dashboard restyle with persisted light/dark theme
- [x] Inline project and capability creation in the task form
- [x] Confirm email/password sign-in is switched on in the connected backend's Auth settings
- [x] Life-hub data foundation: body stats, health logs, medications, prayer logs/settings, preferences, avatar storage
- [x] Profile & Settings page (display name, avatar, dimension priority, theme)
- [x] Spirit page (prayer times, logging, weekly count)
- [x] Health page (body stats + BMI, daily log, medications)

- [x] Forms no longer reload over what you are typing (health weight + daily log)
- [x] Robust location: permission, timeout, embedded-preview handling, city search, saved place name
- [x] One-time setup moved into Settings (prayer, body, units/time/date formats)
- [x] Date navigation on Spirit and Health, no future dates
- [x] Compact one-tap prayer logging with on-time/later toggle
- [x] Edit + delete for Capabilities, Goals and Projects, with linked-item warnings and capability evidence view
- [x] Goal on tasks with inline "+ New goal"
- [x] "Inbox" now reads "Unsorted" (stored value unchanged)
- [x] One colour language for priority, status, overdue and 1-5 scales, always with text labels
- [x] Quick-add task button on the main pages and the dashboard

## Finance

- [x] Money tables kept in sync in the repo with a re-runnable migration (accounts, categories, transactions, recurring costs, payday config)
- [x] Currency choice added to preferences; money figures follow it, plain numbers until one is chosen
- [x] Money overview: total liquid balance as the one glanceable number, with a factual line about what is free to spend before payday
- [x] Payday countdown from your own setup, with a "Set up payday" prompt until you enter it
- [x] Accounts with balances always worked out from opening balance plus what you log; add, edit, delete with a warning when transactions exist
- [x] Fast money logging: amount, one-tap category chips, last-used account, from the Money pages and the dashboard
- [x] Transactions grouped by date with filters by account, category and date range, plus edit and delete
- [x] Categories you own, with optional monthly budgets and an accept-or-edit starter set of empty labels
- [x] Recurring costs as projections only, with one-tap Log (creates a real transaction and rolls the date) and Skip
- [x] Money setup in Settings: pay day of the month, expected net pay, safety buffer, currency
