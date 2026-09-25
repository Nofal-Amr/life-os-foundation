import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { habitLogsQuery, habitsQuery } from "@/data/habits";
import { medicationLogsQuery, medicationsQuery } from "@/data/health";
import { prayerLogsQuery } from "@/data/spirit";
import { tasksQuery } from "@/data/tasks";
import { ringArcs, todayRing, type RingSegment } from "@/data/todayRing";
import { prayerCounts } from "@/data/week";
import { useModules } from "@/hooks/useModules";
import { todayISO } from "@/lib/date";
import { cn } from "@/lib/utils";

const SIZE = 92;
const STROKE = 9;
const RADIUS = (SIZE - STROKE) / 2;

function point(angle: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: SIZE / 2 + RADIUS * Math.cos(radians),
    y: SIZE / 2 + RADIUS * Math.sin(radians),
  };
}

/** An SVG arc from `start` to `end` degrees, clockwise from 12 o'clock. */
function arc(start: number, end: number) {
  const sweep = Math.min(end - start, 359.99);
  const from = point(start);
  const to = point(start + sweep);
  return `M ${from.x} ${from.y} A ${RADIUS} ${RADIUS} 0 ${sweep > 180 ? 1 : 0} 1 ${to.x} ${to.y}`;
}

/** Today's areas and their real "done of planned" counts, from the stored rows. */
export function useTodaySegments(): RingSegment[] {
  const today = todayISO();
  const { isEnabled } = useModules();
  const tasks = useQuery({ ...tasksQuery(), enabled: isEnabled("do") });
  const habits = useQuery({ ...habitsQuery(), enabled: isEnabled("habits") });
  const habitLogs = useQuery({ ...habitLogsQuery(), enabled: isEnabled("habits") });
  const prayers = useQuery({ ...prayerLogsQuery(), enabled: isEnabled("spirit") });
  const medications = useQuery({ ...medicationsQuery(), enabled: isEnabled("body") });
  const medicationLogs = useQuery({ ...medicationLogsQuery(), enabled: isEnabled("body") });

  const scheduled = (medications.data ?? [])
    .filter((medication) => medication.active)
    .reduce((sum, medication) => sum + (medication.schedule_times ?? []).length, 0);
  const taken = (medicationLogs.data ?? []).filter(
    (log) => log.log_date === today && log.taken,
  ).length;

  return todayRing({
    today,
    tasks: isEnabled("do") ? tasks.data : undefined,
    habits: isEnabled("habits") ? habits.data : undefined,
    habitLogs: habitLogs.data,
    prayersLogged:
      isEnabled("spirit") && prayers.data
        ? prayers.data.filter((row) => row.prayer_date === today && prayerCounts(row)).length
        : undefined,
    doses: isEnabled("body") ? { scheduled, taken } : undefined,
  });
}

/**
 * The ring beside the greeting: each area its own segment, filled by what was
 * done of what was planned today. The centre adds the counts up; nothing is
 * turned into a score.
 */
export function TodayRing({
  segments,
  className,
}: {
  segments: RingSegment[];
  className?: string;
}) {
  if (!segments.length) return null;
  const done = segments.reduce((sum, segment) => sum + segment.done, 0);
  const total = segments.reduce((sum, segment) => sum + segment.total, 0);
  const summary = segments.map((s) => `${s.label} ${s.done} of ${s.total}`).join(", ");

  return (
    <div
      className={cn("relative w-fit shrink-0", className)}
      role="img"
      aria-label={`Today: ${summary}`}
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        {ringArcs(segments, segments.length > 1 ? 16 : 0).map(
          ({ segment, start, end, filledEnd }) => (
            <g key={segment.key}>
              <path
                d={arc(start, end)}
                fill="none"
                stroke="color-mix(in oklch, var(--color-muted-foreground) 22%, transparent)"
                strokeWidth={STROKE}
                strokeLinecap="round"
              />
              {filledEnd > start ? (
                <path
                  d={arc(start, filledEnd)}
                  fill="none"
                  stroke="var(--color-primary)"
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                  className="transition-[d] duration-500 ease-out"
                />
              ) : null}
            </g>
          ),
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-xl font-semibold tabular-nums">{done}</span>
        <span className="mt-1 text-[0.6875rem] tabular-nums text-muted-foreground">of {total}</span>
      </div>
    </div>
  );
}

/** One line under the greeting naming each segment, each a link to its page. */
export function TodayRingLegend({ segments }: { segments: RingSegment[] }) {
  if (!segments.length) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {segments.map((segment) => (
        <li key={segment.key}>
          <Link
            to={segment.to}
            className="inline-flex min-h-8 items-center gap-1.5 hover:text-foreground"
          >
            <span
              aria-hidden="true"
              className={cn(
                "size-1.5 rounded-full",
                segment.done >= segment.total ? "bg-primary" : "bg-muted-foreground/40",
              )}
            />
            {segment.label}{" "}
            <span className="tabular-nums text-foreground">
              {segment.done}/{segment.total}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
