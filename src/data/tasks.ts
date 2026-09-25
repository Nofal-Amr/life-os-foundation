import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { todayISO } from "@/lib/date";
import { currentUserId, unwrap } from "@/lib/supabase-helpers";

export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type TaskInput = {
  title: string;
  description: string | null;
  status: Task["status"];
  priority: Task["priority"];
  due_date: string | null;
  project_id: string | null;
  capability_id: string | null;
  goal_id: string | null;
  estimated_minutes?: number | null;
  estimate_unit?: EstimateUnit;
  start_date?: string | null;
  max_date?: string | null;
  parent_task_id?: string | null;
  position?: number;
  /** "HH:mm" on the due date, if the task has a time. */
  due_time?: string | null;
  repeat?: TaskRepeat | null;
};

export type TaskRepeat = "daily" | "weekdays" | "weekly" | "monthly";

export const TASK_REPEATS: { value: TaskRepeat; label: string }[] = [
  { value: "daily", label: "Every day" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekly", label: "Every week" },
  { value: "monthly", label: "Every month" },
];

/** The next due date of a repeating task; weekdays skip Friday and Saturday. */
export function nextRepeatDate(from: string, repeat: TaskRepeat): string {
  const date = new Date(`${from}T12:00:00`);
  if (repeat === "daily") date.setDate(date.getDate() + 1);
  else if (repeat === "weekly") date.setDate(date.getDate() + 7);
  else if (repeat === "monthly") {
    const day = date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() + 1);
    // 31 Jan -> 28/29 Feb, not 3 March.
    const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(day, last));
  } else {
    do date.setDate(date.getDate() + 1);
    while (date.getDay() === 5 || date.getDay() === 6);
  }
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

export type EstimateUnit = "minutes" | "hours" | "days";

export const ESTIMATE_UNITS: { value: EstimateUnit; label: string; short: string; minutes: number }[] =
  [
    { value: "minutes", label: "minutes", short: "min", minutes: 1 },
    { value: "hours", label: "hours", short: "h", minutes: 60 },
    { value: "days", label: "days", short: "d", minutes: 1440 },
  ];

function unitInfo(unit: string | null | undefined) {
  return ESTIMATE_UNITS.find((item) => item.value === unit) ?? ESTIMATE_UNITS[0]!;
}

/** Canonical minutes for a number entered in the unit the user chose. */
export function estimateToMinutes(value: number | null, unit: EstimateUnit): number | null {
  if (value == null || Number.isNaN(value) || value <= 0) return null;
  return Math.round(value * unitInfo(unit).minutes);
}

/** The stored minutes shown back in the unit the user chose. */
export function estimateInUnit(
  minutes: number | null | undefined,
  unit: string | null | undefined,
): number | null {
  if (minutes == null) return null;
  const per = unitInfo(unit).minutes;
  return Math.round((Number(minutes) / per) * 100) / 100;
}

/** "2 h", "3 d", "45 min" — always in the unit chosen, never converted. */
export function estimateLabel(task: {
  estimated_minutes: number | null;
  estimate_unit?: string | null;
}): string {
  const value = estimateInUnit(task.estimated_minutes, task.estimate_unit);
  if (value == null) return "";
  return `${value} ${unitInfo(task.estimate_unit).short}`;
}

/** Start, due and max must stay in that order. Returns a plain message or null. */
export function dateOrderProblem(input: {
  start_date?: string | null;
  due_date?: string | null;
  max_date?: string | null;
}): string | null {
  const { start_date: start, due_date: due, max_date: max } = input;
  if (start && due && start > due) return "Start date is after the due date.";
  if (due && max && due > max) return "Due date is after the max date.";
  if (start && max && start > max) return "Start date is after the max date.";
  return null;
}

/** A task with a future start date has not begun yet. */
export function notStartedYet(task: Task, today: string): boolean {
  return Boolean(task.start_date) && String(task.start_date) > today;
}


export type TaskFilter = "all" | "today" | "upcoming" | "overdue" | "inbox" | "completed";

export const taskKeys = {
  all: ["tasks"] as const,
};

export const tasksQuery = () =>
  queryOptions({
    queryKey: taskKeys.all,
    queryFn: async () =>
      unwrap(
        await supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      ) as Task[],
  });

const OPEN_STATUSES: Task["status"][] = ["inbox", "todo", "in_progress", "waiting"];

export function isOpen(task: Task) {
  return OPEN_STATUSES.includes(task.status);
}

/** Steps are real tasks with a parent; they never appear as top-level rows. */
export function isStep(task: Task) {
  return task.parent_task_id != null;
}

export function topLevelTasks(tasks: Task[]): Task[] {
  return tasks.filter((task) => !isStep(task));
}

