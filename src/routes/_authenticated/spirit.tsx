import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Check, Moon } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";

import { DateNav } from "@/components/app/DateNav";
import { PageHeader } from "@/components/app/PageHeader";
import { GlanceSection, RingStat } from "@/components/app/StatCards";
import { ErrorState, LoadingState } from "@/components/app/States";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PRAYER_LABELS,
  PRAYER_NAMES,
  clearPrayerLog,
  logPrayer,
  prayerLogsQuery,
  prayerSettingsQuery,
  spiritKeys,
  type PrayerName,
} from "@/data/spirit";
import { prayersOn } from "@/data/stats";
import { usePreferences } from "@/hooks/usePreferences";
import { todayISO } from "@/lib/date";
import { prayerTimesFor } from "@/lib/prayer";

export const Route = createFileRoute("/_authenticated/spirit")({
  head: () => ({
    meta: [
      { title: "Spirit — Life OS" },
      {
        name: "description",
        content: "Prayer times for your location, with a simple record of each prayer.",
      },
      { property: "og:title", content: "Spirit — Life OS" },
      {
        property: "og:description",
        content: "Prayer times for your location, with a simple record of each prayer.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SpiritPage,
});

function lastSevenDates(from: string): Set<string> {
  const dates = new Set<string>();
  const base = new Date(`${from}T12:00:00`);
  for (let index = 0; index < 7; index += 1) {
    const date = new Date(base);
    date.setDate(base.getDate() - index);
    dates.add(format(date, "yyyy-MM-dd"));
  }
  return dates;
}

function SpiritPage() {
  const queryClient = useQueryClient();
  const settings = useQuery(prayerSettingsQuery());
  const logs = useQuery(prayerLogsQuery());
  const { fmtTime, fmtDate } = usePreferences();
  const [date, setDate] = useState(todayISO());

  const onError = (e: unknown) =>
    toast.error(e instanceof Error ? e.message : "Something went wrong.");

  const setLog = useMutation({
    mutationFn: (input: {
      prayer_name: PrayerName;
      completed: boolean;
      on_time: boolean | null;
    }) => logPrayer({ prayer_date: date, ...input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: spiritKeys.logs }),
    onError,
  });

  const unsetLog = useMutation({
    mutationFn: (prayer_name: PrayerName) => clearPrayerLog(date, prayer_name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: spiritKeys.logs }),
    onError,
  });

  if (settings.isLoading || logs.isLoading) {
    return (
      <>
        <PageHeader title="Spirit" description="Prayer times and your own record." />
        <LoadingState rows={4} />
      </>
    );
  }

  if (settings.error || logs.error) {
    return (
      <>
        <PageHeader title="Spirit" description="Prayer times and your own record." />
        <ErrorState
          error={settings.error ?? logs.error}
          onRetry={() => {
            settings.refetch();
            logs.refetch();
          }}
        />
      </>
    );
  }

  const config = settings.data;
  const hasLocation = config?.latitude != null && config?.longitude != null;
  const times = hasLocation
    ? prayerTimesFor(
        Number(config.latitude),
        Number(config.longitude),
        config.calc_method,
        config.asr_school,
        date,
      )
    : null;
  const nextPrayer = date === todayISO() && times ? String(times.nextPrayer()).toLowerCase() : null;

  const dayLogs = (logs.data ?? []).filter((log) => log.prayer_date === date);
  const doneCount = dayLogs.filter((log) => log.completed).length;
  const prayers = prayersOn(logs.data ?? [], date);
  const weekDates = lastSevenDates(date);
  const weekLogged = (logs.data ?? []).filter(
    (log) => weekDates.has(log.prayer_date) && log.completed,
  ).length;

  return (
    <>
      <PageHeader title="Spirit" description="A simple record of the five daily prayers." />

      <div className="space-y-5">
        <DateNav value={date} onChange={setDate} />

        <GlanceSection>
          <RingStat
            title={date === todayISO() ? "Prayers today" : `Prayers on ${fmtDate(date)}`}
            icon={Moon}
            done={prayers.done}
            total={prayers.total}
            center={`${prayers.done}/${prayers.total}`}
            headline={`${prayers.done} of ${prayers.total}`}
            detail="prayers logged as completed"
            tone={2}
            ringLabel={`${prayers.done} of ${prayers.total} prayers logged`}
          />
        </GlanceSection>

        {!hasLocation ? (
          <Card className="system-card">
            <CardHeader>
              <CardTitle className="text-base">No location set yet</CardTitle>
              <CardDescription>
                Prayer times are calculated from your location. Set it once in Settings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to="/settings">Open Settings</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="system-card">
            <CardHeader>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <CardTitle className="text-base">
                  {doneCount} of 5 recorded
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  {weekLogged} of 35 over the last seven days
                </span>
              </div>
              <CardDescription>
                {config?.city
                  ? `Times calculated for ${config.city}.`
                  : "Times calculated for your saved coordinates."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {PRAYER_NAMES.map((name) => {
                const time = times ? (times[name] as Date) : null;
                const log = dayLogs.find((item) => item.prayer_name === name);
                const marked = !!log?.completed;
                const isNext = nextPrayer === name;
                return (
                  <div key={name} className="rounded-xl border border-border bg-card">
                    <button
                      type="button"
                      aria-pressed={marked}
                      className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition-colors ${
                        marked ? "tone-positive" : "hover:bg-accent/50"
                      }`}
                      onClick={() =>
                        marked
                          ? unsetLog.mutate(name)
                          : setLog.mutate({ prayer_name: name, completed: true, on_time: null })
                      }
                    >
                      <span className="flex items-baseline gap-3">
                        <span className="w-20 text-sm font-medium">{PRAYER_LABELS[name]}</span>
                        <span className="text-sm tabular-nums opacity-80">
                          {time ? fmtTime(time) : "—"}
                        </span>
                        {isNext && !marked ? (
                          <span className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                            Next
                          </span>
                        ) : null}
                      </span>
                      <span className="flex items-center gap-2 text-xs font-medium">
                        {marked ? (
                          <>
                            <Check className="size-4" aria-hidden="true" />
                            Prayed
                          </>
                        ) : (
                          <span className="text-muted-foreground">Mark as prayed</span>
                        )}
                      </span>
                    </button>
                    {marked ? (
                      <div className="flex items-center gap-2 px-4 pb-3 pt-1">
                        <Button
                          type="button"
                          size="sm"
                          variant={log?.on_time === true ? "secondary" : "ghost"}
                          aria-pressed={log?.on_time === true}
                          onClick={() =>
                            setLog.mutate({
                              prayer_name: name,
                              completed: true,
                              on_time: log?.on_time === true ? null : true,
                            })
                          }
                        >
                          On time
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={log?.on_time === false ? "secondary" : "ghost"}
                          aria-pressed={log?.on_time === false}
                          onClick={() =>
                            setLog.mutate({
                              prayer_name: name,
                              completed: true,
                              on_time: log?.on_time === false ? null : false,
                            })
                          }
                        >
                          Later
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
