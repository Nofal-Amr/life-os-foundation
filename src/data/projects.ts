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
  icon: string | null;
  color: string | null;
  image_url?: string | null;
};

export const PROJECT_IMAGES_BUCKET = "project-images";
export const MAX_PROJECT_COVER_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_PROJECT_COVER_TYPES = ["image/png", "image/jpeg", "image/webp"];

export const projectKeys = {
  all: ["projects"] as const,
  detail: (id: string) => ["projects", id] as const,
  coverUrl: (path: string | null) => ["projects", "cover-url", path] as const,
};

export const projectCoverUrlQuery = (path: string | null) =>
  queryOptions({
    queryKey: projectKeys.coverUrl(path),
    enabled: Boolean(path),
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      if (!path) return null;
      const { data, error } = await supabase.storage
        .from(PROJECT_IMAGES_BUCKET)
        .createSignedUrl(path, 60 * 60 * 24);
      if (error) return null;
      return data?.signedUrl ?? null;
    },
  });

export function validateProjectCover(file: File) {
  if (!ACCEPTED_PROJECT_COVER_TYPES.includes(file.type)) {
    throw new Error("Please choose a PNG, JPEG or WebP image.");
  }
  if (file.size > MAX_PROJECT_COVER_BYTES) {
    throw new Error("That image is larger than 5MB. Please choose a smaller one.");
  }
}

export async function uploadProjectCover(
  projectId: string,
  file: File,
  previousPath?: string | null,
) {
  validateProjectCover(file);
  const userId = await currentUserId();
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${projectId}/cover-${Date.now()}.${extension}`;
  const { error } = await supabase.storage
    .from(PROJECT_IMAGES_BUCKET)
    .upload(path, file, { contentType: file.type });
  if (error) throw error;
  if (previousPath) await supabase.storage.from(PROJECT_IMAGES_BUCKET).remove([previousPath]);
  await updateProject(projectId, { image_url: path });
  return path;
}

export async function removeProjectCover(projectId: string, path?: string | null) {
  if (path) await supabase.storage.from(PROJECT_IMAGES_BUCKET).remove([path]);
  return updateProject(projectId, { image_url: null });
}

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

export async function createProject(input: ProjectInput): Promise<Project> {
  const user_id = await currentUserId();
  return unwrap(await supabase.from("projects").insert({ ...input, user_id }).select().single()) as Project;
}

export async function updateProject(id: string, input: Partial<ProjectInput>): Promise<Project> {
  return unwrap(await supabase.from("projects").update(input).eq("id", id).select().single()) as Project;
}

export async function archiveProject(id: string) {
  return updateProject(id, { status: "archived" });
}

export async function deleteProject(id: string) {
  const project = unwrap(
    await supabase.from("projects").select("image_url").eq("id", id).maybeSingle(),
  ) as Pick<Project, "image_url"> | null;
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
  if (project?.image_url) {
    await supabase.storage.from(PROJECT_IMAGES_BUCKET).remove([project.image_url]);
  }
}
