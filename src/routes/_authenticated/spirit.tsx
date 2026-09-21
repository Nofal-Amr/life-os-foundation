import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Check, Moon } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";

import { DateNav } from "@/components/app/DateNav";
import { PrayerDayList, PrayerStats } from "@/components/app/PrayerLog";
import { PrayerReminderSettings } from "@/components/app/PrayerReminders";
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
import { prayerCounts } from "@/data/week";
import { usePreferences } from "@/hooks/usePreferences";
import { todayISO } from "@/lib/date";
import { prayerTimesFor } from "@/lib/prayer";

export const Route = createFileRoute("/_authenticated/spirit")({
  head: () => ({
    meta: [
      { title: "Spirit · Life OS" },
      {
        name: "description",
        content: "Prayer times for your location, with a simple record of each prayer.",
      },
      { property: "og:title", content: "Spirit · Life OS" },
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
  const doneCount = dayLogs.filter((log) => prayerCounts(log)).length;
  const prayers = prayersOn(logs.data ?? [], date);
  const weekDates = lastSevenDates(date);
  const weekLogged = (logs.data ?? []).filter(
    (log) => weekDates.has(log.prayer_date) && prayerCounts(log),
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
          <section className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold">
                {doneCount} of 5 prayed
                <span className="ml-2 font-normal text-muted-foreground">
                  {weekLogged} of 35 over the last seven days
                </span>
              </p>
              <span className="text-xs text-muted-foreground">
                {config?.city ? `Times for ${config.city}` : "Times for your saved location"}
              </span>
            </div>
            <PrayerDayList
              date={date}
              logs={logs.data ?? []}
              times={times ? prayerDates(times) : null}
              next={nextPrayer as PrayerName | null}
              formatTime={fmtTime}
            />
          </section>
        )}

        <PrayerStats logs={logs.data ?? []} today={todayISO()} />
        <PrayerReminderSettings />
      </div>
    </>
  );
}

/** The five prayer times as a plain record. */
function prayerDates(times: ReturnType<typeof prayerTimesFor>): Record<PrayerName, Date> {
  return {
    fajr: times.fajr,
    dhuhr: times.dhuhr,
    asr: times.asr,
    maghrib: times.maghrib,
    isha: times.isha,
  };
}
