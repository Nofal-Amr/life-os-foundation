import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  TimeGrid,
  type AllDayItem,
  type GridItem,
  type Mark,
} from "@/components/app/calendar/TimeGrid";
import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { DateTimePicker } from "@/components/app/DatePicker";
import { EntityIcon } from "@/components/app/EntityIdentity";
import { FormDialog } from "@/components/app/FormDialog";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/States";
import { useHolidays } from "@/components/app/Holidays";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { weekDays } from "@/data/calendarLayout";
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
import { PRAYER_NAMES, prayerLabel, prayerSettingsQuery } from "@/data/spirit";
import { isOpen, tasksQuery } from "@/data/tasks";
import { podEventsQuery, podsQuery } from "@/data/together";
import { usePreferences } from "@/hooks/usePreferences";
import { isoToLocalInput, localInputToISO } from "@/lib/date";
import { t } from "@/lib/i18n";
import { prayerTimesFor } from "@/lib/prayer";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar · Life OS" },
      { name: "description", content: "Everything with a date: month, week, day and schedule." },
    ],
  }),
  component: CalendarPage,
});

type View = "month" | "week" | "day" | "schedule";
const VIEWS: { value: View; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "schedule", label: "Schedule" },
];
const VIEW_KEY = "lifeos:calendar-view";

type FormState = { title: string; description: string | null; start: string; end: string };
const emptyForm: FormState = { title: "", description: null, start: "", end: "" };

type SourceId =
  "events" | "together" | "tasks" | "projects" | "goals" | "costs" | "health" | "holidays";

/** Each source's colour: a soft tint with a coloured edge, readable in both themes. */
const SOURCES: { id: SourceId; label: string; dot: string; tone: string }[] = [
  {
    id: "events",
    label: "Events",
    dot: "bg-chart-1",
    tone: "bg-chart-1/15 border-s-2 border-chart-1 text-foreground",
  },
  {
    id: "together",
    label: "Together",
    dot: "bg-chart-3",
    tone: "bg-chart-3/15 border-s-2 border-chart-3 text-foreground",
  },
  {
    id: "tasks",
    label: "Tasks",
    dot: "bg-chart-2",
    tone: "bg-chart-2/15 border-s-2 border-chart-2 text-foreground",
  },
  {
    id: "projects",
    label: "Projects",
    dot: "bg-chart-4",
    tone: "bg-chart-4/15 border-s-2 border-chart-4 text-foreground",
  },
  {
    id: "goals",
    label: "Goals",
    dot: "bg-chart-4",
    tone: "bg-chart-4/10 border-s-2 border-chart-4 text-foreground",
  },
  {
    id: "costs",
    label: "Recurring costs",
    dot: "bg-chart-5",
    tone: "bg-chart-5/10 text-foreground",
  },
  { id: "health", label: "Health logs", dot: "bg-primary", tone: "bg-primary/10 text-foreground" },
  {
    id: "holidays",
    label: "Holidays",
    dot: "bg-muted-foreground",
    tone: "bg-secondary text-muted-foreground",
  },
];
const sourceOf = (id: SourceId) => SOURCES.find((source) => source.id === id)!;

type Item = {
  id: string;
  source: SourceId;
  /** yyyy-MM-dd */
  date: string;
  title: string;
  detail: string;
  to: string;
  /** Timed items sit on the Week/Day grid; the rest go in the all-day strip. */
  start?: Date;
  end?: Date | null;
  projected?: boolean;
  icon?: { icon: string | null; color: string | null } | null;
  event?: CalendarEvent;
};

const dayKey = (date: Date) => format(date, "yyyy-MM-dd");

function readView(): View {
  try {
    const saved = localStorage.getItem(VIEW_KEY) as View | null;
    return saved && VIEWS.some((view) => view.value === saved) ? saved : "month";
  } catch {
    return "month";
  }
}

function CalendarPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { fmtDateTime, fmtDate, fmtMoney, weekStartsOn } = usePreferences();
  const holidays = useHolidays();
  const events = useQuery(eventsQuery());
  const tasks = useQuery(tasksQuery());
  const projects = useQuery(projectsQuery());
  const goals = useQuery(goalsQuery());
  const costs = useQuery(recurringCostsQuery());
  const healthLogs = useQuery(healthLogsQuery());
  const pods = useQuery(podsQuery());
  const podEvents = useQuery(podEventsQuery());
  const prayerSettings = useQuery(prayerSettingsQuery());

  const [view, setViewState] = useState<View>(readView);
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [toDelete, setToDelete] = useState<CalendarEvent | null>(null);
  // Health logs mark nearly every day; off by default so events stand out.
  const [hidden, setHidden] = useState<SourceId[]>(["health"]);
  const [showPrayers, setShowPrayers] = useState(true);

  const setView = (next: View) => {
    setViewState(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // This visit only.
    }
  };

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
      toast.success(editing ? t("Event updated.") : t("Event created."));
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteEvent(id),
    onSuccess: () => {
      invalidate();
      setToDelete(null);
      toast.success(t("Event deleted."));
    },
    onError,
  });

  function openCreate(at: Date, timed = false) {
    setEditing(null);
    const start = new Date(at);
    if (!timed) start.setHours(9, 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60_000);
    setForm({
      ...emptyForm,
      start: isoToLocalInput(start.toISOString()),
      end: isoToLocalInput(end.toISOString()),
    });
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

  /* Everything with a date, from real rows only. */
  const items = useMemo(() => {
    const list: Item[] = [];
    for (const event of events.data ?? []) {
      const start = new Date(event.start_at);
      const midnight = start.getHours() === 0 && start.getMinutes() === 0 && !event.end_at;
      list.push({
        id: `event-${event.id}`,
        source: "events",
        date: dayKey(start),
        title: event.title,
        detail: `${t("Event")} · ${fmtDateTime(event.start_at)}`,
        to: "/calendar",
        ...(midnight ? {} : { start, end: event.end_at ? new Date(event.end_at) : null }),
        event,
      });
    }
    const podName = (id: string) => (pods.data ?? []).find((pod) => pod.id === id)?.name ?? "";
    for (const event of podEvents.data ?? []) {
      const start = new Date(event.starts_at);
      list.push({
        id: `pod-${event.id}`,
        source: "together",
        date: dayKey(start),
        title: event.title,
        detail: `${t("Together")} · ${podName(event.pod_id)}`,
        to: "/together",
        ...(event.all_day ? {} : { start, end: event.ends_at ? new Date(event.ends_at) : null }),
      });
    }
    for (const task of tasks.data ?? []) {
      if (!task.due_date || task.parent_task_id) continue;
      const project = (projects.data ?? []).find((item) => item.id === task.project_id);
      const start = task.due_time ? new Date(`${task.due_date}T${task.due_time}`) : null;
      list.push({
        id: `task-${task.id}`,
        source: "tasks",
        date: task.due_date,
        title: isOpen(task) ? task.title : `✓ ${task.title}`,
        detail: `${t("Task")}${project ? ` · ${project.name}` : ""}${isOpen(task) ? "" : ` · ${t("done")}`}`,
        to: "/tasks",
        ...(start && !Number.isNaN(start.getTime()) ? { start, end: null } : {}),
        icon: project ? { icon: project.icon, color: project.color } : null,
      });
    }
    for (const project of projects.data ?? []) {
      if (!project.due_date) continue;
      list.push({
        id: `project-${project.id}`,
        source: "projects",
        date: project.due_date,
        title: project.name,
        detail: t("Project due"),
        to: "/projects",
        icon: { icon: project.icon, color: project.color },
      });
    }
    for (const goal of goals.data ?? []) {
      if (!goal.target_date) continue;
      list.push({
        id: `goal-${goal.id}`,
        source: "goals",
        date: goal.target_date,
        title: goal.name,
        detail: t("Goal target"),
        to: "/goals",
        icon: { icon: goal.icon, color: goal.color },
      });
    }
    for (const cost of costs.data ?? []) {
      if (!cost.active) continue;
      list.push({
        id: `cost-${cost.id}`,
        source: "costs",
        date: cost.next_due_date,
        title: cost.name,
        detail: `${t("Recurring cost")} · ${t("projected")} · ${fmtMoney(Math.abs(Number(cost.amount)))}`,
        to: "/finance/recurring",
        projected: true,
      });
    }
    for (const log of healthLogs.data ?? []) {
      list.push({
        id: `health-${log.id}`,
        source: "health",
        date: log.log_date,
        title: t("Health logged"),
        detail: `${t("Health log")} · ${fmtDate(log.log_date)}`,
        to: "/health",
      });
    }
    for (const holiday of holidays) {
      list.push({
        id: `holiday-${holiday.date}-${holiday.name}`,
        source: "holidays",
        date: holiday.date,
        title: holiday.name,
        detail:
          holiday.kind === "islamic"
            ? `${holiday.localName ?? t("Islamic occasion")} · ${t("expected")}`
            : (holiday.localName ?? t("Public holiday")),
        to: "/settings",
      });
    }
    return list;
  }, [
    events.data,
    podEvents.data,
    pods.data,
    tasks.data,
    projects.data,
    goals.data,
    costs.data,
    healthLogs.data,
    holidays,
    fmtDateTime,
    fmtDate,
    fmtMoney,
  ]);

  const visible = items.filter((item) => !hidden.includes(item.source));
  const byDay = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const item of visible) {
      const list = map.get(item.date) ?? [];
      list.push(item);
      map.set(item.date, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.start?.getTime() ?? 0) - (b.start?.getTime() ?? 0));
    }
    return map;
  }, [visible]);
  const itemsOn = (day: Date) => byDay.get(dayKey(day)) ?? [];
  const byId = new Map(visible.map((item) => [item.id, item]));

  const prayerMarks = (day: Date): Mark[] => {
    const settings = prayerSettings.data;
    if (!showPrayers || settings?.latitude == null || settings.longitude == null) return [];
    const times = prayerTimesFor(
      settings.latitude,
      settings.longitude,
      settings.calc_method,
      settings.asr_school,
      dayKey(day),
    );
    return PRAYER_NAMES.map((name) => ({ label: prayerLabel(name, dayKey(day)), at: times[name] }));
  };

  const openItem = (id: string) => {
    const item = byId.get(id);
    if (!item) return;
    if (item.event) openEdit(item.event);
    else void navigate({ to: item.to });
  };

  /* Moving through time, per view. */
  const step = (by: number) => {
    if (view === "month") setCursor(startOfMonth(addMonths(cursor, by)));
    else if (view === "week") setCursor(addDays(cursor, 7 * by));
    else if (view === "day") setCursor(addDays(cursor, by));
    else setCursor(addDays(cursor, 30 * by));
  };
  const week = weekDays(cursor, weekStartsOn);
  const title =
    view === "month"
      ? format(cursor, "MMMM yyyy")
      : view === "week"
        ? `${format(week[0]!, "d MMM")} – ${format(week[6]!, "d MMM yyyy")}`
        : view === "day"
          ? format(cursor, "EEEE, d MMMM")
          : `${format(cursor, "d MMM")} – ${format(addDays(cursor, 29), "d MMM yyyy")}`;

  const gridItems = (day: Date): GridItem[] =>
    itemsOn(day)
      .filter((item) => item.start)
      .map((item) => ({
        id: item.id,
        title: item.title,
        tone: sourceOf(item.source).tone,
        start: item.start!,
        end: item.end ?? null,
      }));
  const allDayItems = (day: Date): AllDayItem[] =>
    itemsOn(day)
      .filter((item) => !item.start)
      .map((item) => ({
        id: item.id,
        title: item.title,
        tone: sourceOf(item.source).tone,
        ...(item.projected ? { dashed: true } : {}),
      }));

  return (
    <>
      <PageHeader
        title="Calendar"
        actions={
          <Button onClick={() => openCreate(cursor)}>
            <Plus className="size-4" /> {t("New event")}
          </Button>
        }
      />

      {loading ? (
        <LoadingState rows={4} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => queries.forEach((query) => query.refetch())} />
      ) : (
        <div className="space-y-4">
          {/* Toolbar: Today, back/forward, the range, and the view. */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCursor(startOfDay(new Date()))}
            >
              {t("Today")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("Previous")}
              onClick={() => step(-1)}
            >
              <ChevronLeft className="size-5 rtl:rotate-180" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("Next")}
              onClick={() => step(1)}
            >
              <ChevronRight className="size-5 rtl:rotate-180" />
            </Button>
            <p className="min-w-0 flex-1 truncate text-base font-semibold">{title}</p>
            <div
              className="flex gap-1 rounded-xl bg-secondary p-1"
              role="tablist"
              aria-label={t("View")}
            >
              {VIEWS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="tab"
                  aria-selected={view === option.value}
                  onClick={() => setView(option.value)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors sm:px-3 sm:text-sm",
                    view === option.value
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground",
                  )}
                >
                  {t(option.label)}
                </button>
              ))}
            </div>
          </div>

          {/* What's shown */}
          <div
            className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
            role="group"
            aria-label={t("Show or hide sources")}
          >
            {SOURCES.map((source) => {
              const on = !hidden.includes(source.id);
              return (
                <button
                  key={source.id}
                  type="button"
                  aria-pressed={on}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                    on
                      ? "border-border bg-card"
                      : "border-transparent text-muted-foreground opacity-60",
                  )}
                  onClick={() =>
                    setHidden((current) =>
                      current.includes(source.id)
                        ? current.filter((id) => id !== source.id)
                        : [...current, source.id],
                    )
                  }
                >
                  <span className={cn("size-2 rounded-full", source.dot)} aria-hidden="true" />
                  {t(source.label)}
                </button>
              );
            })}
            {prayerSettings.data?.latitude != null ? (
              <button
                type="button"
                aria-pressed={showPrayers}
                onClick={() => setShowPrayers(!showPrayers)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                  showPrayers
                    ? "border-border bg-card"
                    : "border-transparent text-muted-foreground opacity-60",
                )}
              >
                <span
                  className="size-2 rounded-full border border-dashed border-primary"
                  aria-hidden="true"
                />
                {t("Prayer times")}
              </button>
            ) : null}
          </div>

          {view === "month" ? (
            <>
              <MonthView
                cursor={cursor}
                weekStartsOn={weekStartsOn}
                itemsOn={itemsOn}
                selected={selectedDay}
                onPick={setSelectedDay}
              />
              <section className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">{format(selectedDay, "EEEE, d MMMM")}</h2>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setCursor(selectedDay);
                      setView("day");
                    }}
                  >
                    {t("Open day")}
                  </Button>
                </div>
                {itemsOn(selectedDay).length ? (
                  <DayList items={itemsOn(selectedDay)} onEdit={openEdit} onDelete={setToDelete} />
                ) : (
                  <p className="text-sm text-muted-foreground">{t("Nothing on this day.")}</p>
                )}
              </section>
            </>
          ) : view === "week" || view === "day" ? (
            <TimeGrid
              days={view === "week" ? week : [cursor]}
              timed={gridItems}
              allDay={allDayItems}
              marks={prayerMarks}
              onSlot={(at) => openCreate(at, true)}
              onItem={openItem}
              onDay={(day) => {
                setCursor(day);
                setView("day");
              }}
            />
          ) : (
            <ScheduleView from={cursor} itemsOn={itemsOn} onCreate={() => openCreate(cursor)} />
          )}

          {view === "day" ? (
            <DayList items={itemsOn(cursor)} onEdit={openEdit} onDelete={setToDelete} />
          ) : null}
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
            autoFocus
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="event-start">Starts</Label>
            <DateTimePicker
              id="event-start"
              required
              value={form.start}
              onChange={(value) => setForm({ ...form, start: value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="event-end">Ends</Label>
            <DateTimePicker
              id="event-end"
              value={form.end}
              onChange={(value) => setForm({ ...form, end: value })}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="event-description">Description</Label>
          <Textarea
            id="event-description"
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.target.value || null })}
          />
        </div>
        {editing ? (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive"
            onClick={() => {
              setDialogOpen(false);
              setToDelete(editing);
            }}
          >
            {t("Delete event")}
          </Button>
        ) : null}
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

