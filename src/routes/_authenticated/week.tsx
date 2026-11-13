import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { addDays, format, parseISO } from "date-fns";
import { CalendarClock, ChevronLeft, ChevronRight, Plus, Receipt } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Details } from "@/components/app/Details";
import { ListRow, RowCheck, RowList } from "@/components/app/ListRow";
import { PageHeader } from "@/components/app/PageHeader";
import { ErrorState, LoadingState } from "@/components/app/States";
import { WeeklyReset } from "@/components/app/WeeklyReset";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { eventsQuery } from "@/data/events";
import { recurringCostsQuery } from "@/data/finance";
import { projectsQuery } from "@/data/projects";
import { completeTask, taskKeys, tasksQuery, updateTask, type Task } from "@/data/tasks";
import { weekStart } from "@/data/week";
import { buildAhead, planPatch, plannable, type AheadDay } from "@/data/weekAhead";
import { useModules } from "@/hooks/useModules";
import { usePreferences } from "@/hooks/usePreferences";
import { todayISO } from "@/lib/date";
import { toError } from "@/lib/supabase-helpers";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/week")({
  head: () => ({
    meta: [
      { title: "Week · Life OS" },
      {
        name: "description",
        content: "The next seven days: what is due, what is on, and the bills to expect.",
      },
    ],
  }),
  component: WeekPage,
});

const iso = (date: Date) => format(date, "yyyy-MM-dd");

