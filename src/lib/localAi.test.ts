import { describe, expect, it } from "vitest";

import { parseList } from "./localAi";

describe("parseList", () => {
  it("cleans numbered and bulleted replies", () => {
    const reply =
      "Here are the steps:\n1. Open the laptop.\n2) **Find** the form\n- Fill in your name\n• Fill in your name\nStep 5: Press send";
    expect(parseList(reply)).toEqual([
      "Open the laptop",
      "Find the form",
      "Fill in your name",
      "Press send",
    ]);
  });

  it("keeps to the limit and skips empty lines", () => {
    expect(parseList("1. a\n\n2. b\n3. c", 2)).toEqual(["a", "b"]);
    expect(parseList("")).toEqual([]);
  });
});
