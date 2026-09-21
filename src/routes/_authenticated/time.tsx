import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { Clock, Play, Plus, Square, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EntityIcon, EntityIdentityPicker } from "@/components/app/EntityIdentity";
import { FormDialog } from "@/components/app/FormDialog";
import { PageHeader } from "@/components/app/PageHeader";
import { ErrorState, LoadingState } from "@/components/app/States";
import { TaskTimerButton, useClock, useTimer } from "@/components/app/Timer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { tasksQuery } from "@/data/tasks";
import {
  addStarterActivities,
  createActivity,
  daysEnding,
  deleteTimeEntry,
  entryKey,
  entryMinutes,
  formatClock,
  formatMinutes,
  logTime,
  minutesByDay,
  minutesByKey,
  minutesByTask,
  timeKeys,
  type Activity,
  type TimeEntry,
} from "@/data/time";
import { usePreferences } from "@/hooks/usePreferences";
import { isoToLocalInput, localInputToISO, todayISO } from "@/lib/date";
import { toError } from "@/lib/supabase-helpers";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/time")({
  head: () => ({
    meta: [
      { title: "Time — Life OS" },
      {
        name: "description",
        content: "Where your time goes: timers and logged time per activity.",
      },
    ],
  }),
  component: TimePage,
});

const DURATIONS = [15, 30, 45, 60, 90, 120];

