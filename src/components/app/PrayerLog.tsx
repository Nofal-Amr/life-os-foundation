import { Slot } from "@radix-ui/react-slot";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format, parseISO } from "date-fns";
import { Check, Clock, Users, X, Zap, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useXp } from "@/hooks/useXp";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DAY_ORDER,
  isSunnah,
  PRAYER_SHORT_LABELS,
  prayerLabel,
  PRAYER_STATUSES,
  PRAYER_STATUS_LABELS,
  prayerStatusCounts,
  setPrayerStatus,
  spiritKeys,
  statusOf,
  sunnahLogsQuery,
  type LoggedPrayer,
  type PrayerLog,
  type PrayerName,
  type PrayerStatus,
} from "@/data/spirit";
import { track } from "@/lib/analytics";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Each status has its own icon and label, so colour never carries meaning on
 * its own, and no status is painted as good or bad.
 */
export const STATUS_STYLE: Record<PrayerStatus, { icon: LucideIcon; color: string }> = {
  jamaah: { icon: Users, color: "var(--chart-2)" },
  on_time: { icon: Check, color: "var(--chart-1)" },
  clutch: { icon: Zap, color: "var(--chart-3)" },
  late: { icon: Clock, color: "var(--chart-4)" },
  missed: { icon: X, color: "var(--color-muted-foreground)" },
};

/**
 * The soft outline around the sunnah prayers, so they read apart from the
 * five: the app's own accent, faded, so it stays quiet.
 */
const SUNNAH_COLOR = "color-mix(in oklch, var(--primary) 40%, transparent)";
const SUNNAH_RING = `0 0 0 1.5px ${SUNNAH_COLOR}`;

/** When each sunnah is prayed: shown with Fajr's time, and Witr with Isha's. */
const SUNNAH_HINT: Record<string, string> = {
  sunnah_fajr: "Before Fajr's fard",
  witr: "After Isha, before Fajr",
};

function timeOf(times: Partial<Record<PrayerName, Date>> | null | undefined, name: LoggedPrayer) {
  if (name === "sunnah_fajr") return times?.fajr;
  if (name === "witr") return times?.isha;
  return times?.[name];
}

/** The logs of the five (passed in) plus the sunnah logs. */
function useDayLogs(logs: PrayerLog[]): PrayerLog[] {
  const sunnah = useQuery(sunnahLogsQuery());
  return sunnah.data?.length ? [...logs, ...sunnah.data] : logs;
}

/** Sets a prayer's status with an instant, rolled-back-on-error update. */
export function usePrayerStatus() {
  const queryClient = useQueryClient();
  const xp = useXp();
  return useMutation({
    mutationFn: ({
      date,
      name,
      status,
    }: {
      date: string;
      name: LoggedPrayer;
      status: PrayerStatus | null;
    }) => {
      track("prayer_logged", { status });
      return setPrayerStatus(date, name, status);
    },
    onSuccess: (_data, { name, status }) => {
      // The game counts the five; the sunnah prayers earn nothing there.
      if (status && !isSunnah(name)) xp.toast({ kind: "prayer", status });
    },
    onMutate: async ({ date, name, status }) => {
      const key = isSunnah(name) ? spiritKeys.sunnah : spiritKeys.logs;
      await queryClient.cancelQueries({ queryKey: spiritKeys.logs });
      const previous = queryClient.getQueryData<PrayerLog[]>(key);
      if (previous) {
        const rest = previous.filter(
          (log) => !(log.prayer_date === date && log.prayer_name === name),
        );
        queryClient.setQueryData<PrayerLog[]>(
          key,
          status
            ? [
                {
                  id: `local-${date}-${name}`,
                  prayer_date: date,
                  prayer_name: name,
                  status,
                  completed: status !== "missed",
                  on_time: status === "late" ? false : status === "missed" ? null : true,
                } as PrayerLog,
                ...rest,
              ]
            : rest,
        );
      }
      return previous;
    },
    onError: (error, { name }, previous) => {
      if (previous) {
        queryClient.setQueryData(isSunnah(name) ? spiritKeys.sunnah : spiritKeys.logs, previous);
      }
      toast.error(error instanceof Error ? error.message : "Couldn't save that.");
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: spiritKeys.logs }),
  });
}

