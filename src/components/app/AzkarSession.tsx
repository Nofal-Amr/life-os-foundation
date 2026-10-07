import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { azkarFor, dhikrKeys, logDhikr, type AzkarTime } from "@/data/azkar";
import { toError } from "@/lib/supabase-helpers";
import { cn } from "@/lib/utils";

/** Remaining counts per zikr, kept on the device so leaving the page loses nothing. */
function useProgress(key: string) {
  const [left, setLeft] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, number>;
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      setLeft(JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, number>);
    } catch {
      setLeft({});
    }
  }, [key]);
  const save = (next: Record<string, number>) => {
    setLeft(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Private mode: progress just isn't kept.
    }
  };
  return [left, save] as const;
}

const buzz = (pattern: number | number[]) => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // No vibration on this device.
  }
};

/**
 * Morning or evening azkar, one card each. Tap a card to count it down; a
 * finished card folds away and the next one comes up. Finishing them all
 * logs the session — or log it straight away if you read from a book.
 */
export function AzkarSession({
  date,
  time,
  onTimeChange,
  done,
}: {
  date: string;
  time: AzkarTime;
  onTimeChange: (time: AzkarTime) => void;
  /** Already logged for this date and time. */
  done: boolean;
}) {
  const queryClient = useQueryClient();
  const items = useMemo(() => azkarFor(time), [time]);
  const [left, setLeft] = useProgress(`azkar:${date}:${time}`);
  const cardRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const remaining = (id: string, count: number) => left[id] ?? count;
  const finished = items.filter(({ zikr }) => remaining(zikr.id, zikr.count) === 0).length;

  const log = useMutation({
    mutationFn: () => logDhikr({ log_date: date, kind: time, count: items.length }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: dhikrKeys.logs });
      toast.success(time === "morning" ? "Morning azkar logged." : "Evening azkar logged.");
    },
    onError: (error) => toast.error(toError(error).message),
  });

  function tap(id: string, count: number, index: number) {
    const now = remaining(id, count);
    if (now === 0) return;
    const next = { ...left, [id]: now - 1 };
    setLeft(next);
    if (now - 1 > 0) {
      buzz(12);
      return;
    }
    buzz([30, 40, 30]);
    const upcoming = items.slice(index + 1).find(({ zikr }) => remaining(zikr.id, zikr.count) > 0);
    if (upcoming) {
      window.setTimeout(
        () =>
          cardRefs.current[upcoming.zikr.id]?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          }),
        150,
      );
    }
    const allDone = items.every(({ zikr }) =>
      zikr.id === id ? true : (next[zikr.id] ?? zikr.count) === 0,
    );
    if (allDone && !done && !log.isPending) log.mutate();
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="flex gap-1 rounded-lg bg-secondary p-1"
          role="radiogroup"
          aria-label="Which azkar"
        >
          {(
            [
              { value: "morning", label: "Morning · الصباح" },
              { value: "evening", label: "Evening · المساء" },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={time === option.value}
              onClick={() => onTimeChange(option.value)}
              className={cn(
                "min-h-10 rounded-md px-3 text-sm font-medium transition-colors",
                time === option.value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground tabular-nums">
          {done ? (
            <span className="inline-flex items-center gap-1 text-foreground">
              <Check className="size-4" /> Logged today
            </span>
          ) : (
            `${finished} of ${items.length} read`
          )}
        </p>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${(finished / items.length) * 100}%` }}
        />
      </div>

      <p className="text-xs text-muted-foreground">Tap a card each time you say it.</p>

      <ol className="space-y-3">
        {items.map(({ zikr, text }, index) => {
          const count = remaining(zikr.id, zikr.count);
          const complete = count === 0;
          return (
            <li key={zikr.id}>
              <button
                type="button"
                ref={(element) => {
                  cardRefs.current[zikr.id] = element;
                }}
                onClick={() => tap(zikr.id, zikr.count, index)}
                aria-label={`${zikr.title}: ${complete ? "done" : `${count} left`}`}
                className={cn(
                  "w-full rounded-xl border border-border bg-card p-4 text-start transition-[opacity,transform] active:scale-[0.99]",
                  complete && "opacity-50",
                )}
              >
                <span className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>{zikr.title}</span>
                  <span
                    className={cn(
                      "inline-flex min-w-12 items-center justify-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums",
                      complete
                        ? "bg-secondary text-muted-foreground"
                        : "bg-primary/15 text-foreground",
                    )}
                  >
                    {complete ? <Check className="size-3.5" /> : count}
                    {!complete && zikr.count > 1 ? (
                      <span className="font-normal">/ {zikr.count}</span>
                    ) : null}
                  </span>
                </span>
                {!complete ? (
                  <span
                    dir="rtl"
                    lang="ar"
                    className="mt-3 block font-arabic text-xl leading-[2.1] text-foreground"
                  >
                    {text}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap gap-2">
        {!done ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => log.mutate()}
            disabled={log.isPending}
          >
            <Check className="size-4" /> Log as read
          </Button>
        ) : null}
        <Button type="button" variant="ghost" onClick={() => setLeft({})}>
          <RotateCcw className="size-4" /> Start again
        </Button>
      </div>
    </section>
  );
}
