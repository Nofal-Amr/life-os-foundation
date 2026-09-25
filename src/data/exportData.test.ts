import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { toCell, toSheet } from "./exportData";

describe("toSheet", () => {
  it("drops user_id and adds a name column after each linked id", () => {
    const sheet = toSheet(
      "Tasks",
      [
        { id: "t1", user_id: "u", title: "Call", project_id: "p1", tags: ["a"] },
        { id: "t2", user_id: "u", title: "Pay", project_id: null },
      ],
      { project_id: new Map([["p1", "Home"]]) },
    );
    expect(sheet.rows).toEqual([
      ["id", "title", "project_id", "project", "tags"],
      ["t1", "Call", "p1", "Home", '["a"]'],
      ["t2", "Pay", null, null, null],
    ]);
  });

  it("keeps numbers and booleans as they are", () => {
    expect(toCell(12.5)).toBe(12.5);
    expect(toCell(false)).toBe(false);
    expect(toCell({ a: 1 })).toBe('{"a":1}');
  });
});
