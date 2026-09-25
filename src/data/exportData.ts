/**
 * Everything you've logged, as one Excel file: a sheet per area. Rows come
 * straight from your own tables (row-level security returns only yours);
 * ids that point at another row also get a readable name column beside them.
 */
import { supabase } from "@/integrations/supabase/client";
import { buildXlsx, type Cell, type Sheet } from "@/lib/xlsx";

type Row = Record<string, unknown>;

/** Sheet name, table, and "id column → table whose name to show". */
const TABLES: { sheet: string; table: string; names?: Record<string, string> }[] = [
  { sheet: "Tasks", table: "tasks", names: { project_id: "projects", goal_id: "goals" } },
  { sheet: "Projects", table: "projects" },
  { sheet: "Goals", table: "goals" },
  { sheet: "Habits", table: "habits" },
  { sheet: "Habit log", table: "habit_logs", names: { habit_id: "habits" } },
  {
    sheet: "Transactions",
    table: "transactions",
    names: { account_id: "accounts", category_id: "finance_categories" },
  },
  { sheet: "Accounts", table: "accounts" },
  { sheet: "Pockets", table: "account_pockets", names: { account_id: "accounts" } },
  { sheet: "Categories", table: "finance_categories" },
  { sheet: "Recurring costs", table: "recurring_costs" },
  { sheet: "Resources", table: "resources" },
  { sheet: "Readings", table: "resource_readings", names: { resource_id: "resources" } },
  { sheet: "Food log", table: "food_logs" },
  { sheet: "Foods", table: "foods" },
  { sheet: "Health log", table: "health_logs" },
  { sheet: "Health samples", table: "health_samples" },
  { sheet: "Body", table: "body_stats" },
  { sheet: "Medications", table: "medications" },
  { sheet: "Doses", table: "medication_logs", names: { medication_id: "medications" } },
  { sheet: "Prayers", table: "prayer_logs" },
  { sheet: "Time", table: "time_entries", names: { activity_id: "activities", task_id: "tasks" } },
  { sheet: "Activities", table: "activities" },
  { sheet: "Calendar", table: "events" },
  { sheet: "Notes", table: "notes" },
  { sheet: "Daily reviews", table: "daily_reviews" },
  { sheet: "Capabilities", table: "capabilities" },
  { sheet: "Evidence", table: "evidence" },
];

/** Columns that are bookkeeping, not your data. */
const HIDDEN = new Set(["user_id"]);

/** A row's display name, whichever column the table uses for it. */
function nameOf(row: Row | undefined): string | null {
  if (!row) return null;
  for (const key of ["name", "title", "label"]) {
    if (typeof row[key] === "string" && row[key]) return row[key] as string;
  }
  return null;
}

export function toCell(value: unknown): Cell {
  if (value == null) return null;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

/** Rows of one table as a sheet: a header row, then values in the same order. */
export function toSheet(
  name: string,
  rows: Row[],
  lookups: Record<string, Map<string, string | null>> = {},
): Sheet {
  const columns: string[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!HIDDEN.has(key) && !columns.includes(key)) columns.push(key);
    }
  }
  // "project_id" gets a "project" column right after it.
  const header: string[] = [];
  for (const column of columns) {
    header.push(column);
    if (lookups[column]) header.push(column.replace(/_id$/, ""));
  }
  const body = rows.map((row) => {
    const cells: Cell[] = [];
    for (const column of columns) {
      cells.push(toCell(row[column]));
      const lookup = lookups[column];
      if (lookup) cells.push(lookup.get(String(row[column] ?? "")) ?? null);
    }
    return cells;
  });
  return { name, rows: [header, ...body] };
}

async function allRows(table: string): Promise<Row[]> {
  const page = 1000;
  const rows: Row[] = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from(table as never)
      .select("*")
      .range(from, from + page - 1);
    if (error) {
      // A table this account doesn't have yet is skipped, not fatal.
      if (/does not exist|schema cache/i.test(error.message)) return rows;
      throw error;
    }
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < page) return rows;
  }
}

/** Builds the workbook. Needs a connection: it reads fresh from the server. */
export async function exportEverything(): Promise<{ bytes: Uint8Array; rows: number }> {
  const cache = new Map<string, Row[]>();
  const load = async (table: string) => {
    if (!cache.has(table)) cache.set(table, await allRows(table));
    return cache.get(table)!;
  };

  const sheets: Sheet[] = [];
  let total = 0;
  for (const spec of TABLES) {
    const rows = await load(spec.table);
    if (!rows.length) continue;
    const lookups: Record<string, Map<string, string | null>> = {};
    for (const [column, other] of Object.entries(spec.names ?? {})) {
      const related = await load(other);
      lookups[column] = new Map(related.map((row) => [String(row["id"]), nameOf(row)]));
    }
    sheets.push(toSheet(spec.sheet, rows, lookups));
    total += rows.length;
  }
  return { bytes: buildXlsx(sheets), rows: total };
}

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
