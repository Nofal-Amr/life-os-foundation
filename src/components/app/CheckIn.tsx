import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Frown, Laugh, Meh, Smile, SmilePlus, Wind, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { BreathingReset } from "@/components/app/BreathingReset";
import {
  ENERGY_LABELS,
  MOOD_LABELS,
  reviewByDateQuery,
  reviewKeys,
  saveCheckIn,
  type CheckIn as CheckInValue,
  type DailyReview,
} from "@/data/reviews";
import { todayISO } from "@/lib/date";
import { toError } from "@/lib/supabase-helpers";
import { cn } from "@/lib/utils";

const MOOD_ICONS: LucideIcon[] = [Frown, Meh, Smile, SmilePlus, Laugh];

/**
 * How you feel, in two taps: mood 1–5 and energy 1–5, saved into today's
 * review. Every choice is neutral; nothing is coloured as good or bad.
 */
export function CheckIn({ className }: { className?: string }) {
  const date = todayISO();
  const queryClient = useQueryClient();
  const review = useQuery(reviewByDateQuery(date));
  const [breathing, setBreathing] = useState(false);

  const save = useMutation({
    mutationFn: (input: CheckInValue) => saveCheckIn(date, input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: reviewKeys.byDate(date) });
      const previous = queryClient.getQueryData<DailyReview | null>(reviewKeys.byDate(date));
      queryClient.setQueryData(reviewKeys.byDate(date), {
        ...(previous ?? {}),
        ...input,
      } as DailyReview);
      return previous;
    },
    onError: (error, _input, previous) => {
      queryClient.setQueryData(reviewKeys.byDate(date), previous ?? null);
      toast.error(toError(error).message);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: reviewKeys.all }),
  });

  const mood = review.data?.mood ?? null;
  const energy = review.data?.energy ?? null;

  return (
    <section className={cn("stat-card p-5", className)} aria-label="Check in">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="section-title">How are you right now?</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {mood && energy
              ? `${MOOD_LABELS[mood - 1]} · ${ENERGY_LABELS[energy - 1]} energy. Tap to change.`
              : "Two taps. It goes into today's review."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setBreathing(true)}
          className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-border px-3 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <Wind className="size-3.5" aria-hidden="true" />
          1-minute reset
        </button>
      </div>

      <div className="mt-4 grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Mood">
        {MOOD_LABELS.map((label, index) => {
          const Icon = MOOD_ICONS[index]!;
          const selected = mood === index + 1;
          return (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => save.mutate({ mood: selected ? null : index + 1 })}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border text-[0.6875rem] transition-[background-color,border-color,scale] duration-150 active:scale-[0.96]",
                selected
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground",
              )}
            >
              <Icon className="size-5" aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>

      <p className="mt-4 mb-1.5 text-xs text-muted-foreground">Energy</p>
      <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Energy">
        {ENERGY_LABELS.map((label, index) => {
          const selected = energy === index + 1;
          return (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => save.mutate({ energy: selected ? null : index + 1 })}
              className={cn(
                "flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl border text-[0.6875rem] transition-[background-color,border-color,scale] duration-150 active:scale-[0.96]",
                selected
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground",
              )}
            >
              {/* Filled bars show the level; the label says it in words. */}
              <span aria-hidden="true" className="flex items-end gap-0.5">
                {[0, 1, 2, 3, 4].map((bar) => (
                  <span
                    key={bar}
                    className={cn(
                      "w-1 rounded-sm",
                      bar <= index ? "bg-current" : "bg-current opacity-20",
                    )}
                    style={{ height: 4 + bar * 2 }}
                  />
                ))}
              </span>
              {label}
            </button>
          );
        })}
      </div>

      <BreathingReset open={breathing} onOpenChange={setBreathing} />
    </section>
  );
}
