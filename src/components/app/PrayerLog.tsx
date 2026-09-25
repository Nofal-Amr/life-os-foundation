import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addDays, format, parseISO } from "date-fns";
import { Check, Clock, Users, X, Zap, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useXp } from "@/hooks/useXp";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  PRAYER_LABELS,
  prayerLabel,
  PRAYER_NAMES,
  PRAYER_STATUSES,
  PRAYER_STATUS_LABELS,
  prayerStatusCounts,
  setPrayerStatus,
  spiritKeys,
  statusOf,
  type PrayerLog,
  type PrayerName,
  type PrayerStatus,
} from "@/data/spirit";
import { track } from "@/lib/analytics";
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
      name: PrayerName;
      status: PrayerStatus | null;
    }) => {
      track("prayer_logged", { status });
      return setPrayerStatus(date, name, status);
    },
    onSuccess: (_data, { status }) => {
      if (status) xp.toast({ kind: "prayer", status });
    },
    onMutate: async ({ date, name, status }) => {
      await queryClient.cancelQueries({ queryKey: spiritKeys.logs });
      const previous = queryClient.getQueryData<PrayerLog[]>(spiritKeys.logs);
      if (previous) {
        const rest = previous.filter(
          (log) => !(log.prayer_date === date && log.prayer_name === name),
        );
        queryClient.setQueryData<PrayerLog[]>(
          spiritKeys.logs,
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
    onError: (error, _vars, previous) => {
      if (previous) queryClient.setQueryData(spiritKeys.logs, previous);
      toast.error(error instanceof Error ? error.message : "Couldn't save that.");
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: spiritKeys.logs }),
  });
}

export function StatusMark({ status, size = "size-4" }: { status: PrayerStatus; size?: string }) {
  const { icon: Icon } = STATUS_STYLE[status];
  return <Icon className={size} aria-hidden="true" />;
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
              {PRAYER_STATUS_LABELS[status]}
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
            Clear
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
}: {
  date: string;
  logs: PrayerLog[];
  times: Partial<Record<PrayerName, Date>> | null;
  next: PrayerName | null;
  formatTime: (date: Date) => string;
  disabled?: boolean | undefined;
}) {
  const setStatus = usePrayerStatus();
  return (
    <ul className="space-y-2">
      {PRAYER_NAMES.map((name) => {
        const status = statusOf(
          logs.find((log) => log.prayer_date === date && log.prayer_name === name),
        );
        const time = times?.[name];
        return (
          <li key={name}>
            <StatusPicker
              current={status}
              disabled={disabled}
              label={`How was ${prayerLabel(name, date)} prayed?`}
              onPick={(value) => setStatus.mutate({ date, name, status: value })}
            >
              <button
                type="button"
                className="stat-card flex min-h-16 w-full items-center gap-3 overflow-hidden p-0 text-left transition-transform active:scale-[0.99] disabled:opacity-50"
              >
                <span className="flex min-w-0 flex-1 items-baseline gap-3 px-4 py-3">
                  <span className="w-20 text-sm font-semibold">{prayerLabel(name, date)}</span>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {time ? formatTime(time) : "—"}
                  </span>
                  {next === name && !status ? (
                    <span className="text-2xs font-semibold uppercase tracking-wide text-primary">
                      Next
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
                      {PRAYER_STATUS_LABELS[status]}
                    </>
                  ) : (
                    "Log"
                  )}
                </span>
              </button>
            </StatusPicker>
          </li>
        );
      })}
    </ul>
  );
}

/** Dashboard and Week: five compact tiles. */
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
  return (
    <div className="grid min-w-0 grid-cols-5 gap-1.5">
      {PRAYER_NAMES.map((name) => {
        const status = statusOf(
          logs.find((log) => log.prayer_date === date && log.prayer_name === name),
        );
        const time = times?.[name];
        return (
          <StatusPicker
            key={name}
            current={status}
            disabled={disabled}
            label={`How was ${prayerLabel(name, date)} prayed?`}
            onPick={(value) => setStatus.mutate({ date, name, status: value })}
          >
            <button
              type="button"
              aria-label={`${prayerLabel(name, date)}: ${status ? PRAYER_STATUS_LABELS[status] : "not logged"}`}
              className={cn(
                "flex min-h-16 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-1 py-2 text-center transition-transform active:scale-[0.97] disabled:opacity-40",
                status ? "border-transparent text-white" : "border-border",
              )}
              style={status ? { background: STATUS_STYLE[status].color } : undefined}
            >
              <span className="w-full truncate text-xs font-medium">{prayerLabel(name, date)}</span>
              {time && formatTime ? (
                <span className="w-full truncate text-2xs tabular-nums opacity-80">
                  {formatTime(time)}
                </span>
              ) : null}
              <span className="flex items-center gap-1 text-2xs">
                {status ? (
                  <>
                    <StatusMark status={status} size="size-3" />
                    {PRAYER_STATUS_LABELS[status]}
                  </>
                ) : next === name ? (
                  <span className="font-semibold text-primary">Next</span>
                ) : (
                  <span className="text-muted-foreground">Log</span>
                )}
              </span>
            </button>
          </StatusPicker>
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
  const counts = prayerStatusCounts(logs, from, today);
  const byKey = new Map(
    logs.map((log) => [`${log.prayer_date}|${log.prayer_name}`, statusOf(log)]),
  );
  const dates = Array.from({ length: range }, (_, index) =>
    format(addDays(parseISO(from), index), "yyyy-MM-dd"),
  );
  const cell = range > 60 ? 6 : range > 20 ? 12 : 22;

  return (
    <section className="stat-card space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">How prayers were logged</p>
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
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {counts.logged === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing logged in this range yet.</p>
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
              {PRAYER_NAMES.map((name) => (
                <PrayerHeatRow key={name} name={name} dates={dates} byKey={byKey} cell={cell} />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PRAYER_STATUSES.map((status) => (
              <div key={status} className="rounded-xl bg-secondary p-3">
                <p
                  className="flex items-center gap-1.5 text-xs font-medium"
                  style={{ color: STATUS_STYLE[status].color }}
                >
                  <StatusMark status={status} size="size-3.5" />
                  <span className="text-foreground">{PRAYER_STATUS_LABELS[status]}</span>
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {Math.round((counts[status] / counts.logged) * 100)}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {counts[status]} of {counts.logged} logged
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
  name: PrayerName;
  dates: string[];
  byKey: Map<string, PrayerStatus | null>;
  cell: number;
}) {
  return (
    <>
      <span className="pr-2 text-2xs font-medium text-muted-foreground">
        {PRAYER_LABELS[name]}
      </span>
      {dates.map((date) => {
        const status = byKey.get(`${date}|${name}`) ?? null;
        return (
          <span
            key={date}
            title={`${prayerLabel(name, date)}, ${format(parseISO(date), "d MMM")}: ${status ? PRAYER_STATUS_LABELS[status] : "not logged"}`}
            className="rounded-[3px]"
            style={{
              width: cell,
              height: cell,
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
