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
  energy?: number | null;
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

export type CheckIn = { mood?: number | null; energy?: number | null };

/**
 * A two-tap check-in: saves only mood and/or energy for the day, so a written
 * review for the same date is never overwritten.
 */
export async function saveCheckIn(review_date: string, input: CheckIn) {
  const user_id = await currentUserId();
  return unwrap(
    await supabase
      .from("daily_reviews")
      .upsert({ review_date, user_id, ...input }, { onConflict: "user_id,review_date" })
      .select()
      .single(),
  ) as DailyReview;
}

/** The same calendar day in each of the previous `years` years. */
export function sameDayPreviousYears(date: string, years = 5): string[] {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return Array.from({ length: years }, (_, i) => {
    const year = y - 1 - i;
    // 29 Feb falls back to 28 Feb in years without it.
    const day = m === 2 && d === 29 && !(year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 28 : d;
    return `${year}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  });
}

export const onThisDayReviewsQuery = (date: string) =>
  queryOptions({
    queryKey: [...reviewKeys.all, "on-this-day", date] as const,
    queryFn: async () =>
      unwrap(
        await supabase
          .from("daily_reviews")
          .select("*")
          .in("review_date", sameDayPreviousYears(date))
          .order("review_date", { ascending: false }),
      ) as DailyReview[],
  });

export const MOOD_LABELS = ["Low", "Meh", "Okay", "Good", "Great"] as const;
export const ENERGY_LABELS = ["Drained", "Low", "Steady", "Strong", "Charged"] as const;