/** Child steps of a task, in stored position order. */
export function stepsOf(tasks: Task[], parentId: string): Task[] {
  return tasks
    .filter((task) => task.parent_task_id === parentId)
    .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
}

/** Derived only — never stored. */
export function stepProgress(steps: Task[]) {
  const done = steps.filter((step) => step.status === "completed").length;
  return { done, total: steps.length };
}

export function firstOpenStep(tasks: Task[], parentId: string): Task | undefined {
  return stepsOf(tasks, parentId).find(isOpen);
}

export function filterTasks(tasks: Task[], filter: TaskFilter): Task[] {
  const today = todayISO();
  switch (filter) {
    case "today":
      return tasks.filter((t) => isOpen(t) && t.due_date === today);
    case "upcoming":
      return tasks.filter((t) => isOpen(t) && !!t.due_date && t.due_date > today);
    case "overdue":
      return tasks.filter((t) => isOpen(t) && !!t.due_date && t.due_date < today);
    case "inbox":
      return tasks.filter((t) => t.status === "inbox");
    case "completed":
      return tasks.filter((t) => t.status === "completed");
    default:
      return tasks;
  }
}

export async function createTask(input: TaskInput) {
  const user_id = await currentUserId();
  return unwrap(
    await supabase
      .from("tasks")
      .insert({
        ...input,
        user_id,
        completed_at: input.status === "completed" ? new Date().toISOString() : null,
      })
      .select()
      .single(),
  );
}

/**
 * Moving a due date later is recorded as information only: a count, when it
 * last moved, and the date it was first meant for.
 */
export function postponementPatch(previous: Task, nextDue: string | null | undefined) {
  if (!nextDue || !previous.due_date || nextDue <= previous.due_date) return {};
  return {
    postponed_count: (previous.postponed_count ?? 0) + 1,
    last_postponed_at: new Date().toISOString(),
    original_due_date: previous.original_due_date ?? previous.due_date,
  };
}

export async function updateTask(id: string, input: Partial<TaskInput>, previous?: Task) {
  const patch: Partial<Task> = { ...input } as Partial<Task>;
  if (input.status) {
    patch["completed_at"] = input.status === "completed" ? new Date().toISOString() : null;
  }
  if (previous) Object.assign(patch, postponementPatch(previous, input.due_date));
  const saved = unwrap(
    await supabase.from("tasks").update(patch).eq("id", id).select().single(),
  ) as Task;
  // Finishing a repeating task puts the next one on its next date; the
  // finished one keeps its history and hands the repeat on.
  if (input.status === "completed" && saved?.repeat && !saved.parent_task_id) {
    const repeat = saved.repeat as TaskRepeat;
    const base = saved.due_date ?? new Date().toISOString().slice(0, 10);
    await createTask({
      title: saved.title,
      description: saved.description,
      status: "todo",
      priority: saved.priority,
      due_date: nextRepeatDate(base, repeat),
      due_time: saved.due_time,
      repeat,
      project_id: saved.project_id,
      capability_id: saved.capability_id,
      goal_id: saved.goal_id,
      estimated_minutes: saved.estimated_minutes,
      ...(saved.estimate_unit ? { estimate_unit: saved.estimate_unit as EstimateUnit } : {}),
    });
    await supabase.from("tasks").update({ repeat: null }).eq("id", id);
  }
  return saved;
}

/** One step, one level deep. Position defaults to the front of the list. */
export async function createStep(input: {
  parent_task_id: string;
  title: string;
  estimated_minutes?: number | null;
  position?: number;
  project_id?: string | null;
  due_date?: string | null;
}) {
  return createTask({
    title: input.title,
    description: null,
    status: "todo",
    priority: "medium",
    due_date: input.due_date ?? null,
    project_id: input.project_id ?? null,
    capability_id: null,
    goal_id: null,
    parent_task_id: input.parent_task_id,
    position: input.position ?? 0,
    estimated_minutes: input.estimated_minutes ?? null,
  });
}

export async function reorderSteps(steps: Task[]) {
  await Promise.all(
    steps.map((step, index) =>
      supabase.from("tasks").update({ position: index }).eq("id", step.id),
    ),
  );
}

export async function completeTask(id: string) {
  return updateTask(id, { status: "completed" });
}

export async function reopenTask(id: string) {
  return updateTask(id, { status: "todo" });
}

export async function deleteTask(id: string) {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Several tasks typed or pasted at once: one per line. Bullets and numbering
 * from a copied list are dropped, so a pasted list arrives as plain titles.
 */
export function splitTaskLines(text: string, max = 50): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*•–—]|\d+[.)])\s+/, "").trim())
    .filter((line) => line.length > 0)
    .slice(0, max);
}
