# Corrective quality pass

## Goal
Finish the remaining display and input corrections without rebuilding working features or changing existing data relationships, authentication, or table schema.

## Changes

### 1. Money display and editing
- Keep the shared money formatter at 0–2 displayed decimal places and extend its tests to cover whole, one-decimal, trailing-zero, two-decimal, signed, and currency values.
- Audit every displayed balance, transaction, recurring cost, budget, pay figure, and account amount so it uses the shared formatter.
- Preserve two-decimal amount entry and edit behavior, including transaction edits and other money forms.

### 2. Project cover images
- Use the existing nullable `projects.image_url` field; do not add or alter table columns.
- Add a private project-images storage bucket with owner-only file access, matching the existing avatar privacy model. This is storage configuration and access policy only, not a project-table migration.
- Add reusable project-cover upload, signed display URL, replace, and remove behavior with image validation, stable aspect ratios, loading/error fallback, and no broken-image icon.
- Keep image selection optional and retain each project’s icon and colour as the fallback identity.
- Show covers on the project’s substantial cards; compact task selectors, chips, and Today links continue using the icon/colour identity.

### 3. Consistent day-first date controls
- Add shared accessible date and date-time picker controls using the existing calendar UI, with visible `dd/mm/yyyy` dates and pointer-safe popovers.
- Replace every native date control found in Tasks, Goals, Projects, transaction filters/editing, recurring costs, Calendar events, Daily Review, and Settings.
- Preserve stored `yyyy-MM-dd` dates and existing local date-time conversion behavior so sorting, recurrence, and timezone handling do not change.
- Keep existing display preferences for read-only dates; date-entry controls themselves remain consistently day-first.

### 4. Focused page audit and corrections
- Inspect Today, Projects, Tasks, Habits, Goals, Capabilities, Notes, Calendar, Daily Review, Health, Spirit, all Money pages, Settings, and authentication at mobile, approximately 1150px, and desktop widths.
- Correct only observed issues: overflow, missing `min-w-0`, unstable grids, wrapping, unreadable theme states, inconsistent forms, weak empty states, duplicate controls, and isolated raw controls where a shared component exists.
- Verify shared navigation reaches every route and remains the only navigation/theme system.
- Verify the icon/colour picker and neutral fallbacks across project, goal, capability, habit, account, and category forms and their lists, cards, selectors, chips, Today references, and transaction/task relations.
- Remove any remaining XP, streak, loss-framed, fake-analysis, theatrical, or unsupported achievement language. Keep habits factual: entries logged, logged today, and recent activity.

### 5. Today screen safeguards
- Preserve the existing order: prayers, up to three next tasks, Money, Coming up, Health, Quick logs, Today so far.
- Confirm the zero-task state still leaves prayer, money/setup, upcoming, health, and quick-log value visible.
- Recheck all figures against current rows and derived calculations, and preserve `dimension_order` sorting for Coming up.

### 6. Type and compatibility audit
- Reconcile the generated database types with the current live schema, including icon/colour fields, `projects.image_url`, and recurring interval fields.
- Do not create duplicate columns or table migrations.
- Preserve null compatibility for all existing records and re-run recurrence helper tests.

## Verification
- Run focused unit tests for money formatting, date conversion, and recurrence advancement.
- Run TypeScript checks and the production build.
- Use an authenticated browser session to exercise modified create/edit flows, project cover upload/display/remove, two-decimal money editing, and every replaced date picker.
- Visit every major route in light and dark themes at 390px, about 1150px, and 1440px; check overflow, clipping, navigation, dialogs, empty/populated states, console errors, and broken images.
- Confirm no native date-entry UI remains, no visible `mm/dd/yyyy` remains in app-controlled date entry, and all Money routes remain reachable.
- Update `roadmap.md` only with work actually completed and verified.
