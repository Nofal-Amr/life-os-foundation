/**
 * Today's ring: one segment per area, each a real "done of planned today"
 * fraction from stored rows. There is no combined score; the centre only
 * adds the counts up.
 */
export type RingSegment = {
  key: "tasks" | "habits" | "prayers" | "medication";
  label: string;
  done: number;
  total: number;
  to: string;
};

export type RingInputs = {
  today: string;
  tasks?:
    | {
        status: string;
        due_date: string | null;
        completed_at: string | null;
        parent_task_id: string | null;
      }[]
    | undefined;
  habits?: { id: string; active: boolean; frequency: string }[] | undefined;
  habitLogs?: { habit_id: string; log_date: string }[] | undefined;
  /** Prayers logged today (0–5), or undefined when prayers aren't tracked. */
  prayersLogged?: number | undefined;
  doses?: { scheduled: number; taken: number } | undefined;
};

export function todayRing(input: RingInputs): RingSegment[] {
  const segments: RingSegment[] = [];
  const { today } = input;

  if (input.tasks) {
    const doneToday = (task: { status: string; completed_at: string | null }) =>
      task.status === "completed" && (task.completed_at ?? "").slice(0, 10) === today;
    const planned = input.tasks.filter((task) => {
      if (task.parent_task_id) return false;
      if (doneToday(task)) return true;
      if (task.status === "completed" || task.status === "cancelled") return false;
      return !!task.due_date && task.due_date <= today;
    });
    segments.push({
      key: "tasks",
      label: "Tasks",
      done: planned.filter(doneToday).length,
      total: planned.length,
      to: "/tasks",
    });
  }

  if (input.habits) {
    const daily = input.habits.filter((habit) => habit.active && habit.frequency === "daily");
    const logged = new Set(
      (input.habitLogs ?? []).filter((log) => log.log_date === today).map((log) => log.habit_id),
    );
    segments.push({
      key: "habits",
      label: "Habits",
      done: daily.filter((habit) => logged.has(habit.id)).length,
      total: daily.length,
      to: "/habits",
    });
  }

  if (input.prayersLogged != null) {
    segments.push({
      key: "prayers",
      label: "Prayers",
      done: Math.min(5, input.prayersLogged),
      total: 5,
      to: "/spirit",
    });
  }

  if (input.doses) {
    segments.push({
      key: "medication",
      label: "Medication",
      done: Math.min(input.doses.taken, input.doses.scheduled),
      total: input.doses.scheduled,
      to: "/health",
    });
  }

  // An area with nothing planned today has nothing to show.
  return segments.filter((segment) => segment.total > 0);
}

/**
 * Arcs for an SVG ring: each area gets an equal share of the circle, with a
 * small gap, and fills its share by done/total. Angles are in degrees,
 * clockwise from 12 o'clock.
 */
export function ringArcs(segments: RingSegment[], gap = 6) {
  if (!segments.length) return [];
  const share = 360 / segments.length;
  const usable = segments.length > 1 ? share - gap : 360;
  return segments.map((segment, index) => {
    const start = index * share + (segments.length > 1 ? gap / 2 : 0);
    return {
      segment,
      start,
      end: start + usable,
      filledEnd: start + usable * (segment.total ? segment.done / segment.total : 0),
    };
  });
}
