import { describe, expect, it } from "vitest";

import type { CalendarEvent } from "./events";
import type { RecurringCost } from "./finance";
import type { Task } from "./tasks";
import { buildAhead, eventDay, planPatch, plannable } from "./weekAhead";

const task = (id: string, due: string | null, extra: Partial<Task> = {}) =>
  ({
    id,
    title: id,
    due_date: due,
    due_time: null,
    status: "todo",
    parent_task_id: null,
    created_at: "2026-11-01T00:00:00Z",
    ...extra,
  }) as Task;

const event = (id: string, start: Date) =>
  ({ id, title: id, start_at: start.toISOString(), end_at: null }) as CalendarEvent;

const bill = (id: string, due: string, active = true) =>
  ({ id, name: id, next_due_date: due, active, amount: 100 }) as unknown as RecurringCost;

const TODAY = "2026-11-13";

describe("buildAhead", () => {
  it("is seven days from the given day", () => {
    const days = buildAhead({ from: TODAY, today: TODAY, tasks: [], events: [], bills: [] });
    expect(days.map((day) => day.date)).toEqual([
      "2026-11-13",
      "2026-11-14",
      "2026-11-15",
      "2026-11-16",
      "2026-11-17",
      "2026-11-18",
      "2026-11-19",
    ]);
    expect(days[0]!.isToday).toBe(true);
    expect(days[1]!.isToday).toBe(false);
  });

  it("puts open tasks on their day, by time, and leaves done ones out", () => {
    const days = buildAhead({
      from: TODAY,
      today: TODAY,
      tasks: [
        task("late", "2026-11-15", { due_time: "18:00:00" }),
        task("early", "2026-11-15", { due_time: "08:00:00" }),
        task("done", "2026-11-15", { status: "completed" }),
        task("undated", null),
        task("next week", "2026-11-25"),
      ],
      events: [],
      bills: [],
    });
    expect(days[2]!.tasks.map((t) => t.id)).toEqual(["early", "late"]);
    expect(days.flatMap((day) => day.tasks).map((t) => t.id)).not.toContain("undated");
    expect(days.flatMap((day) => day.tasks).map((t) => t.id)).not.toContain("next week");
  });

  it("brings tasks from earlier onto today, first, and counts them", () => {
    const days = buildAhead({
      from: TODAY,
      today: TODAY,
      tasks: [task("today", TODAY), task("old", "2026-11-02")],
      events: [],
      bills: [],
    });
    expect(days[0]!.tasks.map((t) => t.id)).toEqual(["old", "today"]);
    expect(days[0]!.fromEarlier).toBe(1);
  });

  it("does not repeat tasks from earlier on a later week", () => {
    const days = buildAhead({
      from: "2026-11-20",
      today: TODAY,
      tasks: [task("old", "2026-11-02")],
      events: [],
      bills: [],
    });
    expect(days.flatMap((day) => day.tasks)).toEqual([]);
  });

  it("shows a dated step instead of its parent", () => {
    const days = buildAhead({
      from: TODAY,
      today: TODAY,
      tasks: [
        task("parent", "2026-11-16"),
        task("step", "2026-11-14", { parent_task_id: "parent" }),
      ],
      events: [],
      bills: [],
    });
    const ids = days.flatMap((day) => day.tasks).map((t) => t.id);
    expect(ids).toEqual(["step"]);
  });

  it("places events by their local start day, in order", () => {
    const a = event("lunch", new Date(2026, 10, 14, 13, 0));
    const b = event("call", new Date(2026, 10, 14, 9, 0));
    const days = buildAhead({ from: TODAY, today: TODAY, tasks: [], events: [a, b], bills: [] });
    expect(days[1]!.events.map((e) => e.id)).toEqual(["call", "lunch"]);
    expect(eventDay(a)).toBe("2026-11-14");
  });

  it("lists active bills on their next date, and leaves paused ones out", () => {
    const days = buildAhead({
      from: TODAY,
      today: TODAY,
      tasks: [],
      events: [],
      bills: [
        bill("rent", "2026-11-16"),
        bill("gym", "2026-11-16", false),
        bill("far", "2026-12-20"),
      ],
    });
    expect(days[3]!.bills.map((b) => b.id)).toEqual(["rent"]);
    expect(days.flatMap((day) => day.bills)).toHaveLength(1);
  });
});

describe("plannable", () => {
  it("offers unsorted tasks, oldest first, and ones due later than the day", () => {
    const { unsorted, upcoming } = plannable(
      [
        task("new", null, { created_at: "2026-11-10T00:00:00Z", status: "inbox" }),
        task("older", null, { created_at: "2026-11-01T00:00:00Z" }),
        task("later", "2026-11-20"),
        task("sooner", "2026-11-17"),
        task("same day", "2026-11-15"),
        task("earlier", "2026-11-14"),
        task("done", null, { status: "completed" }),
        task("step", null, { parent_task_id: "older" }),
      ],
      "2026-11-15",
    );
    expect(unsorted.map((t) => t.id)).toEqual(["older", "new"]);
    expect(upcoming.map((t) => t.id)).toEqual(["sooner", "later"]);
  });
});

describe("planPatch", () => {
  it("gives the day, and makes an inbox task a to-do", () => {
    expect(planPatch({ status: "inbox" }, "2026-11-15")).toEqual({
      due_date: "2026-11-15",
      status: "todo",
    });
    expect(planPatch({ status: "waiting" }, "2026-11-15")).toEqual({ due_date: "2026-11-15" });
  });
});
