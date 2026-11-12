import { describe, expect, it } from "vitest";

import { appendLine, linesOf, reflectionCount, reflectionNotesOn } from "./reflections";

describe("appendLine", () => {
  it("adds a line under what's there", () => {
    expect(appendLine("Walked to work", "Finished the report")).toBe(
      "Walked to work\nFinished the report",
    );
  });
  it("starts the field when it's empty", () => {
    expect(appendLine(null, "  Called Mum ")).toBe("Called Mum");
    expect(appendLine("", "Called Mum")).toBe("Called Mum");
  });
});

describe("the compiled day", () => {
  const at = (h: number) => new Date(2026, 10, 12, h).toISOString();
  const notes = [
    { tags: ["idea"], created_at: at(9) },
    { tags: ["reflection"], created_at: at(21) },
    { tags: ["shopping"], created_at: at(10) },
    { tags: ["idea"], created_at: new Date(2026, 10, 11, 23).toISOString() },
  ];

  it("lists one reflection per line", () => {
    expect(linesOf("a\n\n b \n")).toEqual(["a", "b"]);
  });

  it("counts lines in the review plus that day's ideas and notes", () => {
    const review = { wins: "a\nb", challenges: "c", gratitude: null };
    expect(reflectionCount(review, notes, "2026-11-12")).toBe(5);
    expect(reflectionCount(null, [], "2026-11-12")).toBe(0);
  });

  it("keeps only reflection notes from that local day", () => {
    expect(reflectionNotesOn(notes, "2026-11-12")).toHaveLength(2);
  });
});
