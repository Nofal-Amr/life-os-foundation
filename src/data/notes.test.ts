import { describe, expect, it } from "vitest";

import { isLockedNote, toPoints } from "./notes";

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

describe("isLockedNote", () => {
  it("knows a note the Android app encrypted, and nothing else", () => {
    expect(isLockedNote({ body: "lifeos-vault:v1:abc.def" })).toBe(true);
    expect(isLockedNote({ body: "my lifeos-vault:v1: note" })).toBe(false);
    expect(isLockedNote({ body: null })).toBe(false);
  });
});
