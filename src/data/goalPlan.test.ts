import { describe, expect, it } from "vitest";

import { parseSteps, planGoal, readDuration, workLeft } from "./goalPlan";

describe("readDuration", () => {
  it("reads hours and minutes in English and Arabic", () => {
    expect(readDuration("45m")).toBe(45);
    expect(readDuration("45 min")).toBe(45);
    expect(readDuration("1h 30m")).toBe(90);
    expect(readDuration("1.5h")).toBe(90);
    expect(readDuration("2 hours")).toBe(120);
    expect(readDuration("٣٠ دقيقة")).toBe(30);
    expect(readDuration("ساعة")).toBeNull();
    expect(readDuration("chapter 3")).toBeNull();
    expect(readDuration("30h")).toBeNull();
  });
});

describe("parseSteps", () => {
  it("takes a time at the end of a line as the estimate", () => {
    expect(
      parseSteps(
        "- Read chapter 1 · 45m\n2. Practice set (1h 30m)\nBook the exam\nChapter 3 - 2h\n\nWrite summary 20 min",
      ),
    ).toEqual([
      { title: "Read chapter 1", minutes: 45 },
      { title: "Practice set", minutes: 90 },
      { title: "Book the exam", minutes: null },
      { title: "Chapter 3", minutes: 120 },
      { title: "Write summary", minutes: 20 },
    ]);
  });

  it("keeps numbers that are part of the title", () => {
    expect(parseSteps("Read chapter 12\nRun 5 km")).toEqual([
      { title: "Read chapter 12", minutes: null },
      { title: "Run 5 km", minutes: null },
    ]);
  });
});

const steps = (minutes: (number | null)[]) =>
  minutes.map((value, index) => ({ title: `Step ${index + 1}`, minutes: value }));

describe("planGoal", () => {
  it("spreads steps evenly over the weeks, in order", () => {
    const plan = planGoal({
      steps: steps([60, 60, 60, 60]),
      from: "2026-11-16",
      until: "2026-12-13",
    })!;
    expect(plan.weeks.map((week) => [week.start, week.end, week.steps, week.minutes])).toEqual([
      ["2026-11-16", "2026-11-22", 1, 60],
      ["2026-11-23", "2026-11-29", 1, 60],
      ["2026-11-30", "2026-12-06", 1, 60],
      ["2026-12-07", "2026-12-13", 1, 60],
    ]);
    expect(plan.steps.map((step) => [step.start, step.due])).toEqual([
      ["2026-11-16", "2026-11-22"],
      ["2026-11-23", "2026-11-29"],
      ["2026-11-30", "2026-12-06"],
      ["2026-12-07", "2026-12-13"],
    ]);
    expect(plan.totalMinutes).toBe(240);
    expect(plan.minutesPerWeek).toBe(60);
  });

  it("places each step in the week where the middle of its time falls", () => {
    // 360 min over 2 weeks: the long step's middle is at 180, the start of week 2.
    const plan = planGoal({
      steps: steps([30, 30, 240, 30, 30]),
      from: "2026-11-16",
      until: "2026-11-29",
    })!;
    expect(plan.steps.map((step) => step.week)).toEqual([0, 0, 1, 1, 1]);
    const spread = planGoal({
      steps: steps([30, 30, 30, 240]),
      from: "2026-11-16",
      until: "2026-11-29",
    })!;
    expect(spread.steps.map((step) => step.week)).toEqual([0, 0, 0, 1]);
  });

  it("counts steps without a time by count, and leaves them out of the totals", () => {
    const plan = planGoal({
      steps: steps([null, null, null, null]),
      from: "2026-11-16",
      until: "2026-11-29",
    })!;
    expect(plan.steps.map((step) => step.week)).toEqual([0, 0, 1, 1]);
    expect(plan.totalMinutes).toBe(0);
    expect(plan.untimed).toBe(4);
    expect(plan.minutesPerWeek).toBeNull();
    expect(plan.fits).toBeNull();
  });

  it("ends the last block on the goal's date", () => {
    const plan = planGoal({ steps: steps([60, 60]), from: "2026-11-16", until: "2026-11-25" })!;
    expect(plan.weeks.map((week) => [week.start, week.end])).toEqual([
      ["2026-11-16", "2026-11-22"],
      ["2026-11-23", "2026-11-25"],
    ]);
  });

  it("says when the steps need more hours a week than set, and when they'd end", () => {
    // 8 h over 2 weeks is 4 h a week; at 2 h a week it takes 4 weeks.
    const plan = planGoal({
      steps: steps([240, 240]),
      from: "2026-11-16",
      until: "2026-11-29",
      hoursPerWeek: 2,
    })!;
    expect(plan.minutesPerWeek).toBe(240);
    expect(plan.fits).toBe(false);
    expect(plan.endAtBudget).toBe("2026-12-13");
    expect(
      planGoal({
        steps: steps([240, 240]),
        from: "2026-11-16",
        until: "2026-11-29",
        hoursPerWeek: 4,
      })!.fits,
    ).toBe(true);
  });

  it("refuses a date before the start, or no steps", () => {
    expect(planGoal({ steps: steps([60]), from: "2026-11-16", until: "2026-11-15" })).toBeNull();
    expect(planGoal({ steps: [], from: "2026-11-16", until: "2026-12-15" })).toBeNull();
    expect(
      planGoal({ steps: steps([60]), from: "2026-11-16", until: "2026-11-16" })!.weeks,
    ).toHaveLength(1);
  });
});

describe("workLeft", () => {
  const task = (
    goal: string | null,
    status: string,
    minutes: number | null,
    parent: string | null = null,
  ) => ({
    goal_id: goal,
    status,
    estimated_minutes: minutes,
    parent_task_id: parent,
  });
  it("adds up the open linked tasks and their typed times", () => {
    expect(
      workLeft(
        [
          task("g", "todo", 60),
          task("g", "in_progress", null),
          task("g", "completed", 90),
          task("g", "cancelled", 30),
          task("g", "todo", 15, "parent"),
          task("other", "todo", 60),
        ],
        "g",
      ),
    ).toEqual({ open: 2, minutes: 60, untimed: 1 });
  });
});
