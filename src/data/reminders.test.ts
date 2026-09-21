import { describe, expect, it } from "vitest";

import { taskReminders } from "./reminders";
import type { Task } from "./tasks";

const task = (title: string, due: string, extra: Partial<Task> = {}) =>
  ({ id: title, title, due_date: due, status: "todo", parent_task_id: null, ...extra }) as Task;

describe("task reminders", () => {
  const today = "2026-09-21";
  const morning = new Date("2026-09-21T07:00:00").getTime();

  it("sends one summary per day with something due, at the chosen time", () => {
    const reminders = taskReminders({
      tasks: [
        task("A", "2026-09-21"),
        task("B", "2026-09-23"),
        task("Done", "2026-09-23", { status: "completed" }),
      ],
      today,
      time: "09:00",
      now: morning,
    });
    expect(reminders.map((r) => r.id)).toEqual(["tasks-2026-09-21", "tasks-2026-09-23"]);
    expect(reminders[0]!.at).toBe(new Date("2026-09-21T09:00:00").getTime());
    expect(reminders[1]!.title).toBe("1 task due today");
    expect(reminders[1]!.channel).toBe("tasks");
  });

  it("includes overdue tasks in today's summary and names at most three", () => {
    const reminders = taskReminders({
      tasks: ["A", "B", "C", "D"].map((t) => task(t, "2026-09-19")),
      today,
      time: "09:00",
      now: morning,
    });
    expect(reminders[0]!.title).toBe("4 tasks due today");
    expect(reminders[0]!.body).toBe("A, B, C and 1 more.");
  });

  it("skips a time that has already passed", () => {
    const evening = new Date("2026-09-21T20:00:00").getTime();
    expect(
      taskReminders({ tasks: [task("A", today)], today, time: "09:00", now: evening }),
    ).toEqual([]);
  });
});
