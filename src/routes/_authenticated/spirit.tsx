import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Moon } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { AreaHabits } from "@/components/app/AreaHabits";
import { AzkarSession } from "@/components/app/AzkarSession";
import { QiblaFinder } from "@/components/app/QiblaFinder";
import { Tasbih } from "@/components/app/Tasbih";

import { DateNav } from "@/components/app/DateNav";
import { PrayerDayList, PrayerStats } from "@/components/app/PrayerLog";
import { PrayerReminderSettings } from "@/components/app/PrayerReminders";
import { PageHeader } from "@/components/app/PageHeader";
import { GlanceSection, RingStat } from "@/components/app/StatCards";
import { ErrorState, LoadingState } from "@/components/app/States";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
import { azkarDone, azkarTimeAt, dhikrLogsQuery, tasbihOn, type AzkarTime } from "@/data/azkar";
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
  validateSearch: (search: Record<string, unknown>): { tab?: SpiritTab; time?: AzkarTime } => {
    const tab = SPIRIT_TABS.find((option) => option.value === search["tab"])?.value;
    const time = search["time"];
    return {
      ...(tab && tab !== "prayers" ? { tab } : {}),
      ...(time === "morning" || time === "evening" ? { time } : {}),
    };
  },
  component: SpiritPage,
});

const SPIRIT_TABS = [
  { value: "prayers", label: "Prayers" },
  { value: "azkar", label: "Azkar" },
  { value: "tasbih", label: "Tasbih" },
  { value: "qibla", label: "Qibla" },
] as const;
type SpiritTab = (typeof SPIRIT_TABS)[number]["value"];

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
  const [showSunrise, setShowSunrise] = useState(() => {
    try {
      return localStorage.getItem("spirit:sunrise") !== "0";
    } catch {
      return true;
    }
  });
  const toggleSunrise = (value: boolean) => {
    setShowSunrise(value);
    try {
      localStorage.setItem("spirit:sunrise", value ? "1" : "0");
    } catch {
      // Not remembered.
    }
  };
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/spirit" });
  const tab: SpiritTab = search.tab ?? "prayers";
  const setTab = (next: SpiritTab) =>
    void navigate({
      search: (old) => {
        const { tab: _previous, ...rest } = old;
        return next === "prayers" ? rest : { ...rest, tab: next };
      },
      replace: true,
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
  const doneCount = dayLogs.filter((log) => prayerCounts(log)).length;
  const prayers = prayersOn(logs.data ?? [], date);
  const weekDates = lastSevenDates(date);
  const weekLogged = (logs.data ?? []).filter(
    (log) => weekDates.has(log.prayer_date) && prayerCounts(log),
  ).length;

  return (
    <>
      <PageHeader title="Spirit" description="Prayers, azkar, tasbih and the Qibla." />

      <div
        className="mb-5 flex gap-1 overflow-x-auto rounded-lg bg-secondary p-1"
        role="tablist"
        aria-label="Spirit"
      >
        {SPIRIT_TABS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={tab === option.value}
            onClick={() => setTab(option.value)}
            className={
              "min-h-10 flex-1 rounded-md px-3 text-sm font-medium transition-colors " +
              (tab === option.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")
            }
          >
            {option.label}
          </button>
        ))}
      </div>

      {tab === "azkar" ? (
        <AzkarTab times={times} {...(search.time ? { initial: search.time } : {})} />
      ) : tab === "tasbih" ? (
        <TasbihTab />
      ) : tab === "qibla" ? (
        <QiblaFinder
          latitude={hasLocation ? Number(config.latitude) : null}
          longitude={hasLocation ? Number(config.longitude) : null}
          place={config?.city ?? null}
        />
      ) : (
      <div className="space-y-5">
        <DateNav value={date} onChange={setDate} />
        <AreaHabits category="spirit" title="Spirit habits" date={date} />

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
              <span className="flex items-center gap-3 text-xs text-muted-foreground">
                {config?.city ? `Times for ${config.city}` : "Times for your saved location"}
                <label className="flex items-center gap-1.5">
                  <Switch
                    checked={showSunrise}
                    onCheckedChange={toggleSunrise}
                    aria-label="Show sunrise"
                  />
                  Sunrise
                </label>
              </span>
            </div>
            <PrayerDayList
              date={date}
              logs={logs.data ?? []}
              times={times ? prayerDates(times) : null}
              next={nextPrayer as PrayerName | null}
              formatTime={fmtTime}
              sunrise={showSunrise && times ? times.sunrise : null}
            />
          </section>
        )}

        <PrayerStats logs={logs.data ?? []} today={todayISO()} />
        <PrayerReminderSettings />
      </div>
      )}
    </>
  );
}

/** Morning or evening azkar for today, opening on the one that fits the hour. */
function AzkarTab({
  times,
  initial,
}: {
  times: ReturnType<typeof prayerTimesFor> | null;
  initial?: AzkarTime;
}) {
  const logs = useQuery(dhikrLogsQuery());
  const today = todayISO();
  const [time, setTime] = useState<AzkarTime>(
    () => initial ?? azkarTimeAt(new Date(), times ? { fajr: times.fajr, dhuhr: times.dhuhr } : null),
  );
  if (logs.isLoading) return <LoadingState rows={3} />;
  if (logs.error) return <ErrorState error={logs.error} onRetry={() => void logs.refetch()} />;
  return (
    <AzkarSession
      date={today}
      time={time}
      onTimeChange={setTime}
      done={azkarDone(logs.data ?? [], today, time)}
    />
  );
}

function TasbihTab() {
  const logs = useQuery(dhikrLogsQuery());
  const today = todayISO();
  return <Tasbih date={today} todayTotal={tasbihOn(logs.data ?? [], today)} />;
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
