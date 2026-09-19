import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { currentUserId, unwrap } from "@/lib/supabase-helpers";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export const AVATAR_BUCKET = "avatars";
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
export const ACCEPTED_AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export const profileKeys = {
  current: ["profile"] as const,
  avatarUrl: (path: string | null) => ["profile", "avatar-url", path] as const,
};

export const profileQuery = () =>
  queryOptions({
    queryKey: profileKeys.current,
    queryFn: async () =>
      unwrap(await supabase.from("profiles").select("*").maybeSingle()) as Profile | null,
  });

/** Private bucket: resolve a short-lived signed URL for display. */
export const avatarUrlQuery = (path: string | null) =>
  queryOptions({
    queryKey: profileKeys.avatarUrl(path),
    enabled: !!path,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      if (!path) return null;
      const { data, error } = await supabase.storage
        .from(AVATAR_BUCKET)
        .createSignedUrl(path, 60 * 60 * 24);
      if (error) return null;
      return data?.signedUrl ?? null;
    },
  });

export async function updateProfile(input: {
  display_name?: string | null;
  avatar_url?: string | null;
}): Promise<Profile> {
  const user_id = await currentUserId();
  const existing = unwrap(
    await supabase.from("profiles").select("id").eq("user_id", user_id).maybeSingle(),
  ) as { id: string } | null;

  if (existing) {
    return unwrap(
      await supabase.from("profiles").update(input).eq("user_id", user_id).select().single(),
    ) as Profile;
  }
  return unwrap(
    await supabase.from("profiles").insert({ ...input, user_id }).select().single(),
  ) as Profile;
}

async function clearAvatarFiles(user_id: string) {
  const { data } = await supabase.storage.from(AVATAR_BUCKET).list(user_id);
  const paths = (data ?? []).map((file) => `${user_id}/${file.name}`);
  if (paths.length > 0) await supabase.storage.from(AVATAR_BUCKET).remove(paths);
}

export async function uploadAvatar(file: File): Promise<Profile> {
  if (!ACCEPTED_AVATAR_TYPES.includes(file.type)) {
    throw new Error("Please choose a PNG, JPEG, WebP or GIF image.");
  }
  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error("That image is larger than 2MB. Please choose a smaller one.");
  }
  const user_id = await currentUserId();
  await clearAvatarFiles(user_id);

  const extension = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${user_id}/avatar-${Date.now()}.${extension}`;
  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;

  return updateProfile({ avatar_url: path });
}

export async function removeAvatar(): Promise<Profile> {
  const user_id = await currentUserId();
  await clearAvatarFiles(user_id);
  return updateProfile({ avatar_url: null });
}
