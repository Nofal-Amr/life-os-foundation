import { describe, expect, it } from "vitest";

import { toPoints } from "./notes";

describe("toPoints", () => {
  it("makes one point per sentence and line", () => {
    expect(toPoints("work was too much today. the bus was late!\nneed to sleep earlier")).toEqual([
      "Work was too much today",
      "The bus was late!",
      "Need to sleep earlier",
    ]);
  });

  it("is the same when run on its own output", () => {
    const once = toPoints("First thing. Second thing; third thing");
    expect(toPoints(once.map((point) => `• ${point}`).join("\n"))).toEqual(once);
  });

  it("splits Arabic sentences too", () => {
    expect(toPoints("اليوم كان طويل؟ لازم أنام بدري")).toEqual([
      "اليوم كان طويل؟",
      "لازم أنام بدري",
    ]);
  });

  it("ignores empty text", () => {
    expect(toPoints("  \n\n ")).toEqual([]);
  });
});
