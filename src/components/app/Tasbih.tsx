import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TASBIH_PHRASES, TASBIH_TARGETS, dhikrKeys, logDhikr } from "@/data/azkar";
import { toError } from "@/lib/supabase-helpers";
import { cn } from "@/lib/utils";

const STORE = "tasbih:current";

type Current = { phrase: string; target: number | null; count: number };

function readCurrent(): Current {
  try {
    const value = JSON.parse(localStorage.getItem(STORE) ?? "null") as Current | null;
    if (value && typeof value.count === "number") return value;
  } catch {
    // Start fresh.
  }
  return { phrase: TASBIH_PHRASES[0], target: 33, count: 0 };
}

const buzz = (pattern: number | number[]) => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // No vibration here.
  }
};

/**
 * An electronic tasbih: one big button to count, a buzz on every tap and a
 * longer one at the target. The count stays on the device until you save it
 * to your record or start again.
 */
export function Tasbih({ date, todayTotal }: { date: string; todayTotal: number }) {
  const queryClient = useQueryClient();
  const [current, setCurrent] = useState<Current>(() => readCurrent());
  const [custom, setCustom] = useState("");
  const { phrase, target, count } = current;

  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(current));
    } catch {
      // Not kept in private mode.
    }
  }, [current]);

  const save = useMutation({
    mutationFn: () => logDhikr({ log_date: date, kind: "tasbih", count, label: phrase }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: dhikrKeys.logs });
      toast.success(`${count} saved.`);
      setCurrent((value) => ({ ...value, count: 0 }));
    },
    onError: (error) => toast.error(toError(error).message),
  });

  function tap() {
    const next = count + 1;
    setCurrent((value) => ({ ...value, count: next }));
    if (target && next % target === 0) buzz([60, 60, 120]);
    else buzz(10);
  }

  const rounds = target ? Math.floor(count / target) : 0;
  const inRound = target ? count % target : count;
  const progress = target ? inRound / target : 0;
  const circumference = 2 * Math.PI * 46;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Dhikr">
        {TASBIH_PHRASES.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={phrase === option}
            dir="rtl"
            lang="ar"
            onClick={() => setCurrent((value) => ({ ...value, phrase: option }))}
            className={cn(
              "min-h-10 rounded-full border px-3 font-arabic text-base transition-colors",
              phrase === option
                ? "border-primary bg-primary/15 text-foreground"
                : "border-border text-muted-foreground",
            )}
          >
            {option}
          </button>
        ))}
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (custom.trim()) setCurrent((value) => ({ ...value, phrase: custom.trim() }));
            setCustom("");
          }}
        >
          <Input
            aria-label="Your own dhikr"
            placeholder="Your own…"
            dir="auto"
            className="h-10 w-36"
            value={custom}
            onChange={(event) => setCustom(event.target.value)}
          />
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Target</span>
        {[...TASBIH_TARGETS, null].map((option) => (
          <button
            key={option ?? "none"}
            type="button"
            onClick={() => setCurrent((value) => ({ ...value, target: option }))}
            className={cn(
              "min-h-9 rounded-md px-3 tabular-nums transition-colors",
              target === option
                ? "bg-secondary font-semibold text-foreground"
                : "text-muted-foreground",
            )}
          >
            {option ?? "None"}
          </button>
        ))}
      </div>

      <div className="flex flex-col items-center gap-3 py-2">
        <p dir="rtl" lang="ar" className="text-center font-arabic text-2xl leading-loose">
          {phrase}
        </p>
        <button
          type="button"
          onClick={tap}
          aria-label={`Count. ${count} so far.`}
          className="relative grid size-64 max-w-[80vw] place-items-center rounded-full bg-card shadow-sm ring-1 ring-border transition-transform select-none active:scale-[0.97] [touch-action:manipulation]"
        >
          <svg
            viewBox="0 0 100 100"
            className="absolute inset-0 size-full -rotate-90"
            aria-hidden="true"
          >
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              strokeWidth="3"
              className="stroke-secondary"
            />
            {target ? (
              <circle
                cx="50"
                cy="50"
                r="46"
                fill="none"
                strokeWidth="3"
                strokeLinecap="round"
                className="stroke-primary transition-[stroke-dashoffset] duration-150"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - progress)}
              />
            ) : null}
          </svg>
          <span className="text-center">
            <span className="block text-6xl font-semibold tabular-nums">{count}</span>
            {target ? (
              <span className="mt-1 block text-sm text-muted-foreground tabular-nums">
                {inRound} / {target}
                {rounds ? ` · ${rounds} ${rounds === 1 ? "round" : "rounds"}` : ""}
              </span>
            ) : null}
          </span>
        </button>
        <p className="text-xs text-muted-foreground">Tap the circle. It buzzes at the target.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={() => save.mutate()}
          disabled={count === 0 || save.isPending}
        >
          <Save className="size-4" /> Save to today
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setCurrent((value) => ({ ...value, count: 0 }))}
          disabled={count === 0}
        >
          <RotateCcw className="size-4" /> Start again
        </Button>
        <span className="ms-auto text-sm text-muted-foreground tabular-nums">
          Saved today: {todayTotal}
        </span>
      </div>
    </section>
  );
}
