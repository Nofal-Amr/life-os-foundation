# Finance module for Life OS

A money area that answers one question at a glance: how much can I spend before payday. Everything comes from what you actually enter — no sample figures, no advice, no scores.

## What you'll get

**Finance page** (new item in the navigation)
- One big number at the top: total liquid balance across your active non-credit accounts.
- A calm status line underneath: "You have X to spend before payday", or if your committed costs are bigger than what's available, "Committed costs exceed available funds before payday by X". Factual wording, no alarm styling.
- Payday countdown: days remaining and the date. If you haven't set a payday, a single "Set up payday" button appears instead — no invented dates.
- Accounts list with balances worked out live from your opening balance plus every transaction.
- Upcoming recurring costs, each with one-tap **Log** (creates the real transaction and moves the due date forward) and **Skip** (just moves the date forward).
- Recent transactions grouped by date, with a full list, filters and editing.
- A quick-add money button on the Finance page and on the Dashboard.

**Fast money entry** — amount and category in the fewest taps: the amount field is focused immediately, your last-used account and category are pre-selected, and your most-used categories appear as one-tap chips. Expense/income chosen with a two-way toggle; the sign is always shown with a text label ("out"/"in"), never colour alone.

**Categories** — add, edit and remove expense and income categories with an optional monthly budget and a colour. On your first visit with no categories, you'll be offered a starter set (Groceries, Rent, Transport, Eating out, Utilities, Subscriptions, Health, Salary) to accept, edit or delete. These are empty labels only — no amounts.

**Recurring costs** — manage the name, amount, frequency, category, account and next due date; log or skip each one.

**Settings → Finance** — payday (day of the month), expected net amount, safety buffer, and your currency. All start empty; the countdown and the before-payday figure show a setup prompt until you fill them in.

Empty states everywhere say nothing is logged yet. Both light and dark themes.

## Assumption to confirm

There is no currency setting in your preferences yet, and I won't guess one. I'll add a currency field to the Settings → Finance section; until you pick one, amounts show as plain numbers with no symbol, formatted with your existing number/date preferences.

## Technical notes

1. **Types**: the live database already types all five finance tables and the enums in `src/integrations/supabase/types.ts` — verified against the live schema, so no regeneration is needed. No table is created, altered or dropped.
2. **Idempotent migration**: one new migration file mirroring the live finance schema — `create type ... exception when duplicate_object` DO blocks for the five enums, `create table if not exists` for the five tables, GRANTs, `alter table ... enable row level security`, `drop policy if exists` + `create policy` for owner-only CRUD on each, and `drop trigger if exists` + `create trigger` for `set_updated_at`. Adds the single nullable `currency` column to `user_preferences` with `add column if not exists`. Safe to re-run against the existing objects.
3. **Data layer** `src/data/finance.ts`: typed rows, `queryOptions` per table (`accountsQuery`, `financeCategoriesQuery`, `transactionsQuery`, `recurringCostsQuery`, `paydayConfigQuery`), CRUD helpers deriving `user_id` from the session via `currentUserId()`, plus pure helpers: `accountBalance(account, transactions)`, `liquidBalance`, `nextPayday(config)`, `advanceDate(date, frequency)`, `availableBeforePayday(...)`, `logRecurringCost(cost)` (insert signed negative transaction + advance `next_due_date` in one flow), `skipRecurringCost(cost)`, `seedStarterCategories()`.
4. **Money formatting** in `src/lib/format.ts`: `formatMoney(value, prefs)` using `Intl.NumberFormat` with the stored currency code when present, plain grouped decimals when not; `formatSignedMoney` returns amount plus an "in"/"out" label. `usePreferences` exposes `fmtMoney`/`fmtSignedMoney` and `currency`; `src/data/preferences.ts` gains `currency` in `PreferencesInput`.
5. **Routes**: `src/routes/_authenticated/finance.tsx` (overview + transactions + accounts, tabbed), `finance.categories.tsx`? — no: a single `finance.tsx` page with sections plus `finance.transactions.tsx`, `finance.categories.tsx`, `finance.recurring.tsx` leaf routes, and `finance.tsx` becoming a layout with `finance.index.tsx` holding the overview. Each leaf gets its own `head()` metadata. Nav link added to `NAV_ITEMS`.
6. **Components**: `src/components/app/QuickAddTransaction.tsx` following the existing `QuickAddTask` dialog/FAB pattern; reuse `PageHeader`, `FormDialog`, `ConfirmDialog`, `EmptyState`/`LoadingState`/`ErrorState`, `SemanticBadge`. `src/lib/semantics.ts` gains `transactionKindTone`/label and a tone for the before-payday status (`positive` when funds remain, `warning` when committed costs exceed them — never `danger`).
7. **Dashboard**: add a quick-add money action alongside the existing quick-add task; no other dashboard changes.
8. **Delete guards**: deleting an account with transactions warns with the count in `ConfirmDialog`; deleting a category warns that linked transactions keep their amount but lose the category.
9. `roadmap.md`: correct the table count (14 tables) and add a Finance section.
