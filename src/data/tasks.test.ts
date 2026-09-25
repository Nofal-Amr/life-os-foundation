import { describe, expect, it } from "vitest";

import {
  dateOrderProblem,
  energyCapacity,
  estimateInUnit,
  estimateLabel,
  estimateToMinutes,
  fitsEnergy,
  nextRepeatDate,
  notStartedYet,
  splitTaskLines,
  type Task,
} from "./tasks";

describe("task estimates", () => {
  it("stores the canonical minutes for the unit chosen", () => {
    expect(estimateToMinutes(45, "minutes")).toBe(45);
    expect(estimateToMinutes(2, "hours")).toBe(120);
    expect(estimateToMinutes(3, "days")).toBe(4320);
    expect(estimateToMinutes(null, "hours")).toBeNull();
  });

  it("reads back in the unit chosen, not converted", () => {
    expect(estimateInUnit(120, "hours")).toBe(2);
    expect(estimateLabel({ estimated_minutes: 120, estimate_unit: "hours" })).toBe("2 h");
    expect(estimateLabel({ estimated_minutes: 4320, estimate_unit: "days" })).toBe("3 d");
    expect(estimateLabel({ estimated_minutes: 45, estimate_unit: "minutes" })).toBe("45 min");
    expect(estimateLabel({ estimated_minutes: null, estimate_unit: "hours" })).toBe("");
  });
});

describe("task dates", () => {
  it("accepts start ≤ due ≤ max", () => {
    expect(
      dateOrderProblem({ start_date: "2026-01-01", due_date: "2026-01-05", max_date: "2026-01-09" }),
    ).toBeNull();
  });

  it("reports an order problem instead of correcting it", () => {
    expect(dateOrderProblem({ start_date: "2026-01-06", due_date: "2026-01-05" })).toContain(
      "Start date",
    );
    expect(dateOrderProblem({ due_date: "2026-01-10", max_date: "2026-01-09" })).toContain(
      "Due date",
    );
  });

  it("treats a future start date as not started yet", () => {
    const task = { start_date: "2026-05-02" } as Task;
    expect(notStartedYet(task, "2026-05-01")).toBe(true);
    expect(notStartedYet(task, "2026-05-02")).toBe(false);
    expect(notStartedYet({ start_date: null } as Task, "2026-05-01")).toBe(false);
  });
});

describe("splitTaskLines", () => {
  it("makes one task per line", () => {
    expect(splitTaskLines("Call mum\nBuy milk\n\nPay the bill")).toEqual([
      "Call mum",
      "Buy milk",
      "Pay the bill",
    ]);
  });

  it("drops bullets and numbering from a pasted list", () => {
    expect(splitTaskLines("- Call mum\n2. Buy milk\n• Pay the bill")).toEqual([
      "Call mum",
      "Buy milk",
      "Pay the bill",
    ]);
  });

  it("keeps a dash that is part of the task", () => {
    expect(splitTaskLines("Email Sam - about the flat")).toEqual(["Email Sam - about the flat"]);
  });

  it("is empty for nothing typed and stops at the limit", () => {
    expect(splitTaskLines("   \n\n")).toEqual([]);
    const many = Array.from({ length: 60 }, (_, i) => `Task ${i}`).join("\n");
    expect(splitTaskLines(many).length).toBe(50);
  });
});

describe("nextRepeatDate", () => {
  it("moves by day, week and month", () => {
    expect(nextRepeatDate("2026-09-25", "daily")).toBe("2026-09-26");
    expect(nextRepeatDate("2026-09-25", "weekly")).toBe("2026-10-02");
    expect(nextRepeatDate("2026-09-25", "monthly")).toBe("2026-10-25");
  });

  it("keeps month ends in range", () => {
    expect(nextRepeatDate("2026-01-31", "monthly")).toBe("2026-02-28");
    expect(nextRepeatDate("2028-01-31", "monthly")).toBe("2028-02-29");
  });

  it("skips Friday and Saturday for weekdays", () => {
    // 24 Sep 2026 is a Thursday.
    expect(nextRepeatDate("2026-09-24", "weekdays")).toBe("2026-09-27");
  });
});

describe("energy matching", () => {
  it("turns a check-in into what you can take on", () => {
    expect([1, 2, 3, 4, 5].map((value) => energyCapacity(value))).toEqual([1, 1, 2, 3, 3]);
    expect(energyCapacity(null)).toBeNull();
  });

  it("fits tasks at or under your energy, and tasks with none set", () => {
    expect(fitsEnergy({ energy: 3 }, 1)).toBe(false);
    expect(fitsEnergy({ energy: 1 }, 1)).toBe(true);
    expect(fitsEnergy({ energy: null }, 1)).toBe(true);
    expect(fitsEnergy({ energy: 3 }, null)).toBe(true);
  });
});
