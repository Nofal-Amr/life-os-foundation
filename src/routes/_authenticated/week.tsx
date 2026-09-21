import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { Check, ChevronLeft, ChevronRight, ListChecks, Moon, Repeat, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/PageHeader";
import { PrayerTiles } from "@/components/app/PrayerLog";
import { SplitAcrossDaysDialog } from "@/components/app/SplitAcrossDays";
import { Ring, type ChartTone } from "@/components/app/StatCards";
import { ErrorState, LoadingState } from "@/components/app/States";
import { Button } from "@/components/ui/button";
import { transactionsQuery } from "@/data/finance";
import {
  habitKeys,
  habitLogsQuery,
  habitsQuery,
  logHabit,
  unlogHabit,
  type HabitLog,
} from "@/data/habits";
import { projectsQuery, type Project } from "@/data/projects";
import {
  PRAYER_LABELS,
  PRAYER_NAMES,
  clearPrayerLog,
  logPrayer,
  prayerLogsQuery,
  spiritKeys,
  type PrayerLog,
  type PrayerName,
} from "@/data/spirit";
import { completeTask, reopenTask, taskKeys, tasksQuery, type Task } from "@/data/tasks";
import {
  buildWeek,
  isDone,
  prayerCounts,
  shiftWeek,
  weekRecap,
  weekStart,
  type Fraction,
  type WeekDay,
} from "@/data/week";
import { useModules } from "@/hooks/useModules";
import { usePreferences } from "@/hooks/usePreferences";
import { todayISO } from "@/lib/date";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/week")({
  head: () => ({
    meta: [
      { title: "Week — Life OS" },
      { name: "description", content: "Your week, day by day: what was due and what you logged." },
    ],
  }),
  component: WeekPage,
});

const TASK_TONE: ChartTone = 1;
const HABIT_TONE: ChartTone = 2;
const PRAYER_TONE: ChartTone = 3;
const MONEY_TONE: ChartTone = 4;

