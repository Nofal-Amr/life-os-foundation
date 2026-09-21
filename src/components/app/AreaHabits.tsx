import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { toast } from "sonner";

import { EntityIcon } from "@/components/app/EntityIdentity";
import { type HabitCategory, habitCategory } from "@/data/habitCategories";
import {
  habitKeys,
  habitLogsQuery,
  habitsQuery,
  logHabit,
  unlogHabit,
  type HabitLog,
} from "@/data/habits";
import { useXp } from "@/hooks/useXp";
import { todayISO } from "@/lib/date";
import { toError } from "@/lib/supabase-helpers";
import { cn } from "@/lib/utils";

/**
 * The habits that belong to one part of life, ticked right where you are:
 * Health habits on the Health page, Money habits on Money, and so on.
 * Renders nothing when that area has no habits.
 */
export function AreaHabits({
  category,
  title,
  date = todayISO(),
  className,
}: {
  category: HabitCategory;
  title: string;
  date?: string;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const habits = useQuery(habitsQuery());
  const logs = useQuery(habitLogsQuery());
  const xp = useXp();

  const toggle = useMutation({
    mutationFn: ({ habitId, done }: { habitId: string; done: boolean }) =>
      done ? unlogHabit(habitId, date) : logHabit(habitId, date),
    onMutate: async ({ habitId, done }) => {
      await queryClient.cancelQueries({ queryKey: habitKeys.logs });
      const previous = queryClient.getQueryData<HabitLog[]>(habitKeys.logs);
      queryClient.setQueryData<HabitLog[]>(habitKeys.logs, (rows = []) =>
        done
          ? rows.filter((row) => !(row.habit_id === habitId && row.log_date === date))
          : [{ id: `local-${habitId}-${date}`, habit_id: habitId, log_date: date } as HabitLog, ...rows],
      );
      return previous;
    },
    onSuccess: (_data, { done }) => {
      if (!done) xp.toast({ kind: "habit" });
    },
    onError: (error, _vars, previous) => {
      if (previous) queryClient.setQueryData(habitKeys.logs, previous);
      toast.error(toError(error).message);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: habitKeys.logs }),
  });

  const list = (habits.data ?? []).filter(
    (habit) => habit.active && habitCategory(habit) === category,
  );
  if (!list.length) return null;
  const allLogs = logs.data ?? [];

  return (
    <section className={cn("space-y-2", className)} aria-label={title}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="section-title">{title}</h2>
        <Link to="/habits" className="text-xs text-muted-foreground hover:text-foreground">
          All habits
        </Link>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {list.map((habit) => {
          const done = allLogs.some((log) => log.habit_id === habit.id && log.log_date === date);
          return (
            <li key={habit.id}>
              <button
                type="button"
                onClick={() => toggle.mutate({ habitId: habit.id, done })}
                aria-pressed={done}
                className="system-card flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left transition-[scale,background-color] duration-150 ease-out hover:bg-accent active:scale-[0.99]"
              >
                <EntityIcon icon={habit.icon} color={habit.color} />
                <span className={cn("min-w-0 flex-1 truncate text-sm font-medium", done && "text-muted-foreground line-through")}>
                  {habit.name}
                </span>
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border transition-colors duration-150",
                    done ? "border-primary bg-primary text-primary-foreground" : "border-border",
                  )}
                  aria-hidden="true"
                >
                  {done ? <Check className="size-4 animate-in zoom-in-50 duration-200 ease-out" /> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
