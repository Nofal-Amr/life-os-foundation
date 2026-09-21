import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Activity, Flame, Footprints, HeartPulse, Moon, RefreshCw, Scale } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { SamsungImport } from "@/components/app/SamsungImport";
import { RangeToggle } from "@/components/app/StatCards";
import { Button } from "@/components/ui/button";
import {
  dailyValues,
  healthSampleKeys,
  healthSamplesQuery,
  lastDays,
  lastHealthSync,
  syncHealthFromPhone,
  type HealthSample,
  type HealthSyncReport,
} from "@/data/healthSamples";
import { usePreferences } from "@/hooks/usePreferences";
import { todayISO } from "@/lib/date";
import {
  healthStatus,
  isAndroidApp,
  openHealthSettings,
  requestHealthAccess,
  type HealthStatus,
} from "@/lib/native";
import { cn } from "@/lib/utils";

const AUTO_SYNC_AFTER_MS = 30 * 60_000;
type Range = 7 | 30 | 90;

function minutesLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h ? `${h} h ${m} min` : `${m} min`;
}

/** The newest sample of a kind, or null. */
function latest(samples: HealthSample[], kind: string): HealthSample | null {
  return samples.find((sample) => sample.kind === kind) ?? null;
}

const dayLabel = (iso: string) => format(new Date(iso), "EEE d MMM");

