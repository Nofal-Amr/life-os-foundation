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
  parent_task_id?: string | null;
  position?: number;
};


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
  const patch: Record<string, unknown> = { ...input };
  if (input.status) {
    patch.completed_at = input.status === "completed" ? new Date().toISOString() : null;
  }
  if (previous) Object.assign(patch, postponementPatch(previous, input.due_date));
  return unwrap(await supabase.from("tasks").update(patch).eq("id", id).select().single());
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
