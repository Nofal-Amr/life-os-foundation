import { describe, expect, it } from "vitest";

import { parseCapture } from "./capture";

// A Thursday.
const today = new Date(2026, 9, 8, 10);

describe("parseCapture", () => {
  it("reads spending either way round", () => {
    expect(parseCapture("120 lunch", today)).toEqual({
      kind: "spending",
      amount: 120,
      note: "lunch",
    });
    expect(parseCapture("taxi 85.5", today)).toEqual({
      kind: "spending",
      amount: 85.5,
      note: "taxi",
    });
    expect(parseCapture("45", today)).toEqual({ kind: "spending", amount: 45, note: "" });
    expect(parseCapture("١٢٠ فطار", today)).toEqual({
      kind: "spending",
      amount: 120,
      note: "فطار",
    });
  });

  it("reads income with a plus", () => {
    expect(parseCapture("+500 bonus", today)).toEqual({
      kind: "income",
      amount: 500,
      note: "bonus",
    });
    expect(parseCapture("bonus +500", today)).toEqual({
      kind: "income",
      amount: 500,
      note: "bonus",
    });
  });

  it("makes everything else a task, with a due day if one is said", () => {
    expect(parseCapture("call mom", today)).toEqual({ kind: "task", title: "call mom", due: null });
    expect(parseCapture("call mom tomorrow", today)).toEqual({
      kind: "task",
      title: "call mom",
      due: "2026-10-09",
    });
    expect(parseCapture("pay rent sunday", today)).toEqual({
      kind: "task",
      title: "pay rent",
      due: "2026-10-11",
    });
    expect(parseCapture("اتصل بماما بكرة", today)).toEqual({
      kind: "task",
      title: "اتصل بماما",
      due: "2026-10-09",
    });
  });

  it("doesn't take times or numbered things as money", () => {
    expect(parseCapture("5 pm meeting", today)?.kind).toBe("task");
    expect(parseCapture("meet at 5", today)?.kind).toBe("task");
  });

  it("ignores empty input", () => {
    expect(parseCapture("   ", today)).toBeNull();
  });
});