function WeekPage() {
  const today = todayISO();
  const { fmtMoney, weekStartsOn } = usePreferences();
  const [start, setStart] = useState(() => weekStart(today, weekStartsOn));
  const [selected, setSelected] = useState(today);
  // Preferences load after first render; realign when the week start changes.
  useEffect(() => {
    setStart((current) => weekStart(current, weekStartsOn));
  }, [weekStartsOn]);
  const { enabled } = useModules();
  const trackPrayers = enabled.includes("spirit");
  const trackHabits = enabled.includes("habits");
  const trackMoney = enabled.includes("money");

  const tasks = useQuery(tasksQuery());
  const projects = useQuery(projectsQuery());
  const habits = useQuery(habitsQuery());
  const habitLogs = useQuery(habitLogsQuery());
  const prayerLogs = useQuery(prayerLogsQuery());
  const transactions = useQuery(transactionsQuery());

  const loading = tasks.isLoading || habits.isLoading || habitLogs.isLoading;
  const error = tasks.error ?? habits.error ?? habitLogs.error;

  const week = useMemo(
    () =>
      buildWeek({
        start,
        today,
        tasks: tasks.data ?? [],
        habits: trackHabits ? (habits.data ?? []) : [],
        habitLogs: habitLogs.data ?? [],
        prayerLogs: prayerLogs.data ?? [],
        transactions: trackMoney ? (transactions.data ?? []) : [],
        trackPrayers,
      }),
    [
      start,
      today,
      tasks.data,
      habits.data,
      habitLogs.data,
      prayerLogs.data,
      transactions.data,
      trackPrayers,
      trackHabits,
      trackMoney,
    ],
  );

  const selectedDay = week.days.find((day) => day.date === selected) ?? week.days[0]!;
  const range = `${format(parseISO(week.start), "d MMM")} – ${format(parseISO(week.end), "d MMM")}`;
  const isThisWeek = week.days.some((day) => day.isToday);

  function goWeek(offset: number) {
    const next = shiftWeek(start, offset);
    setStart(next);
    const nextHasToday = today >= next && today < shiftWeek(next, 1);
    setSelected(nextHasToday ? today : next);
  }

  return (
    <>
      <PageHeader
        title="Week"
        description="What was due each day, and what you logged."
        actions={
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Previous week"
              onClick={() => goWeek(-1)}
            >
              <ChevronLeft className="size-5" />
            </Button>
            {!isThisWeek ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStart(weekStart(today, weekStartsOn));
                  setSelected(today);
                }}
              >
                This week
              </Button>
            ) : null}
            <Button variant="ghost" size="icon" aria-label="Next week" onClick={() => goWeek(1)}>
              <ChevronRight className="size-5" />
            </Button>
          </div>
        }
      />

      {loading ? (
        <LoadingState rows={4} />
      ) : error ? (
        <ErrorState
          error={error}
          onRetry={() => {
            tasks.refetch();
            habits.refetch();
            habitLogs.refetch();
          }}
        />
      ) : (
        <div className="space-y-6 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Week summary */}
            <section className="stat-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {isThisWeek ? "This week" : "Week"}
                  </p>
                  <p className="mt-0.5 text-lg font-semibold tracking-tight">{range}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-4">
                <Ring
                  done={week.tasks.done}
                  total={week.tasks.total}
                  tone={TASK_TONE}
                  size={96}
                  stroke={10}
                  label={`${week.tasks.done} of ${week.tasks.total} tasks due this week are done`}
                >
                  <div>
                    <p className="text-xl font-semibold tabular-nums leading-none">
                      {week.tasks.total ? week.tasks.done : "—"}
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {week.tasks.total ? `of ${week.tasks.total}` : "none due"}
                    </p>
                  </div>
                </Ring>
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-sm font-medium">Tasks due this week</p>
                  <Meter value={week.tasks} tone={TASK_TONE} />
                  <div className="grid grid-cols-2 gap-2">
                    {trackHabits ? <Tile label="Habits" value={week.habits} /> : null}
                    {trackPrayers ? <Tile label="Prayers" value={week.prayers} /> : null}
                    {trackMoney ? (
                      <div className="rounded-lg bg-secondary px-2.5 py-1.5">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Spent
                        </p>
                        <p className="text-sm font-semibold tabular-nums">{fmtMoney(week.spent)}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>

            <DayBars
              title="Tasks done, day by day"
              icon={ListChecks}
              days={week.days}
              value={(day) => day.tasksDone.done}
              format={(value) => String(value)}
              tone={TASK_TONE}
              selected={selectedDay.date}
              onSelect={setSelected}
              empty="No tasks were due this week."
            />

            {trackMoney ? (
              <DayBars
                title="Spending, day by day"
                icon={Wallet}
                days={week.days}
                value={(day) => day.spent}
                format={(value) => fmtMoney(value)}
                tone={MONEY_TONE}
                selected={selectedDay.date}
                onSelect={setSelected}
                empty="No spending logged this week."
              />
            ) : null}
          </div>

          {/* Seven days: a scrolling strip on phones, a board on wide screens. */}
          <section aria-label="Days of the week">
            <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:grid lg:grid-cols-7 lg:overflow-visible lg:px-0">
              {week.days.map((day) => (
                <DayCard
                  key={day.date}
                  day={day}
                  active={day.date === selectedDay.date}
                  onSelect={() => setSelected(day.date)}
                />
              ))}
            </div>
          </section>

          <DayDetail
            day={selectedDay}
            projects={projects.data ?? []}
            habits={
              trackHabits
                ? (habits.data ?? []).filter((h) => h.active && h.frequency === "daily")
                : []
            }
            habitLogs={habitLogs.data ?? []}
            prayerLogs={trackPrayers ? (prayerLogs.data ?? []) : null}
          />

          <Recap lines={weekRecap(week, fmtMoney)} />
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ Pieces */

function Meter({ value, tone }: { value: Fraction; tone: ChartTone }) {
  const width = value.total ? Math.round((value.done / value.total) * 100) : 0;
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full"
      style={{ background: `color-mix(in oklch, var(--chart-${tone}) 16%, transparent)` }}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${width}%`, background: `var(--chart-${tone})` }}
      />
    </div>
  );
}

function Tile({ label, value }: { label: string; value: Fraction }) {
  return (
    <div className="rounded-lg bg-secondary px-2.5 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums">
        {value.total ? (
          <>
            {value.done}
            <span className="font-normal text-muted-foreground"> / {value.total}</span>
          </>
        ) : (
          <span className="font-normal text-muted-foreground">—</span>
        )}
      </p>
    </div>
  );
}

function DayBars({
  title,
  icon: Icon,
  days,
  value,
  format: formatValue,
  tone,
  selected,
  onSelect,
  empty,
}: {
  title: string;
  icon: typeof Wallet;
  days: WeekDay[];
  value: (day: WeekDay) => number;
  format: (value: number) => string;
  tone: ChartTone;
  selected: string;
  onSelect: (date: string) => void;
  empty: string;
}) {
  const values = days.map(value);
  const max = Math.max(...values, 0);
  const selectedValue = values[days.findIndex((day) => day.date === selected)] ?? 0;
  return (
    <section className="stat-card flex flex-col p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
          {title}
        </p>
      </div>
      {max === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <>
          <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">
            {formatValue(selectedValue)}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              on {format(parseISO(selected), "EEEE")}
            </span>
          </p>
          <div className="mt-4 grid flex-1 grid-cols-7 items-end gap-1.5" style={{ minHeight: 96 }}>
            {days.map((day, index) => {
              const height = max ? Math.max(4, (values[index]! / max) * 88) : 4;
              const active = day.date === selected;
              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => onSelect(day.date)}
                  aria-label={`${format(parseISO(day.date), "EEEE")}: ${formatValue(values[index]!)}`}
                  className="group flex h-full flex-col items-center justify-end gap-1.5 focus-visible:outline-none"
                >
                  <span
                    className="w-full max-w-7 rounded-md transition-all duration-300 group-focus-visible:ring-2 group-focus-visible:ring-ring"
                    style={{
                      height,
                      background: values[index]
                        ? `color-mix(in oklch, var(--chart-${tone}) ${active ? 100 : 55}%, transparent)`
                        : "var(--color-border)",
                    }}
                  />
                  <span
                    className={cn(
                      "text-[10px] uppercase",
                      active ? "font-semibold text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {format(parseISO(day.date), "EEEEE")}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function DayCard({
  day,
  active,
  onSelect,
}: {
  day: WeekDay;
  active: boolean;
  onSelect: () => void;
}) {
  const { done, total } = day.tasksDone;
  const label = total ? `${done}/${total} done` : "Nothing due";
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "stat-card flex w-28 shrink-0 snap-start flex-col items-center gap-2 p-3 text-center transition-[transform,box-shadow] duration-200 active:scale-[0.97] lg:w-auto",
        active && "ring-2 ring-primary",
      )}
    >
      <span
        className={cn(
          "text-xs",
          day.isToday ? "font-semibold text-primary" : "text-muted-foreground",
        )}
      >
        {day.isToday ? "Today" : format(parseISO(day.date), "EEE")} ·{" "}
        {format(parseISO(day.date), "d")}
      </span>
      <Ring
        done={done}
        total={total}
        tone={TASK_TONE}
        size={56}
        stroke={6}
        label={`${format(parseISO(day.date), "EEEE")}: ${label}`}
      >
        <span className="text-xs font-semibold tabular-nums">
          {total ? `${done}/${total}` : "—"}
        </span>
      </Ring>
      <span className="tone-quiet rounded-full border px-2 py-0.5 text-[10px] font-medium">
        {label}
      </span>
    </button>
  );
}

/* --------------------------------------------------------- Selected day */

function useOptimisticToggle<T>(key: QueryKey) {
  const queryClient = useQueryClient();
  return {
    async begin(update: (rows: T[]) => T[]) {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<T[]>(key);
      if (previous) queryClient.setQueryData<T[]>(key, update(previous));
      return previous;
    },
    rollback(previous: T[] | undefined) {
      if (previous) queryClient.setQueryData(key, previous);
    },
    settle() {
      void queryClient.invalidateQueries({ queryKey: key });
    },
  };
}

function DayDetail({
  day,
  projects,
  habits,
  habitLogs,
  prayerLogs,
}: {
  day: WeekDay;
  projects: Project[];
  habits: { id: string; name: string }[];
  habitLogs: HabitLog[];
  prayerLogs: PrayerLog[] | null;
}) {
  const taskToggle = useOptimisticToggle<Task>(taskKeys.all);
  const habitToggle = useOptimisticToggle<HabitLog>(habitKeys.logs);
  const onError = (error: unknown) =>
    toast.error(error instanceof Error ? error.message : "Couldn't save that.");

  const toggleTask = useMutation({
    mutationFn: async (task: Task) => {
      if (isDone(task)) await reopenTask(task.id);
      else await completeTask(task.id);
    },
    onMutate: (task) =>
      taskToggle.begin((rows) =>
        rows.map((row) =>
          row.id === task.id
            ? isDone(task)
              ? { ...row, status: "todo", completed_at: null }
              : { ...row, status: "completed", completed_at: new Date().toISOString() }
            : row,
        ),
      ),
    onError: (error, _task, previous) => {
      taskToggle.rollback(previous);
      onError(error);
    },
    onSettled: taskToggle.settle,
  });

  const toggleHabit = useMutation({
    mutationFn: async ({ habitId, logged }: { habitId: string; logged: boolean }) => {
      if (logged) await unlogHabit(habitId, day.date);
      else await logHabit(habitId, day.date);
    },
    onMutate: ({ habitId, logged }) =>
      habitToggle.begin((rows) =>
        logged
          ? rows.filter((row) => !(row.habit_id === habitId && row.log_date === day.date))
          : [
              { id: `local-${habitId}`, habit_id: habitId, log_date: day.date } as HabitLog,
              ...rows,
            ],
      ),
    onError: (error, _vars, previous) => {
      habitToggle.rollback(previous);
      onError(error);
    },
    onSettled: habitToggle.settle,
  });

  const groups = useMemo(() => {
    const byProject = new Map<string, Task[]>();
    for (const task of day.tasks) {
      const key = task.project_id ?? "none";
      byProject.set(key, [...(byProject.get(key) ?? []), task]);
    }
    return [...byProject.entries()].map(([key, items]) => ({
      key,
      project: projects.find((project) => project.id === key) ?? null,
      items: [...items].sort((a, b) => Number(isDone(a)) - Number(isDone(b))),
    }));
  }, [day.tasks, projects]);

  const title = day.isToday ? "Today" : format(parseISO(day.date), "EEEE");
  const logged = (habitId: string) =>
    habitLogs.some((log) => log.habit_id === habitId && log.log_date === day.date);
  const [splitting, setSplitting] = useState<Task | null>(null);

  return (
    <section aria-live="polite" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold">
          {title}{" "}
          <span className="font-normal text-muted-foreground">
            · {format(parseISO(day.date), "d MMMM")}
          </span>
        </h2>
        {day.tasksDone.total ? (
          <span className="tone-info rounded-full border px-2 py-0.5 text-[11px] font-medium tabular-nums">
            {day.tasksDone.done} / {day.tasksDone.total} done
          </span>
        ) : null}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {groups.length ? (
          groups.map((group) => (
            <div key={group.key} className="stat-card space-y-2 p-4">
              <div className="flex items-center gap-2">
                <span
                  className="size-2 rounded-full"
                  style={{ background: group.project?.color ?? "var(--color-muted-foreground)" }}
                  aria-hidden="true"
                />
                <p className="min-w-0 truncate text-sm font-semibold">
                  {group.project?.name ?? "No project"}
                </p>
                <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
                  {group.items.filter(isDone).length}/{group.items.length}
                </span>
              </div>
              <ul className="space-y-1.5">
                {group.items.map((task) => (
                  <li key={task.id}>
                    <CheckRow
                      checked={isDone(task)}
                      label={task.title}
                      hint={task.description}
                      onToggle={() => toggleTask.mutate(task)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))
        ) : (
          <div className="stat-card p-4 text-sm text-muted-foreground">
            Nothing due {day.isToday ? "today" : "this day"}.{" "}
            <Link to="/tasks" className="text-foreground underline underline-offset-4">
              Plan a task
            </Link>
          </div>
        )}

        {day.dueLater.length ? (
          <div className="stat-card space-y-2 p-4">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">Due later this week</p>
              <span className="ml-auto text-[11px] text-muted-foreground">can be done early</span>
            </div>
            <ul className="space-y-1.5">
              {day.dueLater.map((task) => (
                <li key={task.id} className="flex items-stretch gap-1.5">
                  <div className="min-w-0 flex-1">
                    <CheckRow
                      checked={false}
                      label={task.title}
                      hint={task.due_date ? `Due ${format(parseISO(task.due_date), "EEEE")}` : null}
                      onToggle={() => toggleTask.mutate(task)}
                    />
                  </div>
                  {!task.parent_task_id ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto shrink-0 px-2.5 text-xs text-muted-foreground"
                      onClick={() => setSplitting(task)}
                    >
                      Split
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {habits.length ? (
          <div className="stat-card space-y-2 p-4">
            <div className="flex items-center gap-2">
              <Repeat
                className="size-4"
                style={{ color: `var(--chart-${HABIT_TONE})` }}
                aria-hidden="true"
              />
              <p className="text-sm font-semibold">Daily habits</p>
              <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
                {day.habits.done}/{day.habits.total}
              </span>
            </div>
            <ul className="space-y-1.5">
              {habits.map((habit) => (
                <li key={habit.id}>
                  <CheckRow
                    checked={logged(habit.id)}
                    label={habit.name}
                    disabled={day.isFuture}
                    onToggle={() =>
                      toggleHabit.mutate({ habitId: habit.id, logged: logged(habit.id) })
                    }
                  />
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {prayerLogs ? (
          <div className="stat-card space-y-3 p-4">
            <div className="flex items-center gap-2">
              <Moon
                className="size-4"
                style={{ color: `var(--chart-${PRAYER_TONE})` }}
                aria-hidden="true"
              />
              <p className="text-sm font-semibold">Prayers</p>
              <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
                {day.prayers.done}/{day.prayers.total}
              </span>
            </div>
            <PrayerTiles date={day.date} logs={prayerLogs} disabled={day.isFuture} />
          </div>
        ) : null}
      </div>
      <SplitAcrossDaysDialog
        task={splitting}
        from={day.date}
        open={!!splitting}
        onOpenChange={(open) => !open && setSplitting(null)}
      />
    </section>
  );
}

function CheckRow({
  checked,
  label,
  hint,
  disabled,
  onToggle,
}: {
  checked: boolean;
  label: string;
  hint?: string | null;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={onToggle}
      className="flex w-full items-start gap-3 rounded-lg bg-secondary/60 px-3 py-2.5 text-left transition-colors hover:bg-secondary active:scale-[0.99] disabled:opacity-50"
    >
      <span
        className={cn(
          "mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] transition-colors",
          checked
            ? "border-primary bg-primary text-primary-foreground"
            : "border-muted-foreground/60",
        )}
        aria-hidden="true"
      >
        {checked ? <Check className="size-3" strokeWidth={3} /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-sm font-medium",
            checked && "text-muted-foreground line-through",
          )}
        >
          {label}
        </span>
        {hint ? <span className="block truncate text-xs text-muted-foreground">{hint}</span> : null}
      </span>
      {checked ? (
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Done
        </span>
      ) : null}
    </button>
  );
}

function Recap({ lines }: { lines: string[] }) {
  if (!lines.length) return null;
  return (
    <section className="stat-card p-5">
      <p className="text-sm font-semibold">This week in numbers</p>
      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  );
}
