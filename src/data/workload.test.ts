import { describe, expect, it } from "vitest";

import type { Task } from "./tasks";
import { todayWorkload } from "./workload";

const TODAY = "2026-11-16";
let next = 0;
const task = (patch: Partial<Task>): Task =>
  ({
    id: `t${next++}`,
    status: "todo",
    due_date: TODAY,
    start_date: null,
    parent_task_id: null,
    estimated_minutes: null,
    ...patch,
  }) as Task;

describe("todayWorkload", () => {
  it("adds up the open work due today and names what has no time", () => {
    const load = todayWorkload(
      [
        task({ estimated_minutes: 60 }),
        task({ estimated_minutes: 90 }),
        task({}),
        task({ status: "completed", estimated_minutes: 120 }),
        task({ due_date: "2026-11-17", estimated_minutes: 120 }),
      ],
      TODAY,
      new Date(2026, 10, 16, 14, 0),
    );
    expect(load).toEqual({ count: 3, minutes: 150, untimed: 1, leftMinutes: 600, over: false });
  });

  it("counts a split task through its open steps only", () => {
    const parent = task({ id: "parent", estimated_minutes: 240 });
    const load = todayWorkload(
      [
        parent,
        task({ parent_task_id: "parent", estimated_minutes: 60 }),
        task({ parent_task_id: "parent", due_date: "2026-11-17", estimated_minutes: 60 }),
      ],
      TODAY,
      new Date(2026, 10, 16, 9, 0),
    );
    expect([load.count, load.minutes]).toEqual([1, 60]);
  });

  it("leaves out work that hasn't started yet", () => {
    const load = todayWorkload(
      [task({ start_date: "2026-11-20", estimated_minutes: 60 })],
      TODAY,
      new Date(2026, 10, 16, 9, 0),
    );
    expect(load.count).toBe(0);
  });

  it("says when the typed times alone are more than the time left today", () => {
    const load = todayWorkload(
      [task({ estimated_minutes: 180 }), task({ estimated_minutes: 120 })],
      TODAY,
      new Date(2026, 10, 16, 20, 30),
    );
    expect([load.minutes, load.leftMinutes, load.over]).toEqual([300, 210, true]);
  });
});
