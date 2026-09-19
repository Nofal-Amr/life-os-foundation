# Combined Life OS interface pass

## Goal
Unify the app around one reliable shared layout, add expressive but consistent entity identity, improve money capture and recurring schedules, and keep Today focused on real daily value.

## 1. Shared layout and navigation
- Remove the Dashboard exception so every signed-in page uses the same sidebar, mobile header, content bounds, and bottom navigation.
- Move the persisted light/dark switch into the shared layout for desktop and mobile; remove Dashboard’s duplicate header switch and floating navigation.
- Keep the main mobile destinations in the bottom bar and expose every remaining route through the mobile menu. Add direct Money links for Overview, Transactions, Recurring costs, and Categories in shared navigation.
- Audit page shells, grids, list rows, text containers, and fixed quick-add controls with `minmax(0,1fr)`, `min-w-0`, and viewport-safe offsets so nothing clips at mobile, approximately 1150px, or desktop widths.

## 2. Shared icon and colour language
- Use the live generated database types for the existing `icon` and `color` fields; no schema migration.
- Build one reusable searchable Lucide icon picker with a curated set spanning work, study, home, money, health, food, travel, fitness, technology, hobbies, and family.
- Build the colour choice into the same control using a small semantic preset palette that works in light and dark themes. Store the selected icon name and colour value; validate unknown saved values and render a neutral fallback icon.
- Add the picker to create/edit flows for projects, goals, capabilities, habits, accounts, and money categories, including inline-created items where applicable.
- Render the identity consistently in entity lists, relevant headings/cards, Today task context, task relationship choices/chips, transaction category chips/rows, account rows, and recurring-cost context.
- Remove the existing visible habit streak and streak metadata copy so the app remains gain-framed and compliant with the permanent no-streak rule.

## 3. Money controls and formatting
- Add inline editing for expected net pay and safety buffer on Money Overview, using the same payday record as Settings and refreshing the availability figure immediately after save.
- Add an inline “New category” flow inside fast money capture and transaction editing; create, refresh, and auto-select the category without leaving the form.
- Put EGP first in the suggested currencies, add KWD, QAR, BHD, OMR, JOD, MAD, TND, and DZD, and replace the closed selector with a searchable ISO 4217 currency field that also accepts a valid three-letter code outside the suggestions.
- Validate custom currency codes with `Intl.NumberFormat`; keep plain-number mode available.
- Display money with zero to two decimals, preserving two digits only when a fractional amount exists. Keep `0.00` guidance, `step="0.01"`, and exact two-decimal editing behavior in amount-entry and transaction-edit fields.

## 4. Flexible recurring costs
- Use the live typed `interval_count`, `interval_unit`, and `next_due_at` fields; no database changes.
- Replace fixed frequency selection with “Every [N] [day/week/month/year]”, excluding hours.
- On create/edit, write the custom interval fields and keep legacy `frequency`, `next_due_date`, and `next_due_at` synchronized for existing readers and rows.
- Advance Log and Skip by `interval_count × interval_unit`; Log still creates exactly one signed expense transaction first, while Skip creates none.
- Update recurring labels, sorting, forecasting, and Today’s coming-up calculation to use the synchronized due date safely for old and new rows.

## 5. Today inside the shared layout
- Retain and refine the existing real-data Today implementation rather than reintroducing executive-system theatre.
- Remove its duplicate wordmark/avatar/theme/navigation shell and fit its content inside the shared page width.
- Keep the requested order: prayers first; up to three priority-ranked open tasks; liquid balance and payday; dimension-ordered coming-up items; today’s health state; compact quick logs; gain-framed “Today so far”.
- Preserve one-tap prayer logging with On time/Later, missing-setup prompts, quick task and expense dialogs, medication visibility, and neutral zero-data states.
- Show saved entity icons/colours only where they add context, without bars, invented scores, or implied analysis.

## 6. Verification and roadmap
- Confirm generated types match the live fields before implementation and avoid migrations.
- Add focused tests for money formatting, ISO currency validation, custom interval advancement, and legacy interval compatibility.
- Run the project typecheck/build and inspect the latest preview error log.
- Test authenticated interactions in both themes at mobile, about 1150px, and desktop: shared navigation, every Money destination, theme switching from non-Dashboard pages, dialogs, inline creation, recurring Log/Skip, and horizontal overflow.
- Update `roadmap.md` with the unified layout, icon/colour system, money improvements, flexible recurrence, Today integration, and no-streak cleanup.

## Technical notes
- Existing row ownership and session-derived writes remain unchanged.
- New reusable presentation pieces will live with the existing shared app controls; entity data modules will accept only the new live fields.
- Fixed quick-add controls will share viewport-safe positioning above the mobile bottom bar and avoid stacking collisions.
- Colour remains paired with names/status text and never carries meaning alone.
