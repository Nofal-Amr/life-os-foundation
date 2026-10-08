/**
 * A full backup of your Life OS as one file, and putting it back.
 *
 * Backup: every row of your own tables (row-level security returns only
 * yours), as JSON. Restore: rows are written back by their id, so restoring
 * the same file twice changes nothing, and anything deleted since comes
 * back. Rows always land in the account that's signed in. Shared spaces
 * (Together) aren't included — they belong to everyone in them.
 */
import { supabase } from "@/integrations/supabase/client";
import { currentUserId } from "@/lib/supabase-helpers";

type Row = Record<string, unknown>;

/** Restore order: rows that others point at come first. */
export const BACKUP_TABLES: { table: string; key?: string }[] = [
  { table: "profiles", key: "user_id" },
  { table: "user_preferences", key: "user_id" },
  { table: "payday_config", key: "user_id" },
  { table: "prayer_settings", key: "user_id" },
  { table: "accounts" },
  { table: "account_pockets" },
  { table: "finance_categories" },
  { table: "recurring_costs" },
  { table: "transactions" },
  { table: "capabilities" },
  { table: "goals" },
  { table: "projects" },
  { table: "tasks" },
  { table: "habits" },
  { table: "habit_logs" },
  { table: "resources" },
  { table: "resource_readings" },
  { table: "fuel_fillups" },
  { table: "foods" },
  { table: "food_logs" },
  { table: "health_logs" },
  { table: "health_samples" },
  { table: "body_stats" },
  { table: "medications" },
  { table: "medication_logs" },
  { table: "prayer_logs" },
  { table: "dhikr_logs" },
  { table: "activities" },
  { table: "time_entries" },
  { table: "events" },
  { table: "notes" },
  { table: "daily_reviews" },
  { table: "evidence" },
  { table: "reminders" },
  { table: "courses" },
  { table: "class_sessions" },
  { table: "study_items" },
  { table: "rpg_rewards" },
  { table: "rpg_purchases" },
];

export type Backup = {
  app: "life-os";
  version: 1;
  createdAt: string;
  tables: Record<string, Row[]>;
};

async function readAll(table: string): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from(table as never)
      .select("*")
      .range(from, from + 999);
    if (error) {
      // A table this database doesn't have (yet) is skipped, not fatal.
      if (error.code === "42P01" || error.code === "PGRST205") return rows;
      throw new Error(`${table}: ${error.message}`);
    }
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < 1000) return rows;
  }
}

export async function createBackup(): Promise<{ backup: Backup; rows: number }> {
  const tables: Record<string, Row[]> = {};
  let rows = 0;
  for (const { table } of BACKUP_TABLES) {
    tables[table] = await readAll(table);
    rows += tables[table]!.length;
  }
  return {
    backup: { app: "life-os", version: 1, createdAt: new Date().toISOString(), tables },
    rows,
  };
}

/** Checks a file is a Life OS backup; returns it, or an error message. */
export function readBackup(text: string): Backup | string {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return "That isn't a Life OS backup file.";
  }
  const backup = value as Partial<Backup>;
  if (
    backup?.app !== "life-os" ||
    backup.version !== 1 ||
    typeof backup.tables !== "object" ||
    !backup.tables
  ) {
    return "That isn't a Life OS backup file.";
  }
  return backup as Backup;
}

/** Tasks that are steps of other tasks go after their parent task. */
export function orderRows(table: string, rows: Row[]): Row[] {
  if (table !== "tasks") return rows;
  return [...rows].sort(
    (a, b) => Number(a["parent_task_id"] != null) - Number(b["parent_task_id"] != null),
  );
}

/**
 * Rows for this account: any user_id becomes the signed-in one. One-per-account
 * tables (keyed by user_id) drop their own id so the existing row is updated.
 */
export function ownRows(rows: Row[], userId: string, key?: string): Row[] {
  return rows.map((row) => {
    const copy = { ...row };
    if ("user_id" in copy) copy["user_id"] = userId;
    if (key === "user_id") delete copy["id"];
    return copy;
  });
}

export async function restoreBackup(
  backup: Backup,
  onProgress?: (table: string) => void,
): Promise<{ rows: number; skipped: string[] }> {
  const userId = await currentUserId();
  let rows = 0;
  const skipped: string[] = [];
  for (const { table, key } of BACKUP_TABLES) {
    const list = backup.tables[table];
    if (!list?.length) continue;
    onProgress?.(table);
    const prepared = orderRows(table, ownRows(list, userId, key));
    for (let i = 0; i < prepared.length; i += 200) {
      const chunk = prepared.slice(i, i + 200);
      const { error } = await supabase
        .from(table as never)
        .upsert(chunk as never, { onConflict: key ?? "id" });
      if (error) {
        skipped.push(`${table}: ${error.message}`);
        break;
      }
      rows += chunk.length;
    }
  }
  return { rows, skipped };
}
