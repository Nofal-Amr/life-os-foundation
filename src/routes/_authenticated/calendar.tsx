import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { DateTimePicker } from "@/components/app/DatePicker";
import { EntityIcon } from "@/components/app/EntityIdentity";
import { FormDialog } from "@/components/app/FormDialog";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createEvent,
  deleteEvent,
  eventKeys,
  eventsQuery,
  updateEvent,
  type CalendarEvent,
  type EventInput,
} from "@/data/events";
import { recurringCostsQuery } from "@/data/finance";
import { goalsQuery } from "@/data/goals";
import { healthLogsQuery } from "@/data/health";
import { projectsQuery } from "@/data/projects";
import { isOpen, tasksQuery } from "@/data/tasks";
import { usePreferences } from "@/hooks/usePreferences";
import { isoToLocalInput, localInputToISO } from "@/lib/date";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar — Life OS" },
      { name: "description", content: "Everything with a date, in one month view." },
      { property: "og:title", content: "Calendar — Life OS" },
      { property: "og:description", content: "Everything with a date, in one month view." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CalendarPage,
});

type FormState = { title: string; description: string | null; start: string; end: string };

const emptyForm: FormState = { title: "", description: null, start: "", end: "" };

type SourceId = "events" | "tasks" | "projects" | "goals" | "costs" | "health";

const SOURCES: { id: SourceId; label: string; dot: string; text: string }[] = [
  { id: "events", label: "Events", dot: "bg-chart-1", text: "text-chart-1" },
  { id: "tasks", label: "Tasks", dot: "bg-chart-2", text: "text-chart-2" },
  { id: "projects", label: "Projects", dot: "bg-chart-3", text: "text-chart-3" },
  { id: "goals", label: "Goals", dot: "bg-chart-4", text: "text-chart-4" },
  { id: "costs", label: "Recurring costs", dot: "bg-chart-5", text: "text-chart-5" },
  { id: "health", label: "Health logs", dot: "bg-primary", text: "text-primary" },
];

type DayItem = {
  id: string;
  source: SourceId;
  date: string;
  title: string;
  detail: string;
  to: string;
  projected?: boolean;
  icon?: { icon: string | null; color: string | null } | null;
  event?: CalendarEvent;
};