function TimePage() {
  const queryClient = useQueryClient();
  const {
    running,
    label,
    activity: runningActivity,
    start,
    stop,
    entries,
    activities,
  } = useTimer();
  const tasks = useQuery(tasksQuery());
  const elapsed = useClock(running?.started_at ?? null);
  const { fmtTime } = usePreferences();
  const [logging, setLogging] = useState<Activity | null | "pick">(null);
  const [adding, setAdding] = useState(false);
  const onError = (error: unknown) => toast.error(toError(error).message);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: timeKeys.entries });
    void queryClient.invalidateQueries({ queryKey: timeKeys.activities });
  };

  const starters = useMutation({ mutationFn: addStarterActivities, onSuccess: refresh, onError });
  const remove = useMutation({ mutationFn: deleteTimeEntry, onSuccess: refresh, onError });

  const list = (activities.data ?? []).filter((a) => !a.archived);
  const today = todayISO();
  const week = daysEnding(today, 7);
  const all = entries.data ?? [];
  const todayEntries = all.filter((e) => format(new Date(e.started_at), "yyyy-MM-dd") === today);
  const byKey = minutesByKey(all, week);
  const perDay = minutesByDay(all, week);
  const weekTotal = perDay.reduce((a, b) => a + b, 0);
  const nameOf = (entry: TimeEntry) => {
    if (entry.activity_id)
      return list.find((a) => a.id === entry.activity_id)?.name ?? entry.label ?? "Activity";
    if (entry.task_id)
      return (tasks.data ?? []).find((t) => t.id === entry.task_id)?.title ?? entry.label ?? "Task";
    return entry.label ?? "Time";
  };
  const weekRows = useMemo(
    () =>
      [...byKey.entries()]
        .map(([key, minutes]) => {
          const sample = all.find((e) => entryKey(e) === key)!;
          const activity = sample.activity_id
            ? list.find((a) => a.id === sample.activity_id)
            : null;
          return { key, minutes, name: nameOf(sample), activity };
        })
        .sort((a, b) => b.minutes - a.minutes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [byKey, list, tasks.data],
  );
  const maxMinutes = Math.max(1, ...weekRows.map((r) => r.minutes));
  const tracked = minutesByTask(all);
  const focusTasks = (tasks.data ?? [])
    .filter(
      (task) =>
        task.status !== "completed" &&
        task.status !== "cancelled" &&
        (task.status === "in_progress" || (task.due_date != null && task.due_date <= today)),
    )
    .sort((a, b) => Number(b.status === "in_progress") - Number(a.status === "in_progress"))
    .slice(0, 6);

  if (entries.isLoading || activities.isLoading) {
    return (
      <>
        <PageHeader title="Time" description="Where your time goes." />
        <LoadingState rows={4} />
      </>
    );
  }
  if (entries.error || activities.error) {
    return (
      <>
        <PageHeader title="Time" description="Where your time goes." />
        <ErrorState error={entries.error ?? activities.error} onRetry={refresh} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Time"
        description="Start a timer for anything you do, or log it afterwards."
        actions={
          <Button type="button" variant="outline" onClick={() => setLogging("pick")}>
            <Clock className="size-4" />
            Log time
          </Button>
        }
      />

      <div className="space-y-6">
        {/* The running timer, big. */}
        {running ? (
          <section className="stat-card flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="flex min-w-0 items-center gap-3">
              {runningActivity ? (
                <EntityIcon icon={runningActivity.icon} color={runningActivity.color} />
              ) : null}
              <div className="min-w-0">
                <p className="truncate text-sm text-muted-foreground">{label}</p>
                <p className="font-mono text-4xl font-semibold tabular-nums tracking-tight">
                  {formatClock(elapsed)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Started {fmtTime(new Date(running.started_at))}
                </p>
              </div>
            </div>
            <Button type="button" size="lg" onClick={() => stop.mutate(running)}>
              <Square className="size-4 fill-current" />
              Stop
            </Button>
          </section>
        ) : null}

        {/* Activities: tap to start. */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Start a timer</h2>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(true)}>
              <Plus className="size-4" />
              Activity
            </Button>
          </div>
          {list.length ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {list.map((activity) => {
                const active = running?.activity_id === activity.id;
                return (
                  <div
                    key={activity.id}
                    className={cn(
                      "stat-card flex items-center gap-2 p-2.5",
                      active && "ring-2 ring-primary",
                    )}
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2 text-left active:scale-[0.98]"
                      onClick={() => {
                        // Stopping only happens with the Stop button, so a
                        // double tap can't end a timer by accident.
                        if (active) return;
                        start.mutate({
                          activity_id: activity.id,
                          task_id: null,
                          label: activity.name,
                        });
                      }}
                    >
                      <EntityIcon icon={activity.icon} color={activity.color} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{activity.name}</span>
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          {active ? (
                            <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                          ) : (
                            <Play className="size-2.5" />
                          )}
                          <span className="truncate">
                            {active
                              ? "Running"
                              : byKey.get(`a:${activity.id}`)
                                ? `${formatMinutes(byKey.get(`a:${activity.id}`)!)} · 7d`
                                : "Start"}
                          </span>
                        </span>
                      </span>
                    </button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-8 shrink-0"
                      aria-label={`Log time for ${activity.name}`}
                      onClick={() => setLogging(activity)}
                    >
                      <Clock className="size-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="stat-card space-y-3 p-5 text-sm">
              <p className="text-muted-foreground">
                Activities are what you want to time: gaming, reading, time with friends. Start with
                a set you can rename, or add your own.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => starters.mutate()}
                  disabled={starters.isPending}
                >
                  Add a starter set
                </Button>
                <Button type="button" variant="outline" onClick={() => setAdding(true)}>
                  My own
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* Tasks to work on: in progress, due today or overdue. */}
        {focusTasks.length ? (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Tasks to work on</h2>
            <ul className="space-y-1.5">
              {focusTasks.map((task) => (
                <li key={task.id} className="stat-card flex items-center gap-2 py-1.5 pl-4 pr-1.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{task.title}</p>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {task.status === "in_progress"
                        ? "In progress"
                        : task.due_date && task.due_date < today
                          ? "Overdue"
                          : "Due today"}
                      {tracked.get(task.id)
                        ? ` · ${formatMinutes(tracked.get(task.id)!)} tracked`
                        : ""}
                    </p>
                  </div>
                  <TaskTimerButton task={task} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* This week, per activity. */}
        <section className="stat-card space-y-3 p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">Last 7 days</h2>
            <span className="text-xs tabular-nums text-muted-foreground">
              {formatMinutes(weekTotal)} logged
            </span>
          </div>
          {weekRows.length ? (
            <ul className="space-y-2">
              {weekRows.map((row) => (
                <li key={row.key} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate">{row.name}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {formatMinutes(row.minutes)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(2, (row.minutes / maxMinutes) * 100)}%`,
                        background: row.activity?.color ?? "var(--chart-1)",
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing logged in the last 7 days.</p>
          )}
          <div className="grid grid-cols-7 items-end gap-1.5 pt-2" style={{ height: 72 }}>
            {week.map((day, index) => {
              const max = Math.max(1, ...perDay);
              return (
                <div key={day} className="flex h-full flex-col items-center justify-end gap-1">
                  <span
                    className="w-full max-w-7 rounded-md"
                    title={`${format(new Date(`${day}T12:00:00`), "EEE d MMM")}: ${formatMinutes(perDay[index]!)}`}
                    style={{
                      height: Math.max(3, (perDay[index]! / max) * 48),
                      background: perDay[index] ? "var(--chart-1)" : "var(--color-border)",
                    }}
                  />
                  <span className="text-[10px] uppercase text-muted-foreground">
                    {format(new Date(`${day}T12:00:00`), "EEEEE")}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Today's entries. */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Today</h2>
          {todayEntries.length ? (
            <ul className="space-y-1.5">
              {todayEntries.map((entry) => (
                <li key={entry.id} className="stat-card flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{nameOf(entry)}</p>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {fmtTime(new Date(entry.started_at))} –{" "}
                      {entry.ended_at ? fmtTime(new Date(entry.ended_at)) : "now"}
                      {entry.note ? ` · ${entry.note}` : ""}
                    </p>
                  </div>
                  <span className="text-sm tabular-nums">{formatMinutes(entryMinutes(entry))}</span>
                  {entry.ended_at ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      aria-label="Delete entry"
                      onClick={() => remove.mutate(entry.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing logged today yet.</p>
          )}
        </section>
      </div>

      <LogTimeDialog
        open={logging !== null}
        initial={logging === "pick" ? null : logging}
        activities={list}
        onOpenChange={(open) => !open && setLogging(null)}
        onSaved={refresh}
      />
      <ActivityDialog
        open={adding}
        onOpenChange={setAdding}
        count={list.length}
        onSaved={refresh}
      />
    </>
  );
}

function LogTimeDialog({
  open,
  initial,
  activities,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  initial: Activity | null;
  activities: Activity[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [activityId, setActivityId] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(60);
  const [endedAt, setEndedAt] = useState("");
  const [note, setNote] = useState("");
  const chosen = activityId ?? initial?.id ?? null;

  const save = useMutation({
    mutationFn: () => {
      const activity = activities.find((a) => a.id === chosen);
      if (!activity) throw new Error("Pick an activity.");
      if (!(minutes > 0)) throw new Error("Enter how long.");
      const end = endedAt ? new Date(localInputToISO(endedAt)) : new Date();
      return logTime({
        activity_id: activity.id,
        task_id: null,
        label: activity.name,
        started_at: new Date(end.getTime() - minutes * 60_000).toISOString(),
        minutes,
        note: note.trim() || null,
      });
    },
    onSuccess: () => {
      toast.success("Time logged.");
      onSaved();
      onOpenChange(false);
      setActivityId(null);
      setNote("");
      setEndedAt("");
    },
    onError: (error) => toast.error(toError(error).message),
  });

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Log time"
      submitLabel="Log time"
      pending={save.isPending}
      onSubmit={() => save.mutate()}
    >
      <div className="space-y-2">
        <Label>Activity</Label>
        <div className="flex flex-wrap gap-1.5">
          {activities.map((activity) => (
            <button
              key={activity.id}
              type="button"
              aria-pressed={chosen === activity.id}
              onClick={() => setActivityId(activity.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm",
                chosen === activity.id
                  ? "border-primary bg-accent text-foreground"
                  : "border-border text-muted-foreground",
              )}
            >
              {activity.name}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="log-minutes">How long</Label>
        <div className="flex flex-wrap gap-1.5">
          {DURATIONS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={minutes === value}
              onClick={() => setMinutes(value)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm tabular-nums",
                minutes === value
                  ? "border-primary bg-accent"
                  : "border-border text-muted-foreground",
              )}
            >
              {formatMinutes(value)}
            </button>
          ))}
        </div>
        <Input
          id="log-minutes"
          type="number"
          min="1"
          inputMode="numeric"
          className="h-11 w-32 tabular-nums"
          value={minutes}
          onChange={(event) => setMinutes(Number(event.target.value))}
          aria-label="Minutes"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="log-ended">Finished at</Label>
        <Input
          id="log-ended"
          type="datetime-local"
          className="h-11 tabular-nums"
          value={endedAt || isoToLocalInput(new Date().toISOString())}
          max={isoToLocalInput(new Date().toISOString())}
          onChange={(event) => setEndedAt(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="log-note">Note</Label>
        <Input
          id="log-note"
          className="h-11"
          placeholder="Optional, e.g. Elden Ring"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
    </FormDialog>
  );
}

function ActivityDialog({
  open,
  onOpenChange,
  count,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [identity, setIdentity] = useState<{ icon: string | null; color: string | null }>({
    icon: null,
    color: null,
  });
  const save = useMutation({
    mutationFn: () => {
      if (!name.trim()) throw new Error("Give it a name.");
      return createActivity({ name: name.trim(), ...identity, position: count });
    },
    onSuccess: () => {
      onSaved();
      onOpenChange(false);
      setName("");
      setIdentity({ icon: null, color: null });
    },
    onError: (error) => toast.error(toError(error).message),
  });
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New activity"
      pending={save.isPending}
      onSubmit={() => save.mutate()}
    >
      <div className="space-y-2">
        <Label htmlFor="activity-name">Name</Label>
        <Input
          id="activity-name"
          className="h-12"
          placeholder="Gaming, Reading, Guitar…"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <EntityIdentityPicker value={identity} onChange={setIdentity} />
    </FormDialog>
  );
}
