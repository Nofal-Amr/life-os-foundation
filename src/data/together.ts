/**
 * Together: shared spaces for family or friends, joined with a 6-letter
 * code. A space has a shared calendar and shared lists — only what members
 * put in it; nobody sees anyone's own Life OS data. Access is enforced by
 * the database (see supabase/migrations/20261008170000_together.sql).
 */
import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { unwrap } from "@/lib/supabase-helpers";

export type Pod = Database["public"]["Tables"]["pods"]["Row"];
export type PodMember = Database["public"]["Tables"]["pod_members"]["Row"];
export type PodEvent = Database["public"]["Tables"]["pod_events"]["Row"];
export type PodList = Database["public"]["Tables"]["pod_lists"]["Row"];
export type PodListItem = Database["public"]["Tables"]["pod_list_items"]["Row"];

export const togetherKeys = {
  pods: ["pods"] as const,
  members: ["pod_members"] as const,
  events: ["pod_events"] as const,
  lists: ["pod_lists"] as const,
  items: ["pod_list_items"] as const,
};

export const podsQuery = () =>
  queryOptions({
    queryKey: togetherKeys.pods,
    queryFn: async () =>
      unwrap(await supabase.from("pods").select("*").order("created_at")) as Pod[],
  });

export const podMembersQuery = () =>
  queryOptions({
    queryKey: togetherKeys.members,
    queryFn: async () =>
      unwrap(await supabase.from("pod_members").select("*").order("joined_at")) as PodMember[],
  });

export const podEventsQuery = () =>
  queryOptions({
    queryKey: togetherKeys.events,
    queryFn: async () =>
      unwrap(
        await supabase
          .from("pod_events")
          .select("*")
          .gte("starts_at", new Date(Date.now() - 86_400_000).toISOString())
          .order("starts_at"),
      ) as PodEvent[],
  });

export const podListsQuery = () =>
  queryOptions({
    queryKey: togetherKeys.lists,
    queryFn: async () =>
      unwrap(await supabase.from("pod_lists").select("*").order("created_at")) as PodList[],
  });

export const podListItemsQuery = () =>
  queryOptions({
    queryKey: togetherKeys.items,
    queryFn: async () =>
      unwrap(
        await supabase
          .from("pod_list_items")
          .select("*")
          .order("done")
          .order("position")
          .order("created_at"),
      ) as PodListItem[],
  });

/* ---------------------------------------------------------------- spaces */

export async function createPod(name: string, myName: string): Promise<string> {
  return unwrap(await supabase.rpc("create_pod", { pod_name: name, my_name: myName })) as string;
}

export async function joinPod(code: string, myName: string): Promise<string> {
  return unwrap(
    await supabase.rpc("join_pod", { code: code.trim().toUpperCase(), my_name: myName }),
  ) as string;
}

export async function renewPodCode(podId: string): Promise<string> {
  return unwrap(await supabase.rpc("renew_pod_code", { target: podId })) as string;
}

export async function renameMe(podId: string, myName: string): Promise<void> {
  unwrap(await supabase.rpc("rename_me_in_pod", { target: podId, my_name: myName }));
}

/** Leave a space (or, as its owner, remove someone). */
export async function removeMember(podId: string, userId: string): Promise<void> {
  unwrap(
    await supabase.from("pod_members").delete().eq("pod_id", podId).eq("user_id", userId).select(),
  );
}

/** What was typed or pasted, as a code: capitals and digits, six at most. */
export function normaliseCode(text: string): string {
  return text
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

export function isValidCode(code: string): boolean {
  return /^[A-HJ-NP-Z2-9]{6}$/.test(code);
}

/* ---------------------------------------------------------------- events */

export type PodEventInput = {
  pod_id: string;
  title: string;
  note: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
};

export async function addPodEvent(input: PodEventInput): Promise<PodEvent> {
  return unwrap(await supabase.from("pod_events").insert(input).select().single()) as PodEvent;
}

export async function updatePodEvent(id: string, input: Partial<PodEventInput>): Promise<void> {
  unwrap(await supabase.from("pod_events").update(input).eq("id", id).select());
}

export async function deletePodEvent(id: string): Promise<void> {
  unwrap(await supabase.from("pod_events").delete().eq("id", id).select());
}

/* ----------------------------------------------------------------- lists */

export async function addPodList(podId: string, title: string): Promise<PodList> {
  return unwrap(
    await supabase.from("pod_lists").insert({ pod_id: podId, title }).select().single(),
  ) as PodList;
}

export async function deletePodList(id: string): Promise<void> {
  unwrap(await supabase.from("pod_lists").delete().eq("id", id).select());
}

export async function addPodItem(list: PodList, text: string): Promise<void> {
  unwrap(
    await supabase
      .from("pod_list_items")
      .insert({ list_id: list.id, pod_id: list.pod_id, text })
      .select(),
  );
}

export async function setPodItemDone(id: string, done: boolean, userId: string): Promise<void> {
  unwrap(
    await supabase
      .from("pod_list_items")
      .update({ done, done_by: done ? userId : null })
      .eq("id", id)
      .select(),
  );
}

export async function deletePodItem(id: string): Promise<void> {
  unwrap(await supabase.from("pod_list_items").delete().eq("id", id).select());
}

/** Clears ticked-off items from a list. */
export async function clearDoneItems(listId: string): Promise<void> {
  unwrap(
    await supabase.from("pod_list_items").delete().eq("list_id", listId).eq("done", true).select(),
  );
}
