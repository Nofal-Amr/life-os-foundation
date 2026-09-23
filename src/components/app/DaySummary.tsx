import { useQuery } from "@tanstack/react-query";

import { dayLines } from "@/data/daySummary";
import { financeCategoriesQuery, transactionsQuery } from "@/data/finance";
import { foodLogsQuery } from "@/data/food";
import { habitLogsQuery } from "@/data/habits";
import { healthLogsQuery, medicationLogsQuery, medicationsQuery } from "@/data/health";
import { resourceReadingsQuery, resourcesQuery } from "@/data/resources";
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
export function DaySummary({
  date = todayISO(),
  className,
}: {
  date?: string;
  className?: string;
}) {
  const tasks = useQuery(tasksQuery());
  const transactions = useQuery(transactionsQuery());
  const categories = useQuery(financeCategoriesQuery());
  const health = useQuery(healthLogsQuery());
  const prayers = useQuery(prayerLogsQuery());
  const habits = useQuery(habitLogsQuery());
  const entries = useQuery(timeEntriesQuery());
  const food = useQuery(foodLogsQuery());
  const medications = useQuery(medicationsQuery());
  const medicationLogs = useQuery(medicationLogsQuery());
  const resources = useQuery(resourcesQuery());
  const readings = useQuery(resourceReadingsQuery());
  const { fmtMoney, fmtLongDate } = usePreferences();

  const log = (health.data ?? []).find((row) => row.log_date === date);
  const lines = dayLines(
    {
      date,
      tasks: tasks.data ?? [],
      transactions: transactions.data ?? [],
      categories: categories.data ?? [],
      foodLogs: food.data ?? [],
      medications: medications.data ?? [],
      medicationLogs: medicationLogs.data ?? [],
      resources: resources.data ?? [],
      readings: readings.data ?? [],
      sleepMinutes: log?.actual_sleep_minutes ?? (log?.sleep_hours ? log.sleep_hours * 60 : null),
      prayersLogged: (prayers.data ?? []).filter(
        (row) => row.prayer_date === date && prayerCounts(row),
      ).length,
      habitsTicked: (habits.data ?? []).filter((row) => row.log_date === date).length,
      minutesTracked: minutesByDay(entries.data ?? [], [date])[0] ?? 0,
    },
    { money: fmtMoney, duration: formatDuration },
  );

  return (
    <section className={cn("stat-card p-5", className)} aria-label="What changed today">
      <h2 className="section-title">
        {date === todayISO() ? "Today so far" : fmtLongDate(new Date(`${date}T12:00:00`))}
      </h2>
      {lines.length ? (
        <ul className="mt-3 space-y-2">
          {lines.map((line) => (
            <li key={line.key} className="flex items-baseline gap-2 text-sm">
              <span
                aria-hidden="true"
                className="size-1.5 shrink-0 translate-y-[-1px] rounded-full bg-primary"
              />
              <span className="min-w-0">
                {line.text}
                {line.detail ? (
                  <span className="text-muted-foreground"> · {line.detail}</span>
                ) : null}
              </span>
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