/** Samsung Health figures on the Body page, synced from the phone or imported. */
export function SamsungHealthCard() {
  const queryClient = useQueryClient();
  const samples = useQuery(healthSamplesQuery(365));
  const { fmtWeight } = usePreferences();
  const [status, setStatus] = useState<HealthStatus>("unavailable");
  const [range, setRange] = useState<Range>(7);
  const [report, setReport] = useState<HealthSyncReport | null>(null);
  const android = isAndroidApp();
  const today = todayISO();

  const sync = useMutation({
    mutationFn: (_manual: boolean) => syncHealthFromPhone(30),
    onSuccess: (result) => {
      setReport(result);
      void queryClient.invalidateQueries({ queryKey: healthSampleKeys.all });
    },
    onError: (error, manual) => {
      if (manual)
        toast.error(error instanceof Error ? error.message : "Couldn't read Samsung Health.");
    },
  });

  useEffect(() => {
    const refresh = () => setStatus(healthStatus());
    refresh();
    window.addEventListener("life-os-health-permissions", refresh);
    return () => window.removeEventListener("life-os-health-permissions", refresh);
  }, []);

  // Sync quietly when the page opens, at most every 30 minutes.
  useEffect(() => {
    if (status !== "ready") return;
    const last = lastHealthSync();
    if (!last || Date.now() - last.getTime() > AUTO_SYNC_AFTER_MS) sync.mutate(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Newest first, as the query orders them.
  const rows = samples.data ?? [];
  const hasData = rows.length > 0;
  const days = lastDays(range, today);
  const steps = dailyValues(rows, "steps", days);
  const sleep = dailyValues(rows, "sleep", days);
  const stepsToday = dailyValues(rows, "steps", [today])[0];
  const lastSleep = latest(rows, "sleep");
  const lastHeart = latest(rows, "heart_rate");
  const lastWeight = latest(rows, "weight");
  const week = lastDays(7, today);
  const exerciseWeek = dailyValues(rows, "exercise", week).reduce<number>(
    (sum, v) => sum + (v ?? 0),
    0,
  );
  const activeToday = dailyValues(rows, "active_calories", [today])[0];
  // Only worth showing when something needs attention.
  const problem =
    report && (!Object.keys(report.byKind).length || report.missing.length || report.errors.length);

  const tiles: { icon: typeof Footprints; label: string; value: string | null }[] = [
    {
      icon: Footprints,
      label: "Steps today",
      value: stepsToday == null ? null : Math.round(stepsToday).toLocaleString(),
    },
    {
      icon: Moon,
      label: lastSleep ? `Sleep · ${dayLabel(lastSleep.end_at ?? lastSleep.start_at)}` : "Sleep",
      value: lastSleep ? minutesLabel(lastSleep.value) : null,
    },
    {
      icon: HeartPulse,
      label: lastHeart ? `Heart rate · ${dayLabel(lastHeart.start_at)}` : "Heart rate",
      value: lastHeart ? `${Math.round(lastHeart.value)} bpm avg` : null,
    },
    {
      icon: Activity,
      label: "Exercise · last 7 days",
      value: exerciseWeek ? minutesLabel(exerciseWeek) : null,
    },
    {
      icon: Flame,
      label: "Active today",
      value: activeToday == null ? null : `${Math.round(activeToday)} kcal`,
    },
    {
      icon: Scale,
      label: lastWeight ? `Weight · ${dayLabel(lastWeight.start_at)}` : "Weight",
      value: lastWeight ? fmtWeight(lastWeight.value) : null,
    },
  ];

  return (
    <section className="stat-card space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Samsung Health</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {hasData
              ? `From your phone and watch${lastHealthSync() ? ` · synced ${format(lastHealthSync()!, "d MMM, HH:mm")}` : ""}`
              : "Steps, sleep, heart rate, workouts and weight from your phone."}
          </p>
        </div>
        {android && status === "ready" ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={sync.isPending}
            onClick={() => sync.mutate(true)}
          >
            <RefreshCw className={cn("size-4", sync.isPending && "animate-spin")} />
            {sync.isPending ? "Syncing…" : "Sync now"}
          </Button>
        ) : null}
      </div>

      {android && status === "needs_permission" ? (
        <div className="space-y-3 rounded-xl bg-secondary p-4 text-sm">
          <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>
              In <span className="text-foreground">Samsung Health</span>, open Settings → Health
              Connect and allow it to share your data.
            </li>
            <li>Then connect Life OS here and pick what it may read.</li>
          </ol>
          <Button type="button" onClick={requestHealthAccess}>
            Connect Samsung Health
          </Button>
        </div>
      ) : null}
      {android && status === "unsupported" ? (
        <p className="text-sm text-muted-foreground">
          Reading Samsung Health needs Android 14 or later on this phone.
        </p>
      ) : null}

      {android && problem && report ? <SyncReport report={report} /> : null}

      {hasData ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {tiles.map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-xl bg-secondary p-3">
                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{label}</span>
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {value ?? <span className="text-sm font-normal text-muted-foreground">—</span>}
                </p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">History</p>
            <RangeToggle
              label="History range"
              value={range}
              onChange={setRange}
              options={[
                { value: 7, label: "7 days" },
                { value: 30, label: "30 days" },
                { value: 90, label: "90 days" },
              ]}
            />
          </div>
          <DayChart
            title="Steps"
            days={days}
            values={steps}
            color="var(--chart-2)"
            format={(v) => `${Math.round(v).toLocaleString()} steps`}
          />
          <DayChart
            title="Sleep"
            days={days}
            values={sleep}
            color="var(--chart-5)"
            format={(v) => minutesLabel(v)}
          />
        </>
      ) : !android ? (
        <p className="text-sm text-muted-foreground">
          Connect it from the Life OS Android app, or import a Samsung Health download below.
        </p>
      ) : null}
      <SamsungImport />
    </section>
  );
}

/** Bars per day with the average of the days that have data. */
function DayChart({
  title,
  days,
  values,
  color,
  format: formatValue,
}: {
  title: string;
  days: string[];
  values: (number | null)[];
  color: string;
  format: (value: number) => string;
}) {
  const logged = values.filter((v): v is number => v != null && v > 0);
  if (!logged.length) {
    return <p className="text-xs text-muted-foreground">{title}: nothing in this range.</p>;
  }
  const max = Math.max(...logged);
  const average = logged.reduce((a, b) => a + b, 0) / logged.length;
  const dense = days.length > 14;
  return (
    <div>
      <p className="mb-2 flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{title}</span>
        <span className="tabular-nums">
          {formatValue(average)} a day on average · {logged.length} of {days.length} days
        </span>
      </p>
      <div
        className="grid items-end"
        style={{
          height: 88,
          gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
          gap: dense ? 2 : 6,
        }}
      >
        {days.map((day, index) => {
          const value = values[index] ?? 0;
          return (
            <div key={day} className="flex h-full flex-col items-center justify-end gap-1">
              <span
                className={cn("w-full rounded-sm", !dense && "max-w-7 rounded-md")}
                title={`${format(parseISO(day), "EEE d MMM")}: ${value ? formatValue(value) : "nothing logged"}`}
                style={{
                  height: Math.max(3, (value / max) * 64),
                  background: value ? color : "var(--color-border)",
                }}
              />
              {!dense ? (
                <span className="text-[10px] uppercase text-muted-foreground">
                  {format(parseISO(day), "EEEEE")}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      {dense ? (
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>{format(parseISO(days[0]!), "d MMM")}</span>
          <span>{format(parseISO(days.at(-1)!), "d MMM")}</span>
        </div>
      ) : null}
    </div>
  );
}

const PERMISSION_LABELS: Record<string, string> = {
  READ_STEPS: "steps",
  READ_SLEEP: "sleep",
  READ_HEART_RATE: "heart rate",
  READ_WEIGHT: "weight",
  READ_EXERCISE: "exercise",
  READ_ACTIVE_CALORIES_BURNED: "active calories",
};
const SAMSUNG_HEALTH = "com.sec.android.app.shealth";

/** What the last sync actually got from the phone, and what is in the way. */
function SyncReport({ report }: { report: HealthSyncReport }) {
  const missing = report.missing.map(
    (permission) => PERMISSION_LABELS[permission.split(".").pop() ?? ""] ?? permission,
  );
  const kinds = Object.entries(report.byKind);
  return (
    <div className="space-y-3 rounded-xl border border-border p-4 text-sm">
      <p className="font-medium">Last sync</p>
      {kinds.length ? (
        <p className="text-muted-foreground">
          Read {kinds.map(([kind, count]) => `${count} ${kind.replace(/_/g, " ")}`).join(", ")}
          {report.sources.length
            ? ` from ${report.sources.map((s) => (s === SAMSUNG_HEALTH ? "Samsung Health" : s)).join(", ")}`
            : ""}
          .
        </p>
      ) : (
        <p className="text-muted-foreground">
          Health Connect returned nothing for the last 30 days.
        </p>
      )}
      {missing.length ? (
        <div className="space-y-2">
          <p>Life OS isn't allowed to read: {missing.join(", ")}.</p>
          <Button type="button" size="sm" onClick={() => openHealthSettings("app")}>
            Allow in Health Connect
          </Button>
        </div>
      ) : null}
      {report.errors.length ? (
        <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          {report.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
      <details className="rounded-lg bg-secondary px-3 py-2 text-xs">
        <summary className="cursor-pointer font-medium">Technical details</summary>
        <pre className="mt-2 whitespace-pre-wrap break-all font-mono text-[11px] text-muted-foreground">
          {JSON.stringify(report.diagnostics, null, 1)}
        </pre>
      </details>
      {!kinds.length ? (
        <div className="space-y-2 text-muted-foreground">
          <p>
            Samsung Health only shares what it's told to. Open{" "}
            <span className="text-foreground">Samsung Health → Settings → Health Connect</span>,
            turn on sharing for steps, sleep, heart rate, exercise and weight, then tap Sync now.
            Samsung Health may take a few minutes to copy its data over.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => openHealthSettings("home")}
          >
            Open Health Connect
          </Button>
        </div>
      ) : null}
    </div>
  );
}
