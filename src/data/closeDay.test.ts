import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { carryOver, isEvening, nextDay } from "@/data/closeDay";
import type { Task } from "@/data/tasks";

const task = (over: Partial<Task>): Task =>
  ({
    id: "t",
    title: "T",
    status: "todo",
    due_date: null,
    due_time: null,
    parent_task_id: null,
    ...over,
  }) as Task;

describe("closing the day", () => {
  it("keeps open, top-level tasks dated today or earlier, oldest first", () => {
    const tasks = [
      task({ id: "today-late", due_date: "2026-11-17", due_time: "20:00" }),
      task({ id: "today-early", due_date: "2026-11-17", due_time: "09:00" }),
      task({ id: "older", due_date: "2026-11-10" }),
      task({ id: "tomorrow", due_date: "2026-11-18" }),
      task({ id: "undated" }),
      task({ id: "done", due_date: "2026-11-17", status: "completed" }),
      task({ id: "step", due_date: "2026-11-17", parent_task_id: "older" }),
    ];
    expect(carryOver(tasks, "2026-11-17").map((t) => t.id)).toEqual([
      "older",
      "today-early",
      "today-late",
    ]);
  });

  it("knows the next day across a month end", () => {
    expect(nextDay("2026-11-30")).toBe("2026-12-01");
  });

  it("treats 6 pm onwards as evening", () => {
    expect(isEvening(new Date(2026, 10, 17, 17, 59))).toBe(false);
    expect(isEvening(new Date(2026, 10, 17, 18, 0))).toBe(true);
  });
});
