import { useQuery } from "@tanstack/react-query";

import { transactionsQuery } from "@/data/finance";
import { habitLogsQuery } from "@/data/habits";
import { healthLogsQuery } from "@/data/health";
import { prayerLogsQuery } from "@/data/spirit";
import { prayerCounts } from "@/data/week";
import { tasksQuery } from "@/data/tasks";
import { minutesByDay, timeEntriesQuery } from "@/data/time";
import { usePreferences } from "@/hooks/usePreferences";
import { todayISO } from "@/lib/date";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * What changed today, in one card: only lines for things actually logged.
 * Nothing is scored or judged; it is a receipt of the day.
 */
export function DaySummary({ date = todayISO(), className }: { date?: string; className?: string }) {
  const tasks = useQuery(tasksQuery());
  const transactions = useQuery(transactionsQuery());
  const health = useQuery(healthLogsQuery());
  const prayers = useQuery(prayerLogsQuery());
  const habits = useQuery(habitLogsQuery());
  const entries = useQuery(timeEntriesQuery());
  const { fmtMoney, fmtLongDate } = usePreferences();

  const done = (tasks.data ?? []).filter(
    (task) => task.status === "completed" && (task.completed_at ?? "").slice(0, 10) === date,
  ).length;
  const spent = (transactions.data ?? [])
    .filter((row) => row.kind === "expense" && row.date === date)
    .reduce((sum, row) => sum + Number(row.amount), 0);
  const log = (health.data ?? []).find((row) => row.log_date === date);
  const sleep = log?.actual_sleep_minutes ?? (log?.sleep_hours ? log.sleep_hours * 60 : null);
  const prayed = (prayers.data ?? []).filter(
    (row) => row.prayer_date === date && prayerCounts(row),
  ).length;
  const ticked = (habits.data ?? []).filter((row) => row.log_date === date).length;
  const minutes = minutesByDay(entries.data ?? [], [date])[0] ?? 0;

  const lines = [
    done ? `${done} ${done === 1 ? "task" : "tasks"} completed` : null,
    spent > 0 ? `${fmtMoney(spent)} spent` : null,
    sleep ? `${formatDuration(sleep)} sleep` : null,
    prayed ? `${prayed} of 5 prayers logged` : null,
    ticked ? `${ticked} ${ticked === 1 ? "habit" : "habits"} ticked` : null,
    minutes ? `${formatDuration(minutes)} tracked` : null,
  ].filter((line): line is string => line != null);

  return (
    <section className={cn("stat-card p-5", className)} aria-label="What changed today">
      <h2 className="section-title">
        {date === todayISO() ? "Today so far" : fmtLongDate(new Date(`${date}T12:00:00`))}
      </h2>
      {lines.length ? (
        <ul className="mt-3 space-y-1.5">
          {lines.map((line) => (
            <li key={line} className="flex items-baseline gap-2 text-sm">
              <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-primary" />
              {line}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          Nothing logged for this day yet. Anything you log shows up here.
        </p>
      )}
    </section>
  );
}
