/** The RPG skin's shop: rewards you set yourself, bought with gold. */
import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { currentUserId, unwrap } from "@/lib/supabase-helpers";

export type RpgReward = Database["public"]["Tables"]["rpg_rewards"]["Row"];
export type RpgPurchase = Database["public"]["Tables"]["rpg_purchases"]["Row"];

export const shopKeys = {
  rewards: ["rpg_rewards"] as const,
  purchases: ["rpg_purchases"] as const,
};

export const rewardsQuery = () =>
  queryOptions({
    queryKey: shopKeys.rewards,
    queryFn: async () =>
      unwrap(await supabase.from("rpg_rewards").select("*").order("cost")) as RpgReward[],
  });

export const purchasesQuery = () =>
  queryOptions({
    queryKey: shopKeys.purchases,
    queryFn: async () =>
      unwrap(
        await supabase.from("rpg_purchases").select("*").order("bought_at", { ascending: false }),
      ) as RpgPurchase[],
  });

export async function addReward(title: string, cost: number): Promise<void> {
  const user_id = await currentUserId();
  unwrap(await supabase.from("rpg_rewards").insert({ title, cost, user_id }).select());
}

export async function deleteReward(id: string): Promise<void> {
  unwrap(await supabase.from("rpg_rewards").delete().eq("id", id).select());
}

export async function buyReward(reward: RpgReward): Promise<void> {
  const user_id = await currentUserId();
  unwrap(
    await supabase
      .from("rpg_purchases")
      .insert({ title: reward.title, cost: reward.cost, user_id })
      .select(),
  );
}

export async function undoPurchase(id: string): Promise<void> {
  unwrap(await supabase.from("rpg_purchases").delete().eq("id", id).select());
}

export function spentGold(purchases: RpgPurchase[]): number {
  return purchases.reduce((sum, item) => sum + item.cost, 0);
}
