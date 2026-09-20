import { describe, expect, it } from "vitest";

import {
  dateOrderProblem,
  estimateInUnit,
  estimateLabel,
  estimateToMinutes,
  notStartedYet,
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
