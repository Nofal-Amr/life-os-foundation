# Life OS roadmap

- [x] Technical audit of the foundation
- [x] Database schema (14 tables, enums, indexes, triggers)
- [x] Row Level Security: owner-only policies on every table
- [x] Email/password auth + password reset + profile trigger
- [x] Protected layout, sidebar + mobile navigation
- [x] Dashboard, Projects, Tasks, Habits, Goals, Notes, Calendar, Daily Review
- [x] Unified shared layout: Today now uses the standard sidebar, mobile header and bottom navigation
- [x] Theme switch available from every page in the desktop and mobile shared layout
- [x] Shared searchable icon and colour identity for projects, goals, capabilities, habits, accounts and money categories
- [x] Gain-framed habit history with no streaks or loss-framed language
- [x] Calm warm-neutral visual direction
- [x] Executive dashboard restyle with persisted light/dark theme
- [x] Daily Today screen: prayers, next tasks, money, upcoming commitments, health, quick logs, and gain-framed activity from real rows
- [x] Day-first date and date-time entry controls across tasks, projects, goals, finance, calendar, review and settings
- [x] Optional private project cover images with stable fallbacks to each project's icon and colour
- [x] Dashboard responsive overflow fixed across mobile, intermediate desktop, and wide screens
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
- [x] Expected net pay and safety buffer editable directly from the Money overview
- [x] Searchable ISO currency choice with Egypt and regional currencies prioritised
- [x] Fast transaction capture and editing can create and auto-select a category inline
- [x] Flexible recurring schedules from daily upward, with legacy fields kept in sync
- [x] Money displays omit trailing zero decimals while amount entry remains precise to two decimals

## Latest pass

- [x] Sign out and account details available from the mobile navigation
- [x] Money menu collapsed until you open it
- [x] Whole money amounts show no decimals, fractional ones always two
- [x] Date fields follow your own date format everywhere
- [x] Estimated money left before payday, with a tap-through breakdown from Money and Today
- [x] Calendar shows events, task due dates, projects, goals, projected recurring costs and health logs, with filters
- [x] Account pockets: cash and bank inside one account, with nested balances
- [x] Resources: meter and quota readings with real usage, cost and projections
- [x] Food: personal food library, fast logging and plain daily totals
- [x] Today shows calories logged, quota warnings and this cycle's meter cost
- [x] Icon picker rebuilt as a scrollable grid with about 190 grouped icons

## Consolidated navigation

- [x] Five primary destinations everywhere: Today, Do, Money, Body and Spirit
- [x] Do groups Tasks, Projects, Goals, Habits and Capabilities with consistent tabs
- [x] Money groups Overview, Transactions, Recurring, Categories and Resources with consistent tabs
- [x] Body groups Health, medications and Food with consistent tabs
- [x] Calendar, Notes and Daily Review remain available from a collapsed Tools menu; Settings is available from the profile block
- [x] Today covers Spirit, Do, Money, Body and Coming up from real rows, following the saved dimension order
- [x] Coming up includes overdue and near-term tasks, projects, goals, recurring costs and quota projections
- [x] Duplicate floating add controls removed; pages retain one primary add action

## Today status strip

- [x] Today's medication doses can be tapped taken or clear straight from Today, like prayers
- [x] Each dose shows the medicine name, dose and its time, with a Taken / Not taken label
- [x] Unlabelled arrows replaced with plain links that say where they go
- [x] Status rows land on the exact thing: today's log, medications, Food, Money, Resources, Spirit

## Today layout in three zones

- [x] One small greeting line; Calendar and Notes moved to the quiet bottom of the page
- [x] Next action stays the anchor, with a smaller, quieter "Also today" beneath it
- [x] Status and Quick logs merged into one "Today" block; every row acts on itself
- [x] Rows with nothing logged shrink to one short muted line with a single action
- [x] Prayers first, then the rest in your saved order of priorities
- [x] Coming up and Today so far combined into one small footer section
- [x] Coming up separates things you do from things that just happen
- [x] Small dots beside prayers and medication, matching the count written in words
- [x] Money shows a labelled split of committed, buffer and left to spend, plus the payday line
- [x] Money figure and countdown no longer cut off



## Next actions and task steps

- [x] Tasks can hold one level of steps: add by typing and pressing Enter, rename, reorder, complete, delete
- [x] Task list shows parent tasks with a quiet "2 of 5 steps done" line you can expand
- [x] Completing the last step asks whether to close the task; it never decides for you
- [x] Optional minute estimates shown as "· 5 min" on tasks and steps
- [x] "This feels hard" on every task: one question, starter suggestions, saves one small first step
- [x] Moving a due date later is recorded quietly; after three moves one calm factual line appears
- [x] Today leads with a single next action (the first open step when a task has steps) plus at most two more
- [x] Module cards replaced by a one-line status strip: prayers with inline logging, money left before payday, calories, health, medication, resources
