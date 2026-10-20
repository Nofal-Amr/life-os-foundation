import { describe, expect, it } from "vitest";

import { stuckDetail, stuckTasks } from "./stuck";
import type { Task } from "./tasks";

const TODAY = "2026-10-21";

function task(overrides: Partial<Task>): Task {
  return {
    capability_id: null,
    completed_at: null,
    created_at: "2026-09-15T09:00:00Z",
    description: null,
    due_date: null,
    due_time: null,
    energy: null,
    estimate_unit: null,
    estimated_minutes: null,
    goal_id: null,
    id: "t1",
    last_postponed_at: null,
    max_date: null,
    original_due_date: null,
    parent_task_id: null,
    position: 0,
    postponed_count: 0,
    priority: "medium",
    project_id: null,
    repeat: null,
    start_date: null,
    status: "todo",
    title: "Send the kaitech report",
    updated_at: "2026-09-15T09:00:00Z",
    user_id: "u",
    ...overrides,
  } as Task;
}

describe("stuckTasks", () => {
  it("finds a month-old task nobody touched", () => {
    const [item] = stuckTasks([task({})], TODAY);
    expect(item?.days).toBe(36);
    expect(item?.reason).toBe("untouched");
    expect(stuckDetail(item!)).toBe("Not touched in a while");
  });

  it("leaves new, finished, waiting and moving tasks alone", () => {
    const tasks = [
      task({ id: "new", created_at: "2026-10-15T09:00:00Z", updated_at: "2026-10-15T09:00:00Z" }),
      task({ id: "done", status: "completed" }),
      task({ id: "waiting", status: "waiting" }),
      task({ id: "moving" }),
      task({
        id: "step",
        parent_task_id: "moving",
        status: "completed",
        completed_at: "2026-10-19T09:00:00Z",
      }),
    ];
    expect(stuckTasks(tasks, TODAY).map((item) => item.task.id)).toEqual([]);
  });

  it("counts a task moved again and again even if it was just edited", () => {
    const [item] = stuckTasks(
      [task({ postponed_count: 3, updated_at: "2026-10-20T09:00:00Z", due_date: "2026-10-25" })],
      TODAY,
    );
    expect(item?.reason).toBe("postponed");
    expect(stuckDetail(item!)).toBe("Moved 3 times");
  });

  it("counts a task a week past its date", () => {
    const [item] = stuckTasks(
      [task({ due_date: "2026-10-10", updated_at: "2026-10-18T09:00:00Z" })],
      TODAY,
    );
    expect(item?.reason).toBe("overdue");
  });

  it("puts the oldest first", () => {
    const tasks = [
      task({ id: "a", created_at: "2026-10-01T09:00:00Z", updated_at: "2026-10-01T09:00:00Z" }),
      task({ id: "b", created_at: "2026-08-01T09:00:00Z", updated_at: "2026-08-01T09:00:00Z" }),
    ];
    expect(stuckTasks(tasks, TODAY).map((item) => item.task.id)).toEqual(["b", "a"]);
  });
});
