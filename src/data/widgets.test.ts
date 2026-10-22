import { describe, expect, it } from "vitest";

import { widgetNextAction } from "./widgets";
import type { Task } from "./tasks";

const task = (title: string, extra: Partial<Task> = {}) =>
  ({ id: title, title, status: "todo", parent_task_id: null, due_date: null, due_time: null, priority: "medium", ...extra }) as Task;

describe("widgetNextAction", () => {
  it("picks overdue first, then today, then the soonest upcoming", () => {
    const today = "2026-10-22";
    expect(
      widgetNextAction([task("Later", { due_date: "2026-10-25" }), task("Late", { due_date: "2026-10-19" })], today),
    ).toEqual({ next: "Late", nextDetail: "3 days late" });
    expect(widgetNextAction([task("Now", { due_date: today, due_time: "11:00:00" })], today)).toEqual({
      next: "Now",
      nextDetail: "Due today · 11:00",
    });
    expect(widgetNextAction([task("Soon", { due_date: "2026-10-24" })], today)).toEqual({
      next: "Soon",
      nextDetail: "In 2 days",
    });
  });

  it("skips steps and finished tasks, and says so when there is nothing", () => {
    const today = "2026-10-22";
    expect(
      widgetNextAction([task("Done", { status: "completed", due_date: today }), task("Step", { parent_task_id: "x", due_date: today })], today),
    ).toEqual({ next: "Nothing to do right now", nextDetail: "Open Life OS to add a task" });
  });
});