/** Month: a grid of weeks with coloured chips, three a day, then "+N". */
function MonthView({
  cursor,
  weekStartsOn,
  itemsOn,
  selected,
  onPick,
}: {
  cursor: Date;
  weekStartsOn: number;
  itemsOn: (day: Date) => Item[];
  selected: Date;
  onPick: (day: Date) => void;
}) {
  const first = weekDays(startOfMonth(cursor), weekStartsOn)[0]!;
  const last = weekDays(endOfMonth(cursor), weekStartsOn)[6]!;
  const days = eachDayOfInterval({ start: first, end: last });
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="grid grid-cols-7 border-b border-border text-center text-2xs text-muted-foreground">
        {days.slice(0, 7).map((day) => (
          <div key={day.toISOString()} className="py-1.5">
            {t(format(day, "EEE"))}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const list = itemsOn(day);
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onPick(day)}
              aria-pressed={isSameDay(day, selected)}
              className={cn(
                "flex min-h-14 min-w-0 flex-col items-stretch gap-1 border-b border-s border-border/60 p-1 text-start sm:min-h-24",
                !isSameMonth(day, cursor) && "bg-secondary/40 text-muted-foreground",
                isSameDay(day, selected) && "bg-accent",
              )}
            >
              <span
                className={cn(
                  "grid size-6 place-items-center self-center rounded-full text-xs tabular-nums sm:self-start",
                  isToday(day) && "bg-primary font-semibold text-primary-foreground",
                )}
              >
                {format(day, "d")}
              </span>
              {/* Phones: a coloured bar per item (text doesn't fit); the day's list shows below. */}
              <span className="flex flex-col gap-0.5 sm:hidden">
                {list.slice(0, 4).map((item) => (
                  <span
                    key={item.id}
                    className={cn(
                      "h-1 rounded-full",
                      sourceOf(item.source).dot,
                      item.projected && "opacity-50",
                    )}
                  />
                ))}
              </span>
              {list.slice(0, 3).map((item) => (
                <span
                  key={item.id}
                  className={cn(
                    "hidden truncate rounded px-1 text-2xs leading-4 sm:block",
                    sourceOf(item.source).tone,
                    item.projected && "italic",
                  )}
                >
                  {item.start ? (
                    <span className="me-0.5 opacity-70">{format(item.start, "H:mm")}</span>
                  ) : null}
                  {item.title}
                </span>
              ))}
              {list.length > 3 ? (
                <span className="hidden px-1 text-[10px] text-muted-foreground sm:block">
                  +{list.length - 3}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Schedule: the next 30 days as a list, days with nothing skipped. */
function ScheduleView({
  from,
  itemsOn,
  onCreate,
}: {
  from: Date;
  itemsOn: (day: Date) => Item[];
  onCreate: () => void;
}) {
  const days = Array.from({ length: 30 }, (_, index) => addDays(from, index)).filter(
    (day) => itemsOn(day).length,
  );
  if (!days.length) {
    return (
      <EmptyState
        title="Nothing in the next 30 days"
        description="Events, due dates, costs and holidays show here as a list."
        action={<Button onClick={onCreate}>{t("New event")}</Button>}
      />
    );
  }
  return (
    <ol className="space-y-4">
      {days.map((day) => (
        <li key={day.toISOString()} className="flex gap-3">
          <div className="w-12 shrink-0 text-center">
            <p className="text-2xs text-muted-foreground">{t(format(day, "EEE"))}</p>
            <p
              className={cn(
                "mx-auto grid size-9 place-items-center rounded-full text-lg font-semibold tabular-nums",
                isToday(day) && "bg-primary text-primary-foreground",
              )}
            >
              {format(day, "d")}
            </p>
          </div>
          <ul className="min-w-0 flex-1 space-y-1.5">
            {itemsOn(day).map((item) => (
              <li
                key={item.id}
                className={cn("rounded-lg px-3 py-2 text-sm", sourceOf(item.source).tone)}
              >
                <p className="truncate font-medium">{item.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.start
                    ? `${format(item.start, "HH:mm")}${item.end ? `–${format(item.end, "HH:mm")}` : ""} · `
                    : ""}
                  {item.detail}
                </p>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

/** Day view: everything on the day as a list under the grid, with actions. */
function DayList({
  items,
  onEdit,
  onDelete,
}: {
  items: Item[];
  onEdit: (event: CalendarEvent) => void;
  onDelete: (event: CalendarEvent) => void;
}) {
  if (!items.length) return null;
  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const source = sourceOf(item.source);
        return (
          <li
            key={item.id}
            className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-3"
          >
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
                <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
                {item.event?.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">{item.event.description}</p>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              {item.event ? (
                <>
                  <Button size="sm" variant="ghost" onClick={() => onEdit(item.event!)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onDelete(item.event!)}>
                    Delete
                  </Button>
                </>
              ) : (
                <Button asChild size="sm" variant="ghost">
                  <Link to={item.to}>{t("Open")}</Link>
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
