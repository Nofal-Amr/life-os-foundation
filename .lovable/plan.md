# Life OS — Foundation

A calm, minimal personal productivity app with accounts, private data, and eight core areas.

## What you'll get

- **Sign in / sign up** with email + password. Every person only ever sees their own data.
- **Persistent layout**: a slim sidebar on desktop, a bottom/slide-out navigation on mobile, with the current section highlighted.
- **Dashboard** — quick-add buttons, today's tasks and habits, and simple overview counts.
- **Projects** — planning, active, on hold, completed, archived; low/medium/high priority.
- **Tasks** — statuses and priorities, optional project link, filters for Today, Upcoming, Overdue, Inbox.
- **Habits** — daily or weekly habits with one-tap logging and streak count.
- **Goals** — status plus a progress number you can update.
- **Notes** — title, body, tags, and instant search.
- **Calendar** — month grid with add/edit/delete of events.
- **Daily Review** — a structured reflection form (wins, challenges, gratitude, mood, tomorrow's focus), one per day.

No sample data, no AI, no third-party services. Empty states guide first use.

## Design direction

Warm neutral background, single muted accent, generous spacing, small type scale, subtle borders instead of heavy shadows. Fully responsive.

## Technical outline

- Enable Lovable Cloud (auth + Postgres). Email/password auth turned on.
- Tables: `profiles`, `projects`, `tasks`, `habits`, `habit_logs`, `goals`, `notes`, `events`, `daily_reviews`. Each row carries `user_id`; RLS enabled with owner-only select/insert/update/delete policies plus explicit grants. Enum types for statuses and priorities. Trigger creates a profile on signup.
- Routes: public `/auth`; everything else under the protected `_authenticated` layout — `/dashboard`, `/projects`, `/tasks`, `/habits`, `/goals`, `/notes`, `/calendar`, `/review`. `/` redirects to the dashboard when signed in, otherwise to sign-in.
- Data access through authenticated server functions (`requireSupabaseAuth`) with TanStack Query for caching and optimistic-free simple invalidation.
- Shared UI: layout shell, page header, empty state, and form dialogs reused across sections.
- Per-page `head()` metadata with unique titles and descriptions.

## Out of scope for this pass

Sharing/collaboration, notifications, recurring tasks, file attachments, imports.
