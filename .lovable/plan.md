# Today dashboard

## What will change
- Replace the current dashboard with a daily “Today” screen using only saved data.
- Remove System Observation, Capability Readout, directive language, rationale/stakes language, capability progress, and the old floating dashboard controls.
- Keep the page useful even with no tasks by always showing prayer, money, and quick-log access.

## Screen structure
1. Keep the compact Life OS header, today’s date, greeting, avatar, and theme switch.
2. Show today’s five prayers near the top with saved-location prayer times, one-tap prayed/unprayed logging, and the existing On time/Later choices. If prayer setup is missing, show the existing Settings action instead of invented times.
3. Show “Next up” with the highest-priority open task and no more than two additional tasks, plus quick task capture. Selection remains deterministic from due date and priority, without implying analysis.
4. Show Money with the real derived liquid balance and configured payday countdown. If payday is not configured, show “Set up payday”.
5. Show one combined “Coming up” list for tasks due today/tomorrow, recurring costs due by payday, and today’s untaken scheduled medication entries.
6. Show today’s Health log state with a one-tap path to enter or update it.
7. Add a compact Quick logs row for prayer, expense, health, and task actions.
8. End with “Today so far”, counting only today’s completed tasks, logged prayers, expenses, and health entry. Show “Nothing logged yet today” when every count is zero.

## Priority order
- Preserve the required answers-first sequence above.
- Use `dimension_order` to sort items inside “Coming up” by their life dimension, then by date/time. This keeps the daily anchor order stable while respecting the user’s saved priorities where mixed life areas meet.

## Interaction and presentation
- Reuse the current prayer, task, money, health, preference, formatting, badge, dialog, button, card, loading, and error patterns.
- Keep all numbers derived from existing rows; no analysis copy, scores, streaks, penalties, advice, or failure tallies.
- Use calm gain-framed copy, accessible labels and tap targets, design tokens, and both themes.
- Replace fixed dashboard action buttons with in-flow actions, constrain every grid/text column with `minmax(0,1fr)` / `min-w-0`, and test mobile plus the reported ~1150px width.

## Verification
- Check type/build diagnostics after implementation.
- Test the rendered dashboard at mobile, 1150px, and desktop widths, including overflow and reachable actions.
- Update `roadmap.md` with the completed Today dashboard work.
