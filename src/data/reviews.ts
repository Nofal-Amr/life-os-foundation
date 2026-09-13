import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { currentUserId, unwrap } from "@/lib/supabase-helpers";

export type DailyReview = Database["public"]["Tables"]["daily_reviews"]["Row"];
export type ReviewInput = {
  review_date: string;
  wins: string | null;
  challenges: string | null;
  gratitude: string | null;
  mood: number | null;
  tomorrow_focus: string | null;
};

export const reviewKeys = {
  all: ["daily_reviews"] as const,
  byDate: (date: string) => ["daily_reviews", date] as const,
};

export const reviewsQuery = () =>
  queryOptions({
    queryKey: reviewKeys.all,
    queryFn: async () =>
      unwrap(
        await supabase
          .from("daily_reviews")
          .select("*")
          .order("review_date", { ascending: false })
          .limit(60),
      ) as DailyReview[],
  });

export const reviewByDateQuery = (date: string) =>
  queryOptions({
    queryKey: reviewKeys.byDate(date),
    queryFn: async () =>
      unwrap(
        await supabase.from("daily_reviews").select("*").eq("review_date", date).maybeSingle(),
      ) as DailyReview | null,
  });

/** One review per user per date — upsert on the (user_id, review_date) pair. */
export async function saveReview(input: ReviewInput) {
  const user_id = await currentUserId();
  return unwrap(
    await supabase
      .from("daily_reviews")
      .upsert({ ...input, user_id }, { onConflict: "user_id,review_date" })
      .select()
      .single(),
  );
}
