import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { ArrowLeftRight, CalendarRange, Repeat } from "lucide-react";

import { useHub } from "@/components/app/HubCard";
import { PageHeader } from "@/components/app/PageHeader";
import { LoadingState } from "@/components/app/States";
import { habitsQuery } from "@/data/habits";
import { byMonth, dailySeries, habitByWeekday, pairings } from "@/data/insights";
import { usePreferences } from "@/hooks/usePreferences";
import { todayISO } from "@/lib/date";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => ({ meta: [{ title: "History & insights · Life OS" }] }),
  component: InsightsPage,
});

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function InsightsPage() {
  const data = useHub();
  const habits = useQuery(habitsQuery());
  const { fmtMoney, weekStartsOn } = usePreferences();
  const today = todayISO();

  if (habits.isLoading) {
    return (
      <>
        <PageHeader title="History & insights" description="What your own logs show." />
        <LoadingState rows={4} />
      </>
    );
  }

  const sources = {
    tasks: data.tasks,
    prayerLogs: data.prayerLogs,
    transactions: data.transactions,
    habitLogs: data.habitLogs,
    habits: habits.data ?? [],
    healthSamples: data.healthSamples,
  };
  const months = byMonth(sources, today, 6);
  const { series } = dailySeries(sources, today, 90);
  const together = pairings(series);
  const activeHabits = (habits.data ?? []).filter((habit) => habit.active);
  const order = Array.from({ length: 7 }, (_, i) => (weekStartsOn + i) % 7);

  return (
    <>
      <PageHeader
        title="History & insights"
        description="Only what you logged: counts, and patterns with how many days they're based on."
      />
      <div className="space-y-8">
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <CalendarRange className="size-5" /> Month by month
          </h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[28rem] text-sm">
              <thead className="bg-secondary/60 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Month</th>
                  <th className="px-3 py-2 text-right font-medium">Tasks done</th>
                  <th className="px-3 py-2 text-right font-medium">Prayers prayed</th>
                  <th className="px-3 py-2 text-right font-medium">Spent</th>
                  <th className="px-3 py-2 text-right font-medium">Habit check-ins</th>
                </tr>
              </thead>
              <tbody>
                {[...months].reverse().map((row) => (
                  <tr key={row.month} className="border-t border-border tabular-nums">
                    <td className="px-3 py-2">
                      {format(parseISO(`${row.month}-01`), "MMMM yyyy")}
                    </td>
                    <td className="px-3 py-2 text-right">{row.tasksDone}</td>
                    <td className="px-3 py-2 text-right">{row.prayed}</td>
                    <td className="px-3 py-2 text-right">{fmtMoney(row.spent)}</td>
                    <td className="px-3 py-2 text-right">{row.habitCheckIns}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ArrowLeftRight className="size-5" /> What went together
          </h2>
          <p className="text-sm text-muted-foreground">
            From the last 90 days, only days where both were logged. A pattern in your days — not
            proof that one causes the other.
          </p>
          {together.length ? (
            <ul className="space-y-2">
              {together.map((pair) => (
                <li key={`${pair.a.key}-${pair.b.key}`} className="stat-card p-3 text-sm">
                  {pair.r > 0
                    ? `On days with more ${pair.a.label}, ${pair.b.label} tended to be higher too.`
                    : `On days with more ${pair.a.label}, ${pair.b.label} tended to be lower.`}
                  <span className="mt-1 block text-xs text-muted-foreground tabular-nums">
                    {pair.strength} link (r = {pair.r}) · {pair.days} days
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              Nothing clear yet. A pattern needs at least 14 days where both things were logged, and
              most pairs here don't move together.
            </p>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Repeat className="size-5" /> Habits by weekday
          </h2>
          <p className="text-sm text-muted-foreground">
            How many of the last 8 of each day you logged it.
          </p>
          {activeHabits.length ? (
            <ul className="space-y-3">
              {activeHabits.map((habit) => {
                const pattern = habitByWeekday(habit, data.habitLogs, today, 8);
                return (
                  <li key={habit.id} className="stat-card space-y-2 p-3">
                    <p className="text-sm font-medium">{habit.name}</p>
                    <div className="grid grid-cols-7 gap-1 text-center text-xs">
                      {order.map((weekday) => {
                        const day = pattern[weekday]!;
                        const share = day.of ? day.done / day.of : 0;
                        return (
                          <div key={weekday} className="space-y-1">
                            <div className="text-muted-foreground">{DAY_SHORT[weekday]}</div>
                            <div
                              className="rounded-md py-1.5 tabular-nums"
                              style={{
                                background: `color-mix(in oklch, var(--color-primary) ${Math.round(share * 45)}%, var(--color-secondary))`,
                              }}
                              title={`${DAY_SHORT[weekday]}: ${day.done} of the last ${day.of}`}
                            >
                              {day.of ? `${day.done}/${day.of}` : "—"}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No habits yet.</p>
          )}
        </section>
      </div>
    </>
  );
}