export function StatusMark({ status, size = "size-4" }: { status: PrayerStatus; size?: string }) {
  const { icon: Icon } = STATUS_STYLE[status];
  return <Icon className={size} aria-hidden="true" />;
}

/**
 * The sunnah prayers have one status, on time: a tap marks it, another
 * clears it. The five get the full picker.
 */
function StatusControl({
  name,
  current,
  disabled,
  onPick,
  children,
  label,
}: {
  name: LoggedPrayer;
  current: PrayerStatus | null;
  disabled?: boolean | undefined;
  onPick: (status: PrayerStatus | null) => void;
  children: ReactNode;
  label: string;
}) {
  if (!isSunnah(name)) {
    return (
      <StatusPicker current={current} disabled={disabled} onPick={onPick} label={label}>
        {children}
      </StatusPicker>
    );
  }
  return (
    <Slot
      aria-pressed={!!current}
      {...(disabled ? { disabled: true } : {})}
      onClick={() => onPick(current ? null : "on_time")}
    >
      {children}
    </Slot>
  );
}

/** The four statuses (and clear) in a small popover. */
function StatusPicker({
  current,
  disabled,
  onPick,
  children,
  label,
}: {
  current: PrayerStatus | null;
  disabled?: boolean | undefined;
  onPick: (status: PrayerStatus | null) => void;
  children: ReactNode;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-60 p-2" align="end">
        <p className="px-2 pb-1.5 pt-1 text-xs font-medium text-muted-foreground">{label}</p>
        <div className="grid grid-cols-2 gap-1.5">
          {PRAYER_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              aria-pressed={current === status}
              onClick={() => {
                onPick(status);
                setOpen(false);
              }}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm transition-colors active:scale-[0.98]",
                current === status
                  ? "border-transparent text-white"
                  : "border-border hover:bg-accent",
              )}
              style={current === status ? { background: STATUS_STYLE[status].color } : undefined}
            >
              <StatusMark status={status} />
              {t(PRAYER_STATUS_LABELS[status])}
            </button>
          ))}
        </div>
        {current ? (
          <button
            type="button"
            onClick={() => {
              onPick(null);
              setOpen(false);
            }}
            className="mt-1.5 w-full rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {t("Clear")}
          </button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

/** Spirit page: one row per prayer with its time and status. */
export function PrayerDayList({
  date,
  logs,
  times,
  next,
  formatTime,
  disabled,
  sunrise,
}: {
  date: string;
  logs: PrayerLog[];
  times: Partial<Record<PrayerName, Date>> | null;
  next: PrayerName | null;
  formatTime: (date: Date) => string;
  disabled?: boolean | undefined;
  /** Shown after Fajr when given: when Fajr's time ends. Nothing to log. */
  sunrise?: Date | null | undefined;
}) {
  const setStatus = usePrayerStatus();
  const dayLogs = useDayLogs(logs);
  const sunriseRow = sunrise ? (
    <li key="sunrise">
      <div className="flex min-h-11 items-baseline gap-3 rounded-xl border border-dashed border-border px-4 py-2.5">
        <span className="w-20 text-sm text-muted-foreground">{t("Sunrise")}</span>
        <span className="text-sm tabular-nums text-muted-foreground">{formatTime(sunrise)}</span>
        <span className="text-xs text-muted-foreground">{t("Fajr's time ends")}</span>
      </div>
    </li>
  ) : null;
  return (
    <ul className="space-y-2">
      {DAY_ORDER.flatMap((name) => {
        const status = statusOf(
          dayLogs.find((log) => log.prayer_date === date && log.prayer_name === name),
        );
        const time = timeOf(times, name);
        const sunnah = isSunnah(name);
        const row = (
          <li key={name}>
            <StatusControl
              name={name}
              current={status}
              disabled={disabled}
              label={`${t("How was it prayed?")} ${prayerLabel(name, date)}`}
              onPick={(value) => setStatus.mutate({ date, name, status: value })}
            >
              <button
                type="button"
                className="stat-card flex min-h-16 w-full items-center gap-3 overflow-hidden p-0 text-left transition-transform active:scale-[0.99] disabled:opacity-50"
                style={sunnah ? { boxShadow: SUNNAH_RING } : undefined}
              >
                <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-3">
                  <span className={cn("text-sm font-semibold", sunnah ? "min-w-20" : "w-20")}>
                    {prayerLabel(name, date)}
                  </span>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {time ? formatTime(time) : "—"}
                  </span>
                  {sunnah ? (
                    <span className="text-xs text-muted-foreground">{t(SUNNAH_HINT[name]!)}</span>
                  ) : null}
                  {next === name && !status ? (
                    <span className="text-2xs font-semibold uppercase tracking-wide text-primary">
                      {t("Next")}
                    </span>
                  ) : null}
                </span>
                <span
                  className={cn(
                    "flex h-full min-h-16 w-28 shrink-0 flex-col items-center justify-center gap-1 text-xs font-medium",
                    status ? "text-white" : "border-l border-border text-muted-foreground",
                  )}
                  style={
                    status
                      ? {
                          background: STATUS_STYLE[status].color,
                          clipPath: "polygon(14% 0, 100% 0, 100% 100%, 0 100%)",
                        }
                      : undefined
                  }
                >
                  {status ? (
                    <>
                      <StatusMark status={status} size="size-5" />
                      {t(PRAYER_STATUS_LABELS[status])}
                    </>
                  ) : (
                    t("Log")
                  )}
                </span>
              </button>
            </StatusControl>
          </li>
        );
        return name === "fajr" && sunriseRow ? [row, sunriseRow] : [row];
      })}
    </ul>
  );
}

/** Dashboard and Week: compact tiles, the five with the sunnah of Fajr and Witr. */
export function PrayerTiles({
  date,
  logs,
  times,
  next,
  formatTime,
  disabled,
}: {
  date: string;
  logs: PrayerLog[];
  times?: Partial<Record<PrayerName, Date>> | null | undefined;
  next?: PrayerName | null | undefined;
  formatTime?: ((date: Date) => string) | undefined;
  disabled?: boolean | undefined;
}) {
  const setStatus = usePrayerStatus();
  const dayLogs = useDayLogs(logs);
  return (
    <div className="grid min-w-0 grid-cols-7 gap-1.5">
      {DAY_ORDER.map((name) => {
        const status = statusOf(
          dayLogs.find((log) => log.prayer_date === date && log.prayer_name === name),
        );
        const time = timeOf(times, name);
        return (
          <StatusControl
            key={name}
            name={name}
            current={status}
            disabled={disabled}
            label={`${t("How was it prayed?")} ${prayerLabel(name, date)}`}
            onPick={(value) => setStatus.mutate({ date, name, status: value })}
          >
            <button
              type="button"
              aria-label={`${prayerLabel(name, date)}: ${status ? t(PRAYER_STATUS_LABELS[status]) : t("not logged")}`}
              className={cn(
                "flex min-h-16 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-1 py-2 text-center transition-transform active:scale-[0.97] disabled:opacity-40",
                status ? "border-transparent text-white" : "border-border",
              )}
              style={{
                ...(status ? { background: STATUS_STYLE[status].color } : {}),
                ...(isSunnah(name) ? { boxShadow: SUNNAH_RING } : {}),
              }}
            >
              <span className="w-full truncate text-xs font-medium">
                {name === "sunnah_fajr" ? t(PRAYER_SHORT_LABELS[name]) : prayerLabel(name, date)}
              </span>
              {time && formatTime ? (
                <span className="w-full truncate text-2xs tabular-nums opacity-80">
                  {formatTime(time)}
                </span>
              ) : null}
              <span className="flex items-center gap-1 text-2xs">
                {status ? (
                  <>
                    <StatusMark status={status} size="size-3" />
                    {t(PRAYER_STATUS_LABELS[status])}
                  </>
                ) : next === name ? (
                  <span className="font-semibold text-primary">{t("Next")}</span>
                ) : (
                  <span className="text-muted-foreground">{t("Log")}</span>
                )}
              </span>
            </button>
          </StatusControl>
        );
      })}
    </div>
  );
}

const RANGES = [
  { days: 14, label: "2 weeks" },
  { days: 30, label: "Month" },
  { days: 365, label: "Year" },
] as const;

/** Heatmap of statuses (prayers × days) and a count per status. */
export function PrayerStats({ logs, today }: { logs: PrayerLog[]; today: string }) {
  const [range, setRange] = useState<(typeof RANGES)[number]["days"]>(14);
  const from = format(addDays(parseISO(today), -(range - 1)), "yyyy-MM-dd");
  // The counts are of the five; the heatmap also shows the sunnah rows.
  const counts = prayerStatusCounts(logs, from, today);
  const allLogs = useDayLogs(logs);
  const byKey = new Map(
    allLogs.map((log) => [`${log.prayer_date}|${log.prayer_name}`, statusOf(log)]),
  );
  const dates = Array.from({ length: range }, (_, index) =>
    format(addDays(parseISO(from), index), "yyyy-MM-dd"),
  );
  const cell = range > 60 ? 6 : range > 20 ? 12 : 22;

  return (
    <section className="stat-card space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">{t("How prayers were logged")}</p>
        <div
          className="inline-flex gap-1 rounded-xl bg-secondary p-1"
          role="radiogroup"
          aria-label="Range"
        >
          {RANGES.map((option) => (
            <button
              key={option.days}
              type="button"
              role="radio"
              aria-checked={range === option.days}
              onClick={() => setRange(option.days)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                range === option.days
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground",
              )}
            >
              {t(option.label)}
            </button>
          ))}
        </div>
      </div>

      {counts.logged === 0 ? (
        <p className="text-sm text-muted-foreground">{t("Nothing logged in this range yet.")}</p>
      ) : (
        <>
          <div className="overflow-x-auto pb-1">
            <div
              className="inline-grid gap-[3px]"
              style={{ gridTemplateColumns: `auto repeat(${dates.length}, ${cell}px)` }}
            >
              {range <= 30 ? (
                <>
                  <span />
                  {dates.map((date) => (
                    <span
                      key={date}
                      className="text-center text-2xs tabular-nums text-muted-foreground"
                    >
                      {format(parseISO(date), "d")}
                    </span>
                  ))}
                </>
              ) : null}
              {DAY_ORDER.map((name) => (
                <PrayerHeatRow key={name} name={name} dates={dates} byKey={byKey} cell={cell} />
              ))}
            </div>
          </div>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <span
              className="inline-block size-3 rounded-[3px] bg-border"
              style={{ boxShadow: SUNNAH_RING }}
              aria-hidden="true"
            />
            {t("Outlined: sunnah, not counted in the five.")}
          </p>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PRAYER_STATUSES.map((status) => (
              <div key={status} className="rounded-xl bg-secondary p-3">
                <p
                  className="flex items-center gap-1.5 text-xs font-medium"
                  style={{ color: STATUS_STYLE[status].color }}
                >
                  <StatusMark status={status} size="size-3.5" />
                  <span className="text-foreground">{t(PRAYER_STATUS_LABELS[status])}</span>
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {Math.round((counts[status] / counts.logged) * 100)}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {counts[status]} {t("of")} {counts.logged} {t("logged")}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function PrayerHeatRow({
  name,
  dates,
  byKey,
  cell,
}: {
  name: LoggedPrayer;
  dates: string[];
  byKey: Map<string, PrayerStatus | null>;
  cell: number;
}) {
  const sunnah = isSunnah(name);
  return (
    <>
      <span
        className={cn(
          "pr-2 text-2xs font-medium",
          sunnah ? "text-primary/80" : "text-muted-foreground",
        )}
      >
        {t(PRAYER_SHORT_LABELS[name])}
      </span>
      {dates.map((date) => {
        const status = byKey.get(`${date}|${name}`) ?? null;
        return (
          <span
            key={date}
            title={`${prayerLabel(name, date)}, ${format(parseISO(date), "d MMM")}: ${status ? t(PRAYER_STATUS_LABELS[status]) : t("not logged")}`}
            className="rounded-[3px]"
            style={{
              width: cell,
              height: cell,
              ...(sunnah ? { boxShadow: `inset 0 0 0 ${cell > 10 ? 1.5 : 1}px ${SUNNAH_COLOR}` } : {}),
              background: status
                ? status === "missed"
                  ? "color-mix(in oklch, var(--color-muted-foreground) 45%, transparent)"
                  : STATUS_STYLE[status].color
                : "var(--color-border)",
            }}
          />
        );
      })}
    </>
  );
}
