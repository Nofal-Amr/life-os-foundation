import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { orderRows, ownRows, readBackup } from "./backup";

describe("backup", () => {
  it("accepts only Life OS backup files", () => {
    expect(readBackup("not json")).toBe("That isn't a Life OS backup file.");
    expect(readBackup(JSON.stringify({ app: "other" }))).toBe("That isn't a Life OS backup file.");
    const ok = readBackup(
      JSON.stringify({ app: "life-os", version: 1, createdAt: "x", tables: {} }),
    );
    expect(typeof ok).toBe("object");
  });

  it("puts rows into the signed-in account", () => {
    expect(ownRows([{ id: "a", user_id: "old" }], "me")).toEqual([{ id: "a", user_id: "me" }]);
    expect(ownRows([{ id: "old", user_id: "x", name: "n" }], "me", "user_id")).toEqual([
      { user_id: "me", name: "n" },
    ]);
  });

  it("restores parent tasks before their steps", () => {
    const rows = [
      { id: "step", parent_task_id: "parent" },
      { id: "parent", parent_task_id: null },
    ];
    expect(orderRows("tasks", rows).map((row) => row["id"])).toEqual(["parent", "step"]);
  });
});
