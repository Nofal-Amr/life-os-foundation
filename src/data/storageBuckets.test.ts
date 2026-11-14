import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { ACCEPTED_PROJECT_COVER_TYPES, MAX_PROJECT_COVER_BYTES } from "./projects";

const dir = join(process.cwd(), "supabase", "migrations");
const sql = readdirSync(dir)
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => readFileSync(join(dir, name), "utf8"))
  .join("\n");

// Security audit M1: project covers must not be readable without signing in, and the server must
// enforce the same limits the app shows.
describe("project-images bucket", () => {
  const statement = sql
    .split(";")
    .find(
      (part) =>
        /insert into storage\.buckets/i.test(part) && /values\s*\(\s*'project-images'/i.test(part),
    );

  it("is declared in a migration", () => {
    expect(statement).toBeDefined();
  });

  it("is private", () => {
    expect(statement).toMatch(/'project-images',\s*'project-images',\s*false/);
    expect(statement).toMatch(/public = excluded\.public/);
  });

  it("enforces the app's size and type limits", () => {
    expect(statement).toContain(String(MAX_PROJECT_COVER_BYTES));
    for (const type of ACCEPTED_PROJECT_COVER_TYPES) expect(statement).toContain(`'${type}'`);
  });
});
