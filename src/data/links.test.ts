import { describe, expect, it } from "vitest";

import type { Goal } from "./goals";
import { goalLinks, projectGoals, projectProgress } from "./links";
import type { Project } from "./projects";
import type { Task } from "./tasks";

const task = (id: string, extra: Partial<Task> = {}) =>
  ({
    id,
    title: id,
    status: "todo",
    parent_task_id: null,
    project_id: null,
    goal_id: null,
    due_date: null,
    ...extra,
  }) as Task;

const tasks = [
  task("a", { project_id: "p1", status: "completed", goal_id: "g1" }),
  task("b", { project_id: "p1", goal_id: "g1", due_date: "2026-10-02" }),
  task("c", { project_id: "p1" }),
  task("step", { project_id: "p1", parent_task_id: "b", status: "completed" }),
  task("x", { project_id: "p1", status: "cancelled" }),
  task("d", { goal_id: "g1", due_date: "2026-09-30" }),
  task("e", { project_id: "p2" }),
];
const projects = [{ id: "p1", name: "Site" }, { id: "p2", name: "Other" }] as Project[];
const goals = [{ id: "g1", name: "Freelance" }, { id: "g2", name: "Other" }] as Goal[];

describe("projectProgress", () => {
  it("counts top-level, non-cancelled tasks", () => {
    expect(projectProgress(tasks, "p1")).toEqual({ done: 1, total: 3 });
  });
  it("is empty for a project with no tasks", () => {
    expect(projectProgress(tasks, "none")).toEqual({ done: 0, total: 0 });
  });
});

describe("projectGoals", () => {
  it("finds goals through the project's tasks", () => {
    expect(projectGoals(tasks, goals, "p1").map((goal) => goal.id)).toEqual(["g1"]);
    expect(projectGoals(tasks, goals, "p2")).toEqual([]);
  });
});

describe("goalLinks", () => {
  it("collects linked tasks, projects and what is next", () => {
    const links = goalLinks(tasks, projects, "g1");
    expect(links.tasks).toEqual({ done: 1, total: 3 });
    expect(links.projects.map((item) => [item.project.id, item.progress])).toEqual([
      ["p1", { done: 1, total: 3 }],
    ]);
    expect(links.next.map((item) => item.id)).toEqual(["d", "b"]);
  });
});
