import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { currentUserId, unwrap } from "@/lib/supabase-helpers";

export type Project = Database["public"]["Tables"]["projects"]["Row"];
export type ProjectInput = {
  name: string;
  description: string | null;
  status: Project["status"];
  priority: Project["priority"];
  start_date: string | null;
  due_date: string | null;
};

export const projectKeys = {
  all: ["projects"] as const,
  detail: (id: string) => ["projects", id] as const,
};

export const projectsQuery = () =>
  queryOptions({
    queryKey: projectKeys.all,
    queryFn: async () =>
      unwrap(
        await supabase
          .from("projects")
          .select("*")
          .order("created_at", { ascending: false }),
      ) as Project[],
  });

export const projectQuery = (id: string) =>
  queryOptions({
    queryKey: projectKeys.detail(id),
    queryFn: async () =>
      unwrap(await supabase.from("projects").select("*").eq("id", id).maybeSingle()) as Project,
  });

export async function createProject(input: ProjectInput) {
  const user_id = await currentUserId();
  return unwrap(await supabase.from("projects").insert({ ...input, user_id }).select().single());
}

export async function updateProject(id: string, input: Partial<ProjectInput>) {
  return unwrap(await supabase.from("projects").update(input).eq("id", id).select().single());
}

export async function archiveProject(id: string) {
  return updateProject(id, { status: "archived" });
}

export async function deleteProject(id: string) {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
}
