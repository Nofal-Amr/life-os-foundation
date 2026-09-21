import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

/**
 * Presentation for the "at a glance" cards. Nothing here computes or judges a
 * number: colours identify a series, never a good or bad reading, and every
 * figure is also written out as text.
 */

/** The five chart tokens from the theme; the same in every state of the data. */
export type ChartTone = 1 | 2 | 3 | 4 | 5;
const toneColor = (tone: ChartTone) => `var(--chart-${tone})`;

export function GlanceSection({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby="glance-heading" className={cn("mb-6", className)}>
      <h2
        id="glance-heading"
        className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground"
      >
        At a glance
      </h2>
      <div className="grid min-w-0 gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

export function StatCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("system-card min-w-0 p-4", className)}>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      <div className="mt-3">{children}</div>
    </div>
  );
}

/** Shown instead of any chart that has fewer than two real points. */
export function NotEnoughData({ hint }: { hint: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center">
      <p className="text-sm text-foreground">Not enough data yet</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

/* --------------------------------- rings --------------------------------- */

export function Ring({
  done,
  total,
  tone,
  size = 88,
  stroke = 9,
  label,
  children,
}: {
  done: number;
  total: number;
  tone: ChartTone;
  size?: number;
  stroke?: number;
  /** Spoken description, so the ring is never only a picture. */
  label: string;
  children?: ReactNode;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = total > 0 ? Math.min(1, Math.max(0, done / total)) : 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={label}
        className="-rotate-90"
        /* Inline, so a parent's `[&_svg]:size-*` rule (buttons) cannot shrink it. */
        style={{ width: size, height: size }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted-foreground/20"
        />
        {fraction > 0 ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            stroke={toneColor(tone)}
            strokeDasharray={`${fraction * circumference} ${circumference}`}
          />
        ) : null}
      </svg>
      {children ? (
        <div className="absolute inset-0 flex items-center justify-center text-center">
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** A ring card: the ring beside its plain-language figures. */
export function RingStat({
  title,
  done,
  total,
  center,
  headline,
  detail,
  tone,
  ringLabel,
}: {
  title: string;
  done: number;
  total: number;
  /** Short text inside the ring. */
  center: string;
  headline: string;
  detail?: ReactNode;
  tone: ChartTone;
  ringLabel: string;
}) {
  return (
    <StatCard title={title}>
      <div className="flex min-w-0 items-center gap-4">
        <Ring done={done} total={total} tone={tone} label={ringLabel}>
          <span className="text-base font-semibold tabular-nums">{center}</span>
        </Ring>
        <div className="min-w-0">
          <p className="text-2xl font-semibold tabular-nums tracking-tight">{headline}</p>
          {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
        </div>
      </div>
    </StatCard>
  );
}

/** A single latest value with its date, for a series that has no history. */
export function LatestValueCard({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail?: ReactNode;
}) {
  return (
    <StatCard title={title}>
      <p className="text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
      {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
    </StatCard>
  );
}

/* -------------------------------- trends --------------------------------- */

const axisProps = {
  tickLine: false,
  axisLine: false,
  tickMargin: 8,
  className: "text-[11px]",
} as const;

export function TrendLine({
  title,
  description,
  points,
  tone,
  formatValue,
  formatDate,
  formatAxisDate,
  formatTick,
  seriesLabel,
  summary,
}: {
  title: string;
  description?: ReactNode;
  points: { date: string; value: number }[];
  tone: ChartTone;
  formatValue: (value: number) => string;
  formatDate: (date: string) => string;
  /** A short form of the date for the axis; defaults to `formatDate`. */
  formatAxisDate?: (date: string) => string;
  /** A shorter form of the value for the axis; defaults to `formatValue`. */
  formatTick?: (value: number) => string;
  seriesLabel: string;
  /** A factual line under the chart, such as the latest value and its date. */
  summary?: ReactNode;
}) {
  const config: ChartConfig = { value: { label: seriesLabel, color: toneColor(tone) } };
  return (
    <StatCard title={title} description={description}>
      <ChartContainer config={config} className="aspect-auto h-44 w-full justify-start">
        <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            {...axisProps}
            dataKey="date"
            tickFormatter={formatAxisDate ?? formatDate}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            {...axisProps}
            width={44}
            tickFormatter={(value: number) => (formatTick ?? formatValue)(value)}
            domain={["auto", "auto"]}
          />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const date = payload?.[0]?.payload?.date;
                  return typeof date === "string" ? formatDate(date) : "";
                }}
                formatter={(value) => (
                  <span className="font-medium tabular-nums">{formatValue(Number(value))}</span>
                )}
              />
            }
          />
          <Line
            dataKey="value"
            type="monotone"
            stroke="var(--color-value)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--color-value)", strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartContainer>
      {summary ? <p className="mt-2 text-xs text-muted-foreground">{summary}</p> : null}
    </StatCard>
  );
}

export type BarSeries = { key: string; label: string; total: number };

/**
 * Weekly bars. With more than one series they stack, and a legend below the
 * chart writes out each series total so colour is never the only channel.
 */
export function WeeklyBars({
  title,
  description,
  rows,
  series,
  formatValue,
  summary,
}: {
  title: string;
  description?: ReactNode;
  rows: ({ weekStart: string; label: string } & Record<string, number | string>)[];
  series: BarSeries[];
  formatValue: (value: number) => string;
  summary?: ReactNode;
}) {
  const colorOf = (entry: BarSeries, index: number) =>
    entry.key === "other" ? "var(--muted-foreground)" : toneColor(((index % 5) + 1) as ChartTone);
  const config: ChartConfig = Object.fromEntries(
    series.map((entry, index) => [entry.key, { label: entry.label, color: colorOf(entry, index) }]),
  );
  return (
    <StatCard title={title} description={description}>
      <ChartContainer config={config} className="aspect-auto h-44 w-full justify-start">
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis {...axisProps} dataKey="label" interval="preserveStartEnd" minTickGap={16} />
          <YAxis
            {...axisProps}
            width={40}
            allowDecimals={false}
            tickFormatter={(value: number) => formatValue(value)}
          />
          <ChartTooltip
            cursor={{ fill: "var(--muted)", opacity: 0.4 }}
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const label = payload?.[0]?.payload?.label;
                  return typeof label === "string" ? `Week of ${label}` : "";
                }}
                formatter={(value, name) => (
                  <span className="flex w-full items-center justify-between gap-3">
                    <span className="text-muted-foreground">
                      {config[String(name)]?.label ?? String(name)}
                    </span>
                    <span className="font-medium tabular-nums">{formatValue(Number(value))}</span>
                  </span>
                )}
              />
            }
          />
          {series.map((entry, index) => (
            <Bar
              key={entry.key}
              dataKey={entry.key}
              stackId="week"
              fill={colorOf(entry, index)}
              radius={index === series.length - 1 ? [4, 4, 0, 0] : 0}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ChartContainer>
      {series.length > 1 ? (
        <ul className="mt-3 grid min-w-0 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
          {series.map((entry, index) => (
            <li key={entry.key} className="flex min-w-0 items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: colorOf(entry, index) }}
                />
                <span className="truncate">{entry.label}</span>
              </span>
              <span className="shrink-0 tabular-nums text-foreground">
                {formatValue(entry.total)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {summary ? <p className="mt-2 text-xs text-muted-foreground">{summary}</p> : null}
    </StatCard>
  );
}

/** A small two-way switch for how many days a trend looks back. */
export function RangeToggle<T extends number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
  label: string;
}) {
  return (
    <ToggleGroup
      type="single"
      size="sm"
      variant="outline"
      value={String(value)}
      aria-label={label}
      onValueChange={(next) => {
        const match = options.find((option) => String(option.value) === next);
        if (match) onChange(match.value);
      }}
    >
      {options.map((option) => (
        <ToggleGroupItem key={option.value} value={String(option.value)} className="px-3 text-xs">
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
