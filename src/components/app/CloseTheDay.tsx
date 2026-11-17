import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, MoonStar } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { carryOver, isEvening, moveToTomorrow, restoreTasks } from "@/data/closeDay";
import { completeTask, taskKeys, tasksQuery, type Task } from "@/data/tasks";
import { usePreferences } from "@/hooks/usePreferences";
import { todayISO } from "@/lib/date";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const count = (n: number) => `${n} ${n === 1 ? t("task") : t("tasks")}`;

/**
 * The evening step of the daily review: what is still open from today (and
 * before), ticked by default, moved to tomorrow in one tap, with undo.
 */
export function CloseTheDay({ className }: { className?: string }) {
  const queryClient = useQueryClient();
  const tasks = useQuery(tasksQuery());
  const { fmtShortDate } = usePreferences();
  const today = todayISO();
  const open = carryOver(tasks.data ?? [], today);
  // Ticked unless the user unticks it, so new tasks start ticked too.
  const [unticked, setUnticked] = useState<Set<string>>(new Set());
  const chosen = open.filter((task) => !unticked.has(task.id));

  const refresh = () => void queryClient.invalidateQueries({ queryKey: taskKeys.all });
  const onError = (error: unknown) =>
    toast.error(error instanceof Error ? error.message : t("Something went wrong."));

  const undo = useMutation({
    mutationFn: (previous: Task[]) => restoreTasks(previous),
    onSuccess: refresh,
    onError,
  });
  const move = useMutation({
    mutationFn: (list: Task[]) => moveToTomorrow(list, today),
    onSuccess: (previous) => {
      refresh();
      toast.success(`${count(previous.length)} ${t("moved to tomorrow")}`, {
        action: { label: t("Undo"), onClick: () => undo.mutate(previous) },
      });
    },
    onError,
  });
  const finish = useMutation({
    mutationFn: (id: string) => completeTask(id),
    onSuccess: refresh,
    onError,
  });

  if (tasks.isLoading || tasks.error) return null;

  return (
    <section className={cn("stat-card p-4 sm:p-5", className)} aria-label={t("Close the day")}>
      <h2 className="section-title flex items-center gap-2">
        <MoonStar className="size-4" aria-hidden /> {t("Close the day")}
      </h2>
      {open.length ? (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("Still open from today and before. Untick anything you'd rather keep where it is.")}
          </p>
          <ul className="mt-3 space-y-1.5">
            {open.map((task) => {
              const on = !unticked.has(task.id);
              return (
                <li key={task.id} className="flex min-h-11 items-center gap-3">
                  <input
                    type="checkbox"
                    className="size-5 shrink-0 accent-primary"
                    checked={on}
                    aria-label={`${t("Move")} ${task.title}`}
                    onChange={() =>
                      setUnticked((current) => {
                        const next = new Set(current);
                        if (next.has(task.id)) next.delete(task.id);
                        else next.add(task.id);
                        return next;
                      })
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{task.title}</span>
                    {task.due_date && task.due_date < today ? (
                      <span className="text-xs text-muted-foreground">
                        {`${t("Dated")} ${fmtShortDate(task.due_date)}`}
                      </span>
                    ) : null}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={finish.isPending}
                    onClick={() => finish.mutate(task.id)}
                  >
                    <Check className="size-4" /> {t("Done")}
                  </Button>
                </li>
              );
            })}
          </ul>
          <Button
            className="mt-4 h-11 w-full sm:w-auto"
            disabled={!chosen.length || move.isPending}
            onClick={() => move.mutate(chosen)}
          >
            {`${t("Move")} ${count(chosen.length)} ${t("to tomorrow")}`}
          </Button>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          {t("Nothing dated today is still open. Tomorrow starts clear.")}
        </p>
      )}
    </section>
  );
}

/** On Today, from the evening: a quiet way into the daily review. */
export function CloseTheDayPrompt({ className }: { className?: string }) {
  const tasks = useQuery(tasksQuery());
  if (!isEvening()) return null;
  const open = carryOver(tasks.data ?? [], todayISO()).length;
  return (
    <Link
      to="/review"
      className={cn(
        "flex min-h-14 items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-secondary",
        className,
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        <MoonStar className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0">
          <span className="block text-sm font-medium">{t("Close the day")}</span>
          <span className="block text-xs text-muted-foreground">
            {open
              ? `${count(open)} ${t("still open · see your day and move them on")}`
              : t("See your day and write a line about it")}
          </span>
        </span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" aria-hidden />
    </Link>
  );
}