function CalendarPage() {
  const queryClient = useQueryClient();
  const { fmtDateTime, fmtDate, fmtMoney } = usePreferences();
  const events = useQuery(eventsQuery());
  const tasks = useQuery(tasksQuery());
  const projects = useQuery(projectsQuery());
  const goals = useQuery(goalsQuery());
  const costs = useQuery(recurringCostsQuery());
  const healthLogs = useQuery(healthLogsQuery());

  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<Date>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [toDelete, setToDelete] = useState<CalendarEvent | null>(null);
  const [hidden, setHidden] = useState<SourceId[]>([]);

  const queries = [events, tasks, projects, goals, costs, healthLogs];
  const loading = queries.some((query) => query.isLoading);
  const error = queries.find((query) => query.error)?.error;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: eventKeys.all });
  const onError = (e: unknown) =>
    toast.error(e instanceof Error ? e.message : "Something went wrong.");

  const save = useMutation({
    mutationFn: async () => {
      const payload: EventInput = {
        title: form.title,
        description: form.description,
        start_at: localInputToISO(form.start),
        end_at: form.end ? localInputToISO(form.end) : null,
      };
      return editing ? updateEvent(editing.id, payload) : createEvent(payload);
    },
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      toast.success(editing ? "Event updated." : "Event created.");
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteEvent(id),
    onSuccess: () => {
      invalidate();
      setToDelete(null);
      toast.success("Event deleted.");
    },
    onError,
  });

  function openCreate(day: Date) {
    setEditing(null);
    const start = new Date(day);
    start.setHours(9, 0, 0, 0);
    setForm({ ...emptyForm, start: isoToLocalInput(start.toISOString()) });
    setDialogOpen(true);
  }

  function openEdit(event: CalendarEvent) {
    setEditing(event);
    setForm({
      title: event.title,
      description: event.description,
      start: isoToLocalInput(event.start_at),
      end: isoToLocalInput(event.end_at),
    });
    setDialogOpen(true);
  }

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });

  /* Everything with a date, from real rows only. */
  const items: DayItem[] = [];

  for (const event of events.data ?? []) {
    items.push({
      id: `event-${event.id}`,
      source: "events",
      date: format(new Date(event.start_at), "yyyy-MM-dd"),
      title: event.title,
      detail: `Event · ${fmtDateTime(event.start_at)}`,
      to: "/calendar",
      event,
    });
  }

  for (const task of tasks.data ?? []) {
    if (!task.due_date) continue;
    const project = (projects.data ?? []).find((item) => item.id === task.project_id);
    items.push({
      id: `task-${task.id}`,
      source: "tasks",
      date: task.due_date,
      title: task.title,
      detail: `Task${project ? ` · ${project.name}` : ""}${isOpen(task) ? "" : " · done"}`,
      to: "/tasks",
      icon: project ? { icon: project.icon, color: project.color } : null,
    });
  }

  for (const project of projects.data ?? []) {
    if (!project.due_date) continue;
    items.push({
      id: `project-${project.id}`,
      source: "projects",
      date: project.due_date,
      title: project.name,
      detail: "Project due",
      to: "/projects",
      icon: { icon: project.icon, color: project.color },
    });
  }

  for (const goal of goals.data ?? []) {
    if (!goal.target_date) continue;
    items.push({
      id: `goal-${goal.id}`,
      source: "goals",
      date: goal.target_date,
      title: goal.name,
      detail: "Goal target",
      to: "/goals",
      icon: { icon: goal.icon, color: goal.color },
    });
  }

  for (const cost of costs.data ?? []) {
    if (!cost.active) continue;
    items.push({
      id: `cost-${cost.id}`,
      source: "costs",
      date: cost.next_due_date,
      title: cost.name,
      detail: `Recurring cost · projected · ${fmtMoney(Math.abs(Number(cost.amount)))}`,
      to: "/finance/recurring",
      projected: true,
    });
  }

  for (const log of healthLogs.data ?? []) {
    items.push({
      id: `health-${log.id}`,
      source: "health",
      date: log.log_date,
      title: "Health logged",
      detail: `Health log · ${fmtDate(log.log_date)}`,
      to: "/health",
    });
  }

  const visible = items.filter((item) => !hidden.includes(item.source));
  const itemsOn = (day: Date) =>
    visible.filter((item) => isSameDay(new Date(`${item.date}T00:00:00`), day));
  const selectedItems = itemsOn(selected);
  const sourceOf = (id: SourceId) => SOURCES.find((source) => source.id === id)!;

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Events, task due dates, projects, goals, recurring costs and health logs."
        actions={<Button onClick={() => openCreate(selected)}>New event</Button>}
      />

      {loading ? (
        <LoadingState rows={4} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => queries.forEach((query) => query.refetch())} />
      ) : (
        <div className="space-y-8">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Show or hide sources">
            {SOURCES.map((source) => {
              const on = !hidden.includes(source.id);
              return (
                <Button
                  key={source.id}
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-pressed={on}
                  className={cn("min-h-10 rounded-full px-3 text-xs", on ? "border-primary" : "opacity-60")}
                  onClick={() =>
                    setHidden((current) =>
                      current.includes(source.id)
                        ? current.filter((id) => id !== source.id)
                        : [...current, source.id],
                    )
                  }
                >
                  <span className={cn("size-2 rounded-full", source.dot)} aria-hidden="true" />
                  {source.label}
                  <span className="sr-only">{on ? " shown" : " hidden"}</span>
                </Button>
              );
            })}
          </div>

          <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Previous month"
                onClick={() => setMonth(subMonths(month, 1))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <p className="text-sm font-medium">{format(month, "MMMM yyyy")}</p>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Next month"
                onClick={() => setMonth(addMonths(month, 1))}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] uppercase tracking-wide text-muted-foreground">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((day) => {
                const dayItems = itemsOn(day);
                const isSelected = isSameDay(day, selected);
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => setSelected(day)}
                    className={cn(
                      "flex min-h-16 min-w-0 flex-col items-start rounded-lg border p-1.5 text-left text-xs transition-colors",
                      isSelected ? "border-primary bg-accent" : "border-transparent hover:bg-accent/60",
                      isSameMonth(day, month) ? "" : "opacity-40",
                    )}
                  >
                    <span className="tabular-nums">{format(day, "d")}</span>
                    {dayItems.slice(0, 2).map((item) => (
                      <span
                        key={item.id}
                        className={cn(
                          "mt-1 flex w-full min-w-0 items-center gap-1",
                          sourceOf(item.source).text,
                          item.projected ? "italic" : "",
                        )}
                      >
                        <span
                          className={cn("size-1.5 shrink-0 rounded-full", sourceOf(item.source).dot)}
                          aria-hidden="true"
                        />
                        <span className="truncate">{item.title}</span>
                      </span>
                    ))}
                    {dayItems.length > 2 ? (
                      <span className="mt-0.5 text-muted-foreground">+{dayItems.length - 2}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <section>
            <h2 className="mb-3 text-sm font-medium">{format(selected, "EEEE, d MMMM yyyy")}</h2>
            {selectedItems.length === 0 ? (
              <EmptyState
                title="Nothing on this day"
                description="Everything with a date — tasks, projects, goals, costs and events — shows up here so nothing stays out of sight."
                action={<Button onClick={() => openCreate(selected)}>New event</Button>}
              />
            ) : (
              <ul className="space-y-3">
                {selectedItems.map((item) => {
                  const source = sourceOf(item.source);
                  return (
                    <li key={item.id} className="rounded-xl border border-border bg-card p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          {item.icon ? (
                            <EntityIcon icon={item.icon.icon} color={item.icon.color} />
                          ) : (
                            <span
                              className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", source.dot)}
                              aria-hidden="true"
                            />
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-medium">{item.title}</p>
                            <p className={cn("mt-1 text-xs", source.text)}>{source.label}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
                            {item.event?.description ? (
                              <p className="mt-2 text-sm text-muted-foreground">
                                {item.event.description}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          {item.event ? (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => openEdit(item.event!)}>
                                Edit
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setToDelete(item.event!)}>
                                Delete
                              </Button>
                            </>
                          ) : (
                            <Button asChild size="sm" variant="ghost">
                              <Link to={item.to}>Open</Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? "Edit event" : "New event"}
        pending={save.isPending}
        onSubmit={() => save.mutate()}
      >
        <div className="space-y-2">
          <Label htmlFor="event-title">Title</Label>
          <Input
            id="event-title"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="event-description">Description</Label>
          <Textarea
            id="event-description"
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.target.value || null })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="event-start">Starts</Label>
            <DateTimePicker id="event-start" required value={form.start} onChange={(value) => setForm({ ...form, start: value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="event-end">Ends</Label>
            <DateTimePicker id="event-end" value={form.end} onChange={(value) => setForm({ ...form, end: value })} />
          </div>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete this event?"
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </>
  );
}
