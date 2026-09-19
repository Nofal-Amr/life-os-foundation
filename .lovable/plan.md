# Five-destination consolidation

## Goal
Make Life OS learnable around five primary places—Today, Do, Money, Body, and Spirit—without removing features, changing stored data, or breaking existing URLs.

## Navigation and grouping
- Replace the current destination list in the desktop sidebar, mobile menu, and bottom bar with exactly five primary links: Today (`/dashboard`), Do (`/tasks`), Money (`/finance`), Body (`/health`), and Spirit (`/spirit`).
- Add one shared, horizontally scrollable section-tab pattern:
  - Do: Tasks, Projects, Goals, Habits, Capabilities.
  - Money: Overview, Transactions, Recurring, Categories, Resources.
  - Body: Health, Food.
- Keep every existing route and bookmark working. The primary links land on the most-used page in each section; existing child URLs remain their own pages under the matching tabs.
- Put Calendar, Notes, and Daily Review in a collapsed secondary Tools disclosure. Put Settings behind the signed-in avatar/profile block. Keep disclosures collapsed by default unless the current page belongs to them.
- Use the same navigation model in the desktop sidebar and mobile sheet; keep the mobile bottom bar to the five labeled destinations only.

## Today
- Keep prayer logging high and compact.
- Present the daily areas in the user’s saved dimension order, mapping Spirit, Do, Money, and Body to the closest saved life dimension while preserving stable fallback ordering.
- Do shows the top three open tasks and a factual overdue count.
- Money keeps liquid balance, payday, and the real tap-through availability breakdown.
- Body shows today’s health status, calories, and scheduled medication state.
- Coming up combines due-soon tasks, projects, goals, recurring costs due by payday, and quota projections, with each row linking to its source.
- Every empty section gets one neutral sentence and one direct action. Quick logs and Today so far remain at the end.

## Consistency and complexity
- Reuse the shared page header, section tabs, dialogs, buttons, states, and identity visuals.
- Remove duplicate floating add controls where a page header already supplies the same primary action, leaving one clear add action per page.
- Keep primary views concise; existing advanced fields remain in edit dialogs.
- Preserve light/dark tokens and mobile-safe overflow behavior.

## Verification
- Confirm all prior destinations remain reachable: Today, Tasks, Projects, Goals, Habits, Capabilities/Evidence, Money Overview, Transactions, Recurring Costs, Categories, Resources, Health, Food, Spirit, Calendar, Notes, Daily Review, and Settings.
- Run existing tests, inspect the latest build diagnostics, and exercise the five destinations plus tabs/tools/profile access at mobile, about 1150px, and desktop in both themes.
- Update `roadmap.md` with the completed information-architecture pass.

## Technical notes
- No database migration or generated-type change is expected because this pass only reorganizes existing routes and presentation.
- Existing route files and URLs remain authoritative; shared tabs group them visually rather than moving or deleting routes.
