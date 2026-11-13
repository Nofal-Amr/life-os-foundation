/**
 * Creates what a plan markdown describes (see src/lib/planMarkdown.ts):
 * the goal, its projects, their tasks and steps, habits and a note, through
 * the usual create functions. Tasks carry both their project and the goal,
 * which is how a project is tied to its goal.
 */
import { createGoal } from "@/data/goals";
import { createHabit } from "@/data/habits";
import { createNote } from "@/data/notes";
import { createProject } from "@/data/projects";
import { createTask } from "@/data/tasks";
import { taskDueDate, taskStartDate, type ParsedPlan, type PlanTask } from "@/lib/planMarkdown";

export type PlanItemKind = "goal" | "project" | "task" | "step" | "habit" | "notes";

export type PlanItem = {
  key: string;
  kind: PlanItemKind;
  label: string;
  /** Short extra detail: a date, a week, a priority. */
  detail: string | null;
  children: PlanItem[];
};

function taskDetail(task: PlanTask, start: string | null): string | null {
  const due = taskDueDate(task, start);
  const parts: string[] = [];
  if (due) parts.push(`due ${due}`);
  else if (task.week !== null) parts.push(`week ${task.week}`);
  else if (task.day !== null) parts.push(`day ${task.day}`);
  if (task.priority && task.priority !== "medium") parts.push(task.priority);
  if (task.done) parts.push("done");
  return parts.length ? parts.join(" · ") : null;
}

function taskItems(tasks: PlanTask[], prefix: string, start: string | null): PlanItem[] {
  return tasks.map((task, j) => ({
    key: `${prefix}t${j}`,
    kind: "task" as const,
    label: task.title,
    detail: taskDetail(task, start),
    children: task.steps.map((step, k) => ({
      key: `${prefix}t${j}.s${k}`,
      kind: "step" as const,
      label: step.title,
      detail: taskDetail(step, start),
      children: [],
    })),
  }));
}

/** The plan as a tree for the preview, each item with a key for ticking. */
export function planItems(plan: ParsedPlan, start: string | null): PlanItem[] {
  const items: PlanItem[] = [];
  if (plan.goal) {
    items.push({
      key: "goal",
      kind: "goal",
      label: plan.goal.name,
      detail: plan.goal.deadline ? `by ${plan.goal.deadline}` : null,
      children: [],
    });
  }
  plan.projects.forEach((project, i) => {
    items.push({
      key: `p${i}`,
      kind: "project",
      label: project.name,
      detail: project.due ? `due ${project.due}` : null,
      children: taskItems(project.tasks, `p${i}.`, start),
    });
  });
  items.push(...taskItems(plan.tasks, "", start));
  plan.habits.forEach((habit, i) =>
    items.push({
      key: `h${i}`,
      kind: "habit",
      label: habit.name,
      detail: habit.frequency,
      children: [],
    }),
  );
  if (plan.notes) {
    items.push({
      key: "notes",
      kind: "notes",
      label: "Plan notes",
      detail: plan.notes.split("\n")[0] ?? null,
      children: [],
    });
  }
  return items;
}

/** Every key in the tree: everything ticked. */
export function allKeys(items: PlanItem[]): string[] {
  return items.flatMap((item) => [item.key, ...allKeys(item.children)]);
}

/** Ticking or unticking an item does the same to everything under it. */
export function toggleItem(selected: Set<string>, item: PlanItem): Set<string> {
  const next = new Set(selected);
  const on = !selected.has(item.key);
  for (const key of allKeys([item])) {
    if (on) next.add(key);
    else next.delete(key);
  }
  return next;
}

export type ImportResult = {
  goal: number;
  projects: number;
  tasks: number;
  habits: number;
  notes: number;
};

function describe(task: PlanTask): string | null {
  const parts = [
    task.description,
    task.areas.length ? task.areas.map((a) => `#${a}`).join(" ") : null,
  ];
  const text = parts.filter(Boolean).join("\n");
  return text || null;
}

/**
 * Creates the ticked items. Steps are created only under a task that was
 * created. Week and @dN dates come from `start` only.
 */
export async function importPlan(
  plan: ParsedPlan,
  selected: Set<string>,
  start: string | null,
): Promise<ImportResult> {
  const result: ImportResult = { goal: 0, projects: 0, tasks: 0, habits: 0, notes: 0 };
  let goalId: string | null = null;

  if (plan.goal && selected.has("goal")) {
    const goal = await createGoal({
      name: plan.goal.name,
      description: plan.goal.description,
      category: plan.goal.areas[0] ?? null,
      target_date: plan.goal.deadline,
      status: "active",
      progress: 0,
      icon: null,
      color: null,
    });
    goalId = (goal as unknown as { id: string }).id;
    result.goal = 1;
  }

  const createTasks = async (tasks: PlanTask[], prefix: string, projectId: string | null) => {
    for (const [j, task] of tasks.entries()) {
      if (!selected.has(`${prefix}t${j}`)) continue;
      const made = await createOne(task, projectId, null, j);
      for (const [k, step] of task.steps.entries()) {
        if (selected.has(`${prefix}t${j}.s${k}`)) await createOne(step, projectId, made, k);
      }
    }
  };

  const createOne = async (
    task: PlanTask,
    projectId: string | null,
    parentId: string | null,
    position: number,
  ): Promise<string> => {
    const minutes = task.estimateMinutes;
    const made = await createTask({
      title: task.title,
      description: describe(task),
      status: task.done ? "completed" : "todo",
      priority: task.priority ?? "medium",
      due_date: taskDueDate(task, start),
      start_date: taskStartDate(task, start),
      project_id: projectId,
      goal_id: goalId,
      capability_id: null,
      parent_task_id: parentId,
      position,
      ...(minutes !== null
        ? {
            estimated_minutes: minutes,
            estimate_unit:
              minutes >= 480 && minutes % 480 === 0 ? "days" : minutes >= 60 ? "hours" : "minutes",
          }
        : {}),
    });
    result.tasks += 1;
    return (made as unknown as { id: string }).id;
  };

  for (const [i, project] of plan.projects.entries()) {
    const key = `p${i}`;
    let projectId: string | null = null;
    if (selected.has(key)) {
      const description = [
        project.description,
        plan.goal && goalId ? `Part of the goal: ${plan.goal.name}` : null,
      ]
        .filter(Boolean)
        .join("\n");
      const made = await createProject({
        name: project.name,
        description: description || null,
        status: "active",
        priority: project.priority ?? "medium",
        start_date: start,
        due_date: project.due,
        icon: null,
        color: null,
      });
      projectId = made.id;
      result.projects += 1;
    }
    // Tasks under an unticked project still come in, without a project.
    await createTasks(project.tasks, `${key}.`, projectId);
  }
  await createTasks(plan.tasks, "", null);

  for (const [i, habit] of plan.habits.entries()) {
    if (!selected.has(`h${i}`)) continue;
    await createHabit({
      name: habit.name,
      description: null,
      frequency: habit.frequency,
      target: 1,
      active: true,
      icon: null,
      color: null,
      category: plan.goal?.areas[0] ?? null,
    });
    result.habits += 1;
  }

  if (plan.notes && selected.has("notes")) {
    await createNote({
      title: plan.goal ? `${plan.goal.name}: plan notes` : "Plan notes",
      body: plan.notes,
      tags: ["plan"],
    });
    result.notes = 1;
  }
  return result;
}
