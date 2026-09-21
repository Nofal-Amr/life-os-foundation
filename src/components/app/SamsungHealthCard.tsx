import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Activity, Footprints, HeartPulse, Moon, RefreshCw, Scale, Flame } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  dailyValues,
  healthSampleKeys,
  healthSamplesQuery,
  lastDays,
  lastHealthSync,
  syncHealthFromPhone,
  type HealthKind,
} from "@/data/healthSamples";
import { usePreferences } from "@/hooks/usePreferences";
import { todayISO } from "@/lib/date";
import { healthStatus, isAndroidApp, requestHealthAccess, type HealthStatus } from "@/lib/native";
import { cn } from "@/lib/utils";

const AUTO_SYNC_AFTER_MS = 30 * 60_000;

function minutesLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h ? `${h} h ${m} min` : `${m} min`;
}

/** Samsung Health figures on the Body page, synced from the phone. */
export function SamsungHealthCard() {
  const queryClient = useQueryClient();
  const samples = useQuery(healthSamplesQuery(30));
  const { fmtWeight } = usePreferences();
  const [status, setStatus] = useState<HealthStatus>("unavailable");
  const android = isAndroidApp();
  const today = todayISO();

  const sync = useMutation({
    mutationFn: () => syncHealthFromPhone(30),
    onSuccess: ({ saved }) => {
      void queryClient.invalidateQueries({ queryKey: healthSampleKeys.all });
      if (saved === 0) toast.message("Connected, but Samsung Health hasn't shared anything yet.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Couldn't read Samsung Health."),
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
    if (!last || Date.now() - last.getTime() > AUTO_SYNC_AFTER_MS) sync.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const rows = samples.data ?? [];
  const week = lastDays(7, today);
  const on = (kind: HealthKind) => dailyValues(rows, kind, [today])[0] ?? null;
  const latestWeight = rows.find((sample) => sample.kind === "weight");
  const steps7 = dailyValues(rows, "steps", week);
  const maxSteps = Math.max(0, ...steps7.map((v) => v ?? 0));
  const hasData = rows.length > 0;

  const tiles: { icon: typeof Footprints; label: string; value: string | null }[] = [
    {
      icon: Footprints,
      label: "Steps today",
      value: on("steps") == null ? null : Math.round(on("steps")!).toLocaleString(),
    },
    {
      icon: Moon,
      label: "Sleep last night",
      value: on("sleep") == null ? null : minutesLabel(on("sleep")!),
    },
    {
      icon: HeartPulse,
      label: "Heart rate today",
      value: on("heart_rate") == null ? null : `${Math.round(on("heart_rate")!)} bpm avg`,
    },
    {
      icon: Activity,
      label: "Exercise today",
      value: on("exercise") == null ? null : minutesLabel(on("exercise")!),
    },
    {
      icon: Flame,
      label: "Active today",
      value: on("active_calories") == null ? null : `${Math.round(on("active_calories")!)} kcal`,
    },
    {
      icon: Scale,
      label: latestWeight
        ? `Weight · ${format(new Date(latestWeight.start_at), "d MMM")}`
        : "Weight",
      value: latestWeight ? fmtWeight(latestWeight.value) : null,
    },
  ];

  return (
    <section className="stat-card space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Samsung Health</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {hasData
              ? `From your phone${lastHealthSync() ? ` · synced ${format(lastHealthSync()!, "d MMM, HH:mm")}` : ""}`
              : "Steps, sleep, heart rate, workouts and weight from your phone."}
          </p>
        </div>
        {android && status === "ready" ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={sync.isPending}
            onClick={() => sync.mutate()}
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
      {!android && !hasData ? (
        <p className="text-sm text-muted-foreground">
          Connect it once from the Life OS Android app; the figures then show here too.
        </p>
      ) : null}

      {hasData ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {tiles.map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-xl bg-secondary p-3">
                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Icon className="size-3.5" aria-hidden="true" />
                  {label}
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {value ?? <span className="text-sm font-normal text-muted-foreground">—</span>}
                </p>
              </div>
            ))}
          </div>
          {maxSteps > 0 ? (
            <div>
              <p className="mb-2 text-xs text-muted-foreground">Steps, last 7 days</p>
              <div className="grid grid-cols-7 items-end gap-1.5" style={{ height: 88 }}>
                {week.map((day, index) => {
                  const value = steps7[index] ?? 0;
                  return (
                    <div key={day} className="flex h-full flex-col items-center justify-end gap-1">
                      <span
                        className="w-full max-w-7 rounded-md"
                        title={`${format(parseISO(day), "EEE d MMM")}: ${Math.round(value).toLocaleString()} steps`}
                        style={{
                          height: Math.max(4, (value / maxSteps) * 64),
                          background: value ? "var(--chart-2)" : "var(--color-border)",
                        }}
                      />
                      <span className="text-[10px] uppercase text-muted-foreground">
                        {format(parseISO(day), "EEEEE")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
