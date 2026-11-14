import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { DAY_ORDER } from "./spirit";

const dir = join(process.cwd(), "supabase", "migrations");

/** The prayer names allowed by the newest migration that sets prayer_logs' name check. */
function allowedNames(): string[] {
  const latest = readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => readFileSync(join(dir, name), "utf8"))
    .filter((sql) => /ADD CONSTRAINT prayer_logs_prayer_name_check/i.test(sql))
    .pop();
  const list = latest?.match(/prayer_logs_prayer_name_check\s+CHECK \(prayer_name IN \(([^)]*)\)/i);
  return (list?.[1] ?? "").split(",").map((part) => part.trim().replace(/'/g, ""));
}

// Every prayer the app lets you log must be accepted by the database, or saving it fails.
describe("prayer names in the database", () => {
  it("accept every prayer in the day's order", () => {
    expect(DAY_ORDER.filter((name) => !allowedNames().includes(name))).toEqual([]);
  });
});
