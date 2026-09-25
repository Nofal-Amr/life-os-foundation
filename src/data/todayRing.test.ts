import { describe, expect, it } from "vitest";

import { ringArcs, todayRing } from "./todayRing";

const today = "2026-09-25";

describe("todayRing", () => {
  it("counts tasks due today or earlier plus those finished today", () => {
    const [tasks] = todayRing({
      today,
      tasks: [
        { status: "todo", due_date: "2026-09-25", completed_at: null, parent_task_id: null },
        { status: "todo", due_date: "2026-09-20", completed_at: null, parent_task_id: null },
        { status: "todo", due_date: "2026-09-30", completed_at: null, parent_task_id: null },
        { status: "todo", due_date: null, completed_at: null, parent_task_id: null },
        {
          status: "completed",
          due_date: null,
          completed_at: "2026-09-25T09:00:00Z",
          parent_task_id: null,
        },
        {
          status: "completed",
          due_date: "2026-09-24",
          completed_at: "2026-09-24T09:00:00Z",
          parent_task_id: null,
        },
        { status: "todo", due_date: "2026-09-25", completed_at: null, parent_task_id: "p" },
      ],
    });
    expect(tasks).toMatchObject({ key: "tasks", done: 1, total: 3 });
  });

  it("uses daily habits only, and leaves out areas with nothing planned", () => {
    const segments = todayRing({
      today,
      habits: [
        { id: "walk", active: true, frequency: "daily" },
        { id: "read", active: true, frequency: "daily" },
        { id: "gym", active: true, frequency: "weekly" },
        { id: "old", active: false, frequency: "daily" },
      ],
      habitLogs: [{ habit_id: "walk", log_date: today }],
      doses: { scheduled: 0, taken: 0 },
      prayersLogged: 3,
    });
    expect(segments.map((s) => [s.key, s.done, s.total])).toEqual([
      ["habits", 1, 2],
      ["prayers", 3, 5],
    ]);
  });
});

describe("ringArcs", () => {
  it("gives each area an equal share and fills it by its fraction", () => {
    const arcs = ringArcs(
      [
        { key: "tasks", label: "Tasks", done: 1, total: 2, to: "/tasks" },
        { key: "prayers", label: "Prayers", done: 5, total: 5, to: "/spirit" },
      ],
      10,
    );
    expect(arcs[0]).toMatchObject({ start: 5, end: 175, filledEnd: 90 });
    expect(arcs[1]).toMatchObject({ start: 185, end: 355, filledEnd: 355 });
  });

  it("uses the whole circle for a single area", () => {
    const [only] = ringArcs([{ key: "habits", label: "Habits", done: 0, total: 3, to: "/habits" }]);
    expect(only).toMatchObject({ start: 0, end: 360, filledEnd: 0 });
  });
});
