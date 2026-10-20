import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { addDays, format, parseISO } from "date-fns";
import { Check, ListChecks } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { StuckHelperDialog } from "@/components/app/StuckHelper";
import { Button } from "@/components/ui/button";
import { NOTE_TEMPLATES } from "@/data/noteTemplates";
import { createNote, noteKeys } from "@/data/notes";
import { stuckTasks } from "@/data/stuck";
import { isOpen, stepsOf, tasksQuery, topLevelTasks, type Task } from "@/data/tasks";
import { t } from "@/lib/i18n";
import { toError } from "@/lib/supabase-helpers";
import { cn } from "@/lib/utils";

/* Ticks are a per-device convenience, kept for the week they belong to. */
const KEY = "lifeos:weekly-reset";

function readTicks(week: string): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}") as {
      week?: string;
      done?: string[];
    };
    return saved.week === week ? (saved.done ?? []) : [];
  } catch {
    return [];
  }
}

function writeTicks(week: string, done: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ week, done }));
  } catch {
    // Kept for this visit only.
  }
}

/**
 * A short weekly reset, one step at a time and each acting on real data:
 * empty the inbox, decide on what has waited, re-date what's past its date,
 * look at the week ahead, and write the week's note. Steps with nothing to do
 * tick themselves.
 */
export function WeeklyReset({ week, today }: { week: string; today: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const tasks = useQuery(tasksQuery());
  const [done, setDone] = useState<string[]>(() => readTicks(week));
  const [helping, setHelping] = useState<Task | null>(null);

  const all = tasks.data ?? [];
  const top = topLevelTasks(all);
  const inbox = top.filter((task) => task.status === "inbox").length;
  const overdue = top.filter(
    (task) => isOpen(task) && task.due_date && task.due_date < today,
  ).length;
  const stuck = stuckTasks(all, today);
  const weekAhead = format(addDays(parseISO(today), 7), "yyyy-MM-dd");
  const comingUp = top.filter(
    (task) => isOpen(task) && task.due_date && task.due_date >= today && task.due_date <= weekAhead,
  ).length;

  const toggle = (id: string) => {
    const next = done.includes(id) ? done.filter((item) => item !== id) : [...done, id];
    setDone(next);
    writeTicks(week, next);
  };

  const writeNote = useMutation({
    mutationFn: () => {
      const template = NOTE_TEMPLATES.find((item) => item.id === "weekly-review")!;
      return createNote({
        title: template.title(new Date()),
        body: template.body ?? null,
        tags: template.tags ?? [],
      });
    },
    onSuccess: (note) => {
      void queryClient.invalidateQueries({ queryKey: noteKeys.all });
      if (!done.includes("note")) toggle("note");
      void navigate({ to: "/notes", search: { open: note.id } });
    },
    onError: (error: unknown) => toast.error(toError(error).message),
  });

  const steps: { id: string; title: string; detail: string; auto?: boolean; action?: ReactNode }[] =
    [
      {
        id: "inbox",
        title: t("Sort the inbox"),
        detail: inbox ? `${inbox} ${t("waiting to be sorted")}` : t("Nothing in the inbox."),
        auto: inbox === 0,
        action: inbox ? (
          <Button type="button" size="sm" variant="outline" asChild>
            <Link to="/tasks" search={{ filter: "inbox" }}>
              {t("Open the inbox")}
            </Link>
          </Button>
        ) : null,
      },
      {
        id: "stuck",
        title: t("Decide on what has waited"),
        detail: stuck.length
          ? `${stuck.length} ${t("tasks waiting two weeks or more")}`
          : t("Nothing has been waiting long."),
        auto: stuck.length === 0,
        action: stuck.length ? (
          <ul className="mt-2 space-y-1.5">
            {stuck.slice(0, 3).map((item) => (
              <li key={item.task.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">
                  {item.task.title}
                  <span className="ms-2 text-xs tabular-nums text-muted-foreground">
                    {item.days} {t("days")}
                  </span>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setHelping(item.task)}
                >
                  Help me start
                </Button>
              </li>
            ))}
          </ul>
        ) : null,
      },
      {
        id: "overdue",
        title: t("Give overdue tasks a real date"),
        detail: overdue ? `${overdue} ${t("past their date")}` : t("Nothing is past its date."),
        auto: overdue === 0,
        action: overdue ? (
          <Button type="button" size="sm" variant="outline" asChild>
            <Link to="/tasks" search={{ filter: "overdue" }}>
              {t("See them")}
            </Link>
          </Button>
        ) : null,
      },
      {
        id: "ahead",
        title: t("Look at the week ahead"),
        detail: `${comingUp} ${t("tasks due in the next 7 days")}`,
        action: (
          <Button type="button" size="sm" variant="outline" asChild>
            <Link to="/calendar">{t("Open the calendar")}</Link>
          </Button>
        ),
      },
      {
        id: "note",
        title: t("Write the week's note"),
        detail: t("What went well, what got in the way, and the one thing for next week."),
        action: (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={writeNote.isPending}
            onClick={() => writeNote.mutate()}
          >
            {t("Start the note")}
          </Button>
        ),
      },
    ];

  const finished = steps.filter((step) => step.auto || done.includes(step.id)).length;

  return (
    <section className="stat-card space-y-4 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="flex items-center gap-2 text-base font-semibold">
          <ListChecks className="size-4" /> {t("Weekly reset")}
        </p>
        <span className="text-xs tabular-nums text-muted-foreground">
          {finished} / {steps.length}
        </span>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        {t("Ten quiet minutes to start the week clear. Do as many steps as you like.")}
      </p>
      <ol className="space-y-3">
        {steps.map((step) => {
          const ticked = step.auto || done.includes(step.id);
          return (
            <li key={step.id} className="flex gap-3">
              <button
                type="button"
                aria-pressed={ticked}
                aria-label={step.title}
                disabled={step.auto}
                onClick={() => toggle(step.id)}
                className={cn(
                  "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border transition-colors",
                  ticked
                    ? "border-transparent bg-primary/20 text-foreground"
                    : "border-border text-transparent hover:border-primary/50",
                )}
              >
                <Check className="size-3.5" />
              </button>
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm font-medium", ticked && "text-muted-foreground")}>
                  {step.title}
                </p>
                <p className="text-xs text-muted-foreground">{step.detail}</p>
                {!ticked && step.action ? <div className="mt-2">{step.action}</div> : null}
              </div>
            </li>
          );
        })}
      </ol>
      <StuckHelperDialog
        task={helping}
        existingSteps={helping ? stepsOf(all, helping.id).length : 0}
        open={!!helping}
        onOpenChange={(open) => !open && setHelping(null)}
      />
    </section>
  );
}
