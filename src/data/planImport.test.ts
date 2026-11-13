import { beforeEach, describe, expect, it, vi } from "vitest";

const made: { table: string; row: Record<string, unknown> }[] = [];
let counter = 0;
const record = (table: string) =>
  vi.fn(async (row: Record<string, unknown>) => {
    const id = `${table}-${++counter}`;
    made.push({ table, row: { ...row, id } });
    return { ...row, id };
  });

vi.mock("@/data/goals", () => ({ createGoal: record("goals") }));
vi.mock("@/data/projects", () => ({ createProject: record("projects") }));
vi.mock("@/data/tasks", () => ({ createTask: record("tasks") }));
vi.mock("@/data/habits", () => ({ createHabit: record("habits") }));
vi.mock("@/data/notes", () => ({ createNote: record("notes") }));

const { allKeys, importPlan, planItems, toggleItem } = await import("@/data/planImport");
const { parsePlan } = await import("@/lib/planMarkdown");
const { SAMPLE_CAREER_PLAN } = await import("@/lib/planPrompts");

const rows = (table: string) => made.filter((m) => m.table === table).map((m) => m.row);

beforeEach(() => {
  made.length = 0;
  counter = 0;
});

describe("plan import", () => {
  it("creates the 4-week career plan, linked, with dates from the start date", async () => {
    const plan = parsePlan(SAMPLE_CAREER_PLAN);
    const items = planItems(plan, "2026-11-16");
    const result = await importPlan(plan, new Set(allKeys(items)), "2026-11-16");
    expect(result).toEqual({ goal: 1, projects: 3, tasks: 13, habits: 2, notes: 1 });

    const [goal] = rows("goals");
    expect(goal).toMatchObject({ name: "Land a junior data analyst role", category: "career" });
    const tasks = rows("tasks");
    expect(tasks.every((t) => t["goal_id"] === goal!["id"])).toBe(true);
    const projects = rows("projects");
    const skills = projects.find((p) => p["name"] === "Skills refresh")!;
    expect(skills["priority"]).toBe("high");
    const course = tasks.find((t) => String(t["title"]).startsWith("Finish the SQL"))!;
    expect(course).toMatchObject({
      project_id: skills["id"],
      due_date: "2026-11-22",
      start_date: "2026-11-16",
      estimated_minutes: 240,
      estimate_unit: "hours",
    });
    const step = tasks.find((t) => t["title"] === "Watch the first lesson")!;
    expect(step["parent_task_id"]).toBe(course["id"]);
    const apply = tasks.find((t) => String(t["title"]).startsWith("Apply to 10"))!;
    expect(apply["due_date"]).toBe("2026-12-13");
    expect(rows("habits").map((h) => h["frequency"])).toEqual(["daily", "weekly"]);
    expect(rows("notes")[0]).toMatchObject({ tags: ["plan"] });
  });

  it("leaves week tasks without dates when no start date is chosen", async () => {
    const plan = parsePlan(SAMPLE_CAREER_PLAN);
    await importPlan(plan, new Set(allKeys(planItems(plan, null))), null);
    expect(rows("tasks").every((t) => t["due_date"] === null)).toBe(true);
  });

  it("skips unticked items, and unticking a project unticks its tasks", async () => {
    const plan = parsePlan(SAMPLE_CAREER_PLAN);
    const items = planItems(plan, null);
    let selected = new Set(allKeys(items));
    const portfolio = items.find((i) => i.label === "Portfolio")!;
    selected = toggleItem(selected, portfolio);
    selected.delete("h0");
    selected.delete("goal");
    const result = await importPlan(plan, selected, null);
    expect(result).toEqual({ goal: 0, projects: 2, tasks: 9, habits: 1, notes: 1 });
    expect(rows("tasks").every((t) => t["goal_id"] === null)).toBe(true);
    expect(rows("projects").map((p) => p["name"])).not.toContain("Portfolio");
    // Ticking it again brings the children back.
    expect(toggleItem(selected, portfolio).has(portfolio.children[0]!.key)).toBe(true);
  });

  it("never creates a step whose task was unticked", async () => {
    const plan = parsePlan("# Goal: G\n- [ ] Parent\n  - [ ] Step");
    const selected = new Set(["goal", "t0.s0"]);
    const result = await importPlan(plan, selected, null);
    expect(result.tasks).toBe(0);
  });
});
