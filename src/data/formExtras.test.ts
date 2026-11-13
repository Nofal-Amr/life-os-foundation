import { describe, expect, it } from "vitest";

import { habitExtrasSet, projectExtrasSet, taskExtrasSet } from "./formExtras";

describe("taskExtrasSet", () => {
  it("is 0 for a new task with only the defaults", () => {
    expect(
      taskExtrasSet({
        description: null,
        status: "inbox",
        priority: "medium",
        start_date: null,
        max_date: null,
        capability_id: null,
        goal_id: null,
        estimated_minutes: null,
      }),
    ).toBe(0);
  });

  it("counts every folded field that holds something", () => {
    expect(
      taskExtrasSet({
        description: "Bring the receipt",
        status: "in_progress",
        priority: "high",
        start_date: "2026-11-13",
        due_time: "09:00",
        energy: "low",
        repeat: "weekly",
        max_date: "2026-11-20",
        estimated_minutes: 30,
        capability_id: "c1",
        goal_id: "g1",
      }),
    ).toBe(11);
  });

  it("does not count empty text or the to-do status", () => {
    expect(taskExtrasSet({ description: "", status: "todo" })).toBe(0);
  });
});

describe("habitExtrasSet", () => {
  it("is 0 for a daily habit done once, active", () => {
    expect(habitExtrasSet({ frequency: "daily", target: 1, active: true })).toBe(0);
  });

  it("counts identity, rhythm and a paused habit", () => {
    expect(
      habitExtrasSet({
        icon: "book",
        color: "#22aa88",
        frequency: "weekly",
        target: 3,
        description: "Before bed",
        active: false,
      }),
    ).toBe(6);
  });
});

describe("projectExtrasSet", () => {
  it("is 0 for a new project", () => {
    expect(projectExtrasSet({ status: "planning", priority: "medium" })).toBe(0);
  });

  it("counts dates, cover and identity", () => {
    expect(
      projectExtrasSet({
        due_date: "2026-12-01",
        start_date: "2026-11-13",
        image_url: "covers/a.jpg",
        icon: "rocket",
        status: "active",
      }),
    ).toBe(5);
  });
});