function WeekPage() {
  const today = todayISO();
  const { weekStartsOn } = usePreferences();
  const { enabled } = useModules();
  const [from, setFrom] = useState(today);
  const [planning, setPlanning] = useState<string | null>(null);

  const tasks = useQuery(tasksQuery());
  const events = useQuery({ ...eventsQuery(), enabled: enabled.includes("calendar") });
  const bills = useQuery({ ...recurringCostsQuery(), enabled: enabled.includes("money") });

  const days = useMemo(
    () =>
      buildAhead({
        from,
        today,
        tasks: tasks.data ?? [],
        events: enabled.includes("calendar") ? (events.data ?? []) : [],
        bills: enabled.includes("money") ? (bills.data ?? []) : [],
      }),
    [from, today, tasks.data, events.data, bills.data, enabled],
  );

  const range = `${format(parseISO(days[0]!.date), "d MMM")} – ${format(parseISO(days[6]!.date), "d MMM")}`;
  const startsToday = from === today;

  return (
    <>
      <PageHeader
        title="Week"
        description="The next seven days: what is due, what is on, and the bills to expect."
        actions={
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-11"
              aria-label="Seven days earlier"
              disabled={startsToday}
              onClick={() => setFrom(iso(addDays(parseISO(from), -7)))}
            >
              <ChevronLeft className="size-5" />
            </Button>
            {!startsToday ? (
              <Button variant="outline" size="sm" onClick={() => setFrom(today)}>
                From today
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              className="size-11"
              aria-label="Next seven days"
              onClick={() => setFrom(iso(addDays(parseISO(from), 7)))}
            >
              <ChevronRight className="size-5" />
            </Button>
          </div>
        }
      />

      {tasks.isLoading ? (
        <LoadingState rows={5} />
      ) : tasks.error ? (
        <ErrorState error={tasks.error} onRetry={() => tasks.refetch()} />
      ) : (
        <div className="space-y-6 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
          <p className="text-sm font-medium text-muted-foreground">{range}</p>

          <Details
            id="week-reset"
            title="Weekly reset"
            summary="Sort the inbox, decide on what has waited, plan the week."
          >
            <WeeklyReset week={weekStart(today, weekStartsOn)} today={today} />
          </Details>

          <ol className="space-y-4" aria-label="The next seven days">
            {days.map((day) => (
              <DayAhead
                key={day.date}
                day={day}
                today={today}
                onPlan={() => setPlanning(day.date)}
              />
            ))}
          </ol>

          <p className="text-sm text-muted-foreground">
            Looking back?{" "}
            <Link
              to="/insights"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Week by week is in Insights
            </Link>
            .
          </p>
        </div>
      )}

      <PlanDialog day={planning} tasks={tasks.data ?? []} onClose={() => setPlanning(null)} />
    </>
  );
}

function dayLabel(date: string, today: string) {
  if (date === today) return "Today";
  if (date === iso(addDays(parseISO(today), 1))) return "Tomorrow";
  return format(parseISO(date), "EEEE");
}

function DayAhead({ day, today, onPlan }: { day: AheadDay; today: string; onPlan: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const projects = useQuery(projectsQuery());
  const { fmtMoney, fmtTime } = usePreferences();
  const empty = !day.tasks.length && !day.events.length && !day.bills.length;

  const complete = useMutation({
    mutationFn: (id: string) => completeTask(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taskKeys.all }),
    onError: (error: unknown) => toast.error(toError(error).message),
  });

  return (
    <li className="space-y-2" aria-label={`${dayLabel(day.date, today)}, ${day.date}`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-baseline gap-2">
          <span className={cn("font-semibold", day.isToday && "text-primary")}>
            {dayLabel(day.date, today)}
          </span>
          <span className="text-sm text-muted-foreground">
            {format(parseISO(day.date), "d MMM")}
          </span>
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-11 text-muted-foreground"
          onClick={onPlan}
        >
          <Plus className="size-4" />
          Plan
        </Button>
      </div>

      {empty ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          Nothing planned yet.
        </p>
      ) : (
        <RowList>
          {day.tasks.map((task, index) => {
            const project = (projects.data ?? []).find((item) => item.id === task.project_id);
            return (
              <ListRow
                key={task.id}
                leading={
                  <RowCheck
                    done={false}
                    disabled={complete.isPending}
                    label={`Complete ${task.title}`}
                    onToggle={() => complete.mutate(task.id)}
                  />
                }
                title={<span className="min-w-0 truncate">{task.title}</span>}
                openLabel={`Open ${task.title}`}
                onOpen={() => void navigate({ to: "/tasks", hash: task.id })}
                meta={
                  <>
                    {index < day.fromEarlier ? (
                      <span>From {format(parseISO(task.due_date!), "d MMM")}</span>
                    ) : null}
                    {task.due_time ? <span>{task.due_time.slice(0, 5)}</span> : null}
                    {project ? <span className="truncate">{project.name}</span> : null}
                  </>
                }
              />
            );
          })}
          {day.events.map((event) => (
            <ListRow
              key={event.id}
              leading={
                <span className="flex size-11 items-center justify-center text-muted-foreground">
                  <CalendarClock className="size-5" aria-hidden />
                </span>
              }
              title={<span className="min-w-0 truncate">{event.title}</span>}
              openLabel={`Open ${event.title} in Calendar`}
              onOpen={() => void navigate({ to: "/calendar" })}
              meta={<span>{fmtTime(new Date(event.start_at))}</span>}
            />
          ))}
          {day.bills.map((bill) => (
            <ListRow
              key={bill.id}
              leading={
                <span className="flex size-11 items-center justify-center text-muted-foreground">
                  <Receipt className="size-5" aria-hidden />
                </span>
              }
              title={<span className="min-w-0 truncate">{bill.name}</span>}
              openLabel={`Open ${bill.name} in Recurring`}
              onOpen={() => void navigate({ to: "/finance/recurring" })}
              meta={<span>Expected, not logged yet</span>}
              trailing={<span className="font-medium">{fmtMoney(Number(bill.amount))}</span>}
            />
          ))}
        </RowList>
      )}
    </li>
  );
}

/** Pick a task to put on a day: from Unsorted, or one due later. */
function PlanDialog({
  day,
  tasks,
  onClose,
}: {
  day: string | null;
  tasks: Task[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { fmtDate } = usePreferences();
  const options = day ? plannable(tasks, day) : { unsorted: [], upcoming: [] };

  const plan = useMutation({
    mutationFn: (task: Task) => updateTask(task.id, planPatch(task, day!), task),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.all });
      toast.success(`Planned for ${day ? format(parseISO(day), "EEEE d MMM") : "that day"}.`);
      onClose();
    },
    onError: (error: unknown) => toast.error(toError(error).message),
  });

  const group = (title: string, list: Task[], hint: (task: Task) => string | null) =>
    list.length ? (
      <section className="space-y-1" aria-label={title}>
        <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
        <ul className="space-y-1">
          {list.map((task) => (
            <li key={task.id}>
              <button
                type="button"
                disabled={plan.isPending}
                onClick={() => plan.mutate(task)}
                className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 text-left text-sm transition-colors hover:bg-accent disabled:opacity-50"
              >
                <span className="min-w-0 truncate">{task.title}</span>
                {hint(task) ? (
                  <span className="shrink-0 text-xs text-muted-foreground">{hint(task)}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </section>
    ) : null;

  return (
    <Dialog open={day !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Plan for {day ? format(parseISO(day), "EEEE d MMM") : ""}</DialogTitle>
          <DialogDescription>Pick a task to do on this day.</DialogDescription>
        </DialogHeader>
        {options.unsorted.length || options.upcoming.length ? (
          <div className="space-y-4">
            {group("Unsorted", options.unsorted, () => null)}
            {group("Due later", options.upcoming, (task) => fmtDate(task.due_date))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nothing to plan: every open task already has an earlier day.{" "}
            <Link to="/tasks" className="font-medium text-primary">
              Add a task
            </Link>
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
