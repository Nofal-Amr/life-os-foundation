import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dir = join(process.cwd(), "supabase", "migrations");
const files = readdirSync(dir).filter((name) => name.endsWith(".sql"));

// Supabase records each migration by the number before the first underscore. Two files with
// the same number collide when they are applied, so every number must be unique.
describe("database migrations", () => {
  it("each file starts with a version number", () => {
    expect(files.filter((name) => !/^\d{14}_[a-z0-9_-]+\.sql$/.test(name))).toEqual([]);
  });

  it("no two files share a version number", () => {
    const seen = new Map<string, string[]>();
    for (const name of files) {
      const version = name.split("_")[0]!;
      seen.set(version, [...(seen.get(version) ?? []), name]);
    }
    expect([...seen.values()].filter((names) => names.length > 1)).toEqual([]);
  });
});
