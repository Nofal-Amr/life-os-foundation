# Dashboard System Restyle and Task Inline Creation

## What will change

- Restyle only `/dashboard` as a premium executive briefing using real tasks, projects, goals, capabilities, evidence, profile, and account data.
- Add a persisted light/dark theme toggle. Light remains the default; semantic global colors adapt so existing pages stay readable without changing their layouts.
- Add inline “New project” and “New capability” flows inside the existing task form, creating and selecting each item without closing the form.

## Dashboard structure

- Header with LIFE OS status, greeting, date, profile avatar, and sun/moon toggle.
- Primary Directive from the highest-priority incomplete task, ordered by due date then priority; optional project, goal, rationale, and due-based stakes only when real data exists.
- Honest System Observation empty state with no generated analysis.
- Capability Readout from the capability with the highest real evidence count.
- Up Next queue from the next 2–3 incomplete tasks.
- Dashboard-only four-item floating navigation dock using existing destinations.
- Calm empty states when required data is absent.

## Technical details

- Define light and dark semantic tokens in the existing global stylesheet and load Inter through document head links.
- Persist the theme in local storage and apply it to the document root after hydration, with accessible toggle labeling and reduced-motion support.
- Keep database schema, authentication, RLS, routes, and existing page structure unchanged.
- Reuse existing project/capability creation functions and invalidate their query caches after inline creation.
- Verify the dashboard at desktop and mobile sizes, toggle persistence, real-data rendering, inline creation behavior, and current build/runtime diagnostics.
