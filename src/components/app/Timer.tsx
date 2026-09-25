import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Play, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { EntityIcon } from "@/components/app/EntityIdentity";
import { Button } from "@/components/ui/button";
import {
  activitiesQuery,
  deleteTimeEntry,
  formatClock,
  runningEntry,
  startTimer,
  stopTimer,
  timeEntriesQuery,
  timeKeys,
  type TimeEntry,
  type TimerTarget,
} from "@/data/time";
import { habitKeys, logHabit } from "@/data/habits";
import { track } from "@/lib/analytics";
import {
  focusEndISO,
  focusMatches,
  focusRemaining,
  playChime,
  readFocus,
  writeFocus,
  type FocusSession,
} from "@/lib/focus";
import { showTimerNotice } from "@/lib/native";
import { toError } from "@/lib/supabase-helpers";
import { cn } from "@/lib/utils";

/** Seconds since `from`, updating every second while `from` is set. */
export function useClock(from: string | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!from) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [from]);
  return from ? now - new Date(from).getTime() : 0;
}

/** The running timer, and starting/stopping with instant feedback. */
export function useTimer() {
  const queryClient = useQueryClient();
  const entries = useQuery(timeEntriesQuery());
  const activities = useQuery(activitiesQuery());
  const running = runningEntry(entries.data ?? []);
  const onError = (error: unknown) => toast.error(toError(error).message);

  const start = useMutation({
    mutationFn: (target: TimerTarget) => startTimer(target, running),
    onMutate: async (target) => {
      await queryClient.cancelQueries({ queryKey: timeKeys.entries });
      const previous = queryClient.getQueryData<TimeEntry[]>(timeKeys.entries);
      const now = new Date().toISOString();
      queryClient.setQueryData<TimeEntry[]>(timeKeys.entries, (rows = []) => [
        {
          id: "local-running",
          ...target,
          note: null,
          started_at: now,
          ended_at: null,
        } as TimeEntry,
        ...rows.map((row) => (row.ended_at ? row : { ...row, ended_at: now })),
      ]);
      track("timer_started", { kind: target.task_id ? "task" : "activity" });
      return previous;
    },
    onError: (error, _target, previous) => {
      if (previous) queryClient.setQueryData(timeKeys.entries, previous);
      onError(error);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: timeKeys.entries }),
  });

  const stop = useMutation({
    mutationFn: async (entry: TimeEntry) => {
      // Under a minute is almost always a mis-tap; don't keep a "0 min" entry.
      if (Date.now() - new Date(entry.started_at).getTime() < 60_000) {
        await deleteTimeEntry(entry.id);
        toast.message("Timer discarded: it ran for under a minute.");
        return;
      }
      await stopTimer(entry.id);
    },
    onMutate: async (entry) => {
      await queryClient.cancelQueries({ queryKey: timeKeys.entries });
      const previous = queryClient.getQueryData<TimeEntry[]>(timeKeys.entries);
      const now = new Date().toISOString();
      queryClient.setQueryData<TimeEntry[]>(timeKeys.entries, (rows = []) =>
        rows.map((row) => (row.id === entry.id ? { ...row, ended_at: now } : row)),
      );
      return previous;
    },
    onError: (error, _entry, previous) => {
      if (previous) queryClient.setQueryData(timeKeys.entries, previous);
      onError(error);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: timeKeys.entries }),
  });

  const activity = running?.activity_id
    ? ((activities.data ?? []).find((a) => a.id === running.activity_id) ?? null)
    : null;
  const label = running ? (activity?.name ?? running.label ?? "Timer") : null;

  return { running, label, activity, start, stop, entries, activities };
}

/**
 * Shown on every page while a timer runs: what it is, the live clock and
 * Stop. Also keeps the phone's ongoing notification in step.
 */
