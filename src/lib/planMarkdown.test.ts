import { describe, expect, it } from "vitest";

import {
  allTasks,
  exactDate,
  needsStartDate,
  parsePlan,
  planCounts,
  taskDueDate,
  taskStartDate,
} from "@/lib/planMarkdown";
import { PLAN_PROMPTS, SAMPLE_CAREER_PLAN } from "@/lib/planPrompts";

describe("plan markdown parser", () => {
  it("reads a goal, projects, tasks with tokens and steps", () => {
    const plan = parsePlan(`# Goal: Ship the portfolio @2026-12-11 #career
Two case studies online.

## Project: Case studies !high #portfolio
Short description.
- [ ] Write case study 1 @2026-11-20 !high #writing ~2h
  - [ ] Outline it ~30m
  Notes about the task.
- [x] Pick datasets
`);
    expect(plan.warnings).toEqual([]);
    expect(plan.goal).toMatchObject({
      name: "Ship the portfolio",
      deadline: "2026-12-11",
      areas: ["career"],
      description: "Two case studies online.",
    });
    const project = plan.projects[0]!;
    expect(project).toMatchObject({
      name: "Case studies",
      priority: "high",
      areas: ["portfolio"],
      description: "Short description.",
    });
    const [first, second] = project.tasks;
    expect(first).toMatchObject({
      title: "Write case study 1",
      due: "2026-11-20",
      priority: "high",
      areas: ["writing"],
      estimateMinutes: 120,
      done: false,
      description: "Notes about the task.",
    });
    expect(first!.steps[0]).toMatchObject({ title: "Outline it", estimateMinutes: 30 });
    expect(second).toMatchObject({ title: "Pick datasets", done: true });
  });

  it("is forgiving about layout: code fences, chatter, bullets, numbering, no 'Project:'", () => {
    const plan = parsePlan(`Sure! Here is your plan:

\`\`\`markdown
# Learn Spanish
## Speaking
* Book a tutor
+ [X] Download the app
1. Practice 10 words
2) Watch a show
\`\`\``);
    expect(plan.goal?.name).toBe("Learn Spanish");
    expect(plan.projects[0]?.name).toBe("Speaking");
    expect(plan.projects[0]?.tasks.map((t) => t.title)).toEqual([
      "Book a tutor",
      "Download the app",
      "Practice 10 words",
      "Watch a show",
    ]);
    expect(plan.projects[0]?.tasks[1]?.done).toBe(true);
    expect(plan.warnings).toEqual([]);
  });

  it("never invents dates: unreadable or impossible dates become warnings", () => {
    const plan = parsePlan(`# Goal: Test
- [ ] A @20/11/2026
- [ ] B @2026-02-30
- [ ] C @tomorrow
Deadline: next month`);
    expect(allTasks(plan).map((t) => t.due)).toEqual([null, null, null]);
    expect(plan.goal?.deadline).toBeNull();
    expect(plan.warnings).toHaveLength(4);
    expect(plan.warnings[0]).toMatchObject({ line: 2 });
  });

  it("anchors weeks and days to the chosen start date only", () => {
    const plan = parsePlan(`# Goal: G
### Week 1
- [ ] One
### Week 2
- [ ] Two
- [ ] Three @d10
- [ ] Fixed @2026-12-01`);
    const [one, two, three, fixed] = plan.tasks;
    expect(needsStartDate(plan)).toBe(true);
    expect(taskDueDate(one!, null)).toBeNull();
    expect(taskDueDate(fixed!, null)).toBe("2026-12-01");
    expect(taskDueDate(one!, "2026-11-16")).toBe("2026-11-22");
    expect(taskStartDate(one!, "2026-11-16")).toBe("2026-11-16");
    expect(taskDueDate(two!, "2026-11-16")).toBe("2026-11-29");
    expect(taskStartDate(two!, "2026-11-16")).toBe("2026-11-23");
    expect(taskDueDate(three!, "2026-11-16")).toBe("2026-11-25");
    expect(taskDueDate(one!, "not a date")).toBeNull();
  });

  it("reads habits and notes sections", () => {
    const plan = parsePlan(`# Goal: G
## Habits
- Read 20 pages daily
- Plan the week weekly
- Stretch
## Notes
Line one.

Line two.`);
    expect(plan.habits).toEqual([
      { name: "Read 20 pages", frequency: "daily", line: 3 },
      { name: "Plan the week", frequency: "weekly", line: 4 },
      { name: "Stretch", frequency: "daily", line: 5 },
    ]);
    expect(plan.notes).toBe("Line one.\n\nLine two.");
  });

  it("handles bad input without throwing", () => {
    for (const input of ["", "   \n\n", "just some words", "#", "## Project:", "- [ ]", "!!!"]) {
      const plan = parsePlan(input);
      expect(plan.projects.every((p) => p.name)).toBe(true);
      expect(allTasks(plan).every((t) => t.title)).toBe(true);
    }
    expect(parsePlan("").warnings.at(-1)?.message).toMatch(/No goal/);
    expect(parsePlan("## Project:").warnings[0]?.message).toMatch(/without a name/);
    expect(parsePlan("- [ ] x !someday").warnings[0]?.message).toMatch(/priority/);
    expect(parsePlan(undefined as unknown as string).goal).toBeNull();
  });

  it("keeps a second goal as a project, with a warning", () => {
    const plan = parsePlan("# Goal: A\n# Goal: B\n- [ ] t");
    expect(plan.goal?.name).toBe("A");
    expect(plan.projects[0]?.name).toBe("B");
    expect(plan.warnings[0]?.message).toMatch(/one goal/);
  });

  it("checks exact dates", () => {
    expect(exactDate("2028-02-29")).toBe("2028-02-29");
    expect(exactDate("2027-02-29")).toBeNull();
    expect(exactDate("2026-1-5")).toBeNull();
  });

  it("parses the sample 4-week career plan fully", () => {
    const plan = parsePlan(SAMPLE_CAREER_PLAN);
    expect(plan.warnings).toEqual([]);
    expect(planCounts(plan)).toEqual({ goal: 1, projects: 3, tasks: 13, habits: 2, notes: 1 });
    const weeks = new Set(allTasks(plan).map((t) => t.week));
    expect([...weeks].sort()).toEqual([1, 2, 3, 4]);
    expect(needsStartDate(plan)).toBe(true);
  });

  it("ships prompts that ask for the plan format and have fill-ins", () => {
    expect(PLAN_PROMPTS).toHaveLength(2);
    for (const prompt of PLAN_PROMPTS) {
      expect(prompt.text).toContain("# Goal:");
      expect(prompt.text).toContain("- [ ]");
      expect(prompt.text).toContain("ONLY");
    }
    expect(PLAN_PROMPTS[0]!.text).toMatch(/Deadline: \[YYYY-MM-DD\]/);
    expect(PLAN_PROMPTS[0]!.text).toMatch(/Hours I can give per week/);
    expect(PLAN_PROMPTS[1]!.text).toMatch(/PASTE YOUR CHECKLIST/);
  });
});
