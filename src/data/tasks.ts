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

export async function updateTask(id: string, input: Partial<TaskInput>) {
  const patch: Partial<TaskInput> & { completed_at?: string | null } = { ...input };
  if (input.status) {
    patch.completed_at = input.status === "completed" ? new Date().toISOString() : null;
  }
  return unwrap(await supabase.from("tasks").update(patch).eq("id", id).select().single());
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