export function TimerBar() {
  const queryClient = useQueryClient();
  const { running, label, activity, stop, entries } = useTimer();
  const elapsed = useClock(running?.started_at ?? null);

  // A focus session is a timer with a planned length (kept on this device).
  const [focus, setFocus] = useState<FocusSession | null>(() =>
    typeof window === "undefined" ? null : readFocus(),
  );
  useEffect(() => {
    const update = () => setFocus(readFocus());
    window.addEventListener("life-os-focus", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("life-os-focus", update);
      window.removeEventListener("storage", update);
    };
  }, []);
  const focused = focusMatches(focus, running?.started_at ?? null) ? focus : null;
  const remaining = focused ? focusRemaining(focused, Date.now()) : null;

  // A plan whose timer was stopped by hand is forgotten.
  useEffect(() => {
    if (focus && entries.data && !focusMatches(focus, running?.started_at ?? null)) {
      writeFocus(null);
    }
  }, [focus, running?.started_at, entries.data]);

  // Done: chime, log exactly the planned minutes, tick the habit.
  const finishing = useRef(false);
  useEffect(() => {
    if (!focused || !running || remaining !== 0 || finishing.current) return;
    finishing.current = true;
    playChime();
    try {
      navigator.vibrate?.([180, 90, 180]);
    } catch {
      // No vibration here.
    }
    void (async () => {
      try {
        await stopTimer(running.id, focusEndISO(focused));
        if (focused.habitId) await logHabit(focused.habitId).catch(() => undefined);
        toast.success(
          `Focus done: ${focused.minutes} min.${focused.habitName ? ` ${focused.habitName} ticked for today.` : ""}`,
        );
      } catch (error) {
        toast.error(toError(error).message);
      } finally {
        writeFocus(null);
        finishing.current = false;
        void queryClient.invalidateQueries({ queryKey: timeKeys.entries });
        void queryClient.invalidateQueries({ queryKey: habitKeys.logs });
      }
    })();
  }, [focused, running, remaining, queryClient]);

  useEffect(() => {
    showTimerNotice(
      running && label ? { title: label, startedAt: new Date(running.started_at).getTime() } : null,
    );
  }, [running?.id, running?.started_at, label]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!running) return null;
  return (
    <div
      className={cn(
        "system-dock fixed inset-x-3 z-40 flex items-center gap-3 overflow-hidden px-3 py-2 md:relative md:mb-5 md:rounded-2xl",
        "bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+4.75rem)]",
        "motion-safe:animate-in motion-safe:slide-in-from-bottom-2 motion-safe:fade-in",
      )}
      role="status"
    >
      {focused && remaining != null ? (
        <span
          aria-hidden="true"
          className="absolute inset-x-3 top-0 h-0.5 overflow-hidden rounded-full bg-muted"
        >
          <span
            className="block h-full bg-primary transition-[width] duration-1000 ease-linear"
            style={{ width: `${100 - (remaining / (focused.minutes * 60_000)) * 100}%` }}
          />
        </span>
      ) : null}
      <Link to="/time" className="flex min-w-0 flex-1 items-center gap-3">
        {activity ? (
          <EntityIcon icon={activity.icon} color={activity.color} />
        ) : (
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Play className="size-4" aria-hidden="true" />
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{label}</span>
          <span className="block font-mono text-xs tabular-nums text-muted-foreground">
            {focused && remaining != null
              ? `${formatClock(remaining)} left of ${focused.minutes} min`
              : formatClock(elapsed)}
          </span>
        </span>
      </Link>
      <Button
        type="button"
        size="sm"
        onClick={() => stop.mutate(running)}
        disabled={stop.isPending}
      >
        <Square className="size-3.5 fill-current" aria-hidden="true" />
        Stop
      </Button>
    </div>
  );
}

/** Play/stop for one task. */
export function TaskTimerButton({
  task,
  className,
  withLabel,
  size = "sm",
}: {
  task: { id: string; title: string };
  className?: string;
  /** "Start timer" / "Stop" next to the icon. */
  withLabel?: boolean;
  size?: "sm" | "default";
}) {
  const { running, start, stop } = useTimer();
  const active = running?.task_id === task.id;
  return (
    <Button
      type="button"
      variant={active ? "default" : withLabel ? "outline" : "ghost"}
      size={withLabel ? size : "icon"}
      className={cn(!withLabel && "size-9", "shrink-0", className)}
      aria-label={active ? `Stop timing ${task.title}` : `Start timing ${task.title}`}
      onClick={(event) => {
        event.stopPropagation();
        if (active && running) stop.mutate(running);
        else start.mutate({ activity_id: null, task_id: task.id, label: task.title });
      }}
    >
      {active ? <Square className="size-3.5 fill-current" /> : <Play className="size-4" />}
      {withLabel ? (active ? "Stop timer" : "Start timer") : null}
    </Button>
  );
}
