import type { LucideIcon } from "lucide-react";
import { useId, type ReactNode } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

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
/** The same hue, faded, for ring tracks and area fills. */
const toneTint = (tone: ChartTone, percent: number) =>
  `color-mix(in oklch, var(--chart-${tone}) ${percent}%, transparent)`;

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
        className="mb-3 flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground"
      >
        <span aria-hidden className="size-1.5 rounded-full bg-primary" />
        At a glance
      </h2>
      <div className="grid min-w-0 items-start gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

/** Optional header decoration shared by every card. */
export type CardChrome = {
  /** Identifies the card; tinted with the card's series colour. */
  icon?: LucideIcon | undefined;
  /** A short factual tag on the right, such as the range a chart covers. */
  badge?: string | undefined;
};

export function StatCard({
  title,
  description,
  children,
  className,
  icon: Icon,
  tone,
  badge,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  tone?: ChartTone | undefined;
} & CardChrome) {
  return (
    <div className={cn("stat-card min-w-0 p-5", className)}>
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon ? (
            <span
              aria-hidden
              className="flex size-8 shrink-0 items-center justify-center rounded-lg"
              style={{
                background: tone ? toneTint(tone, 14) : "var(--muted)",
                color: tone ? toneColor(tone) : "var(--muted-foreground)",
              }}
            >
              <Icon className="size-4" />
            </span>
          ) : null}
          <p className="truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </p>
        </div>
        {badge ? (
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
            {badge}
          </span>
        ) : null}
      </div>
      {description ? <p className="mt-2 text-xs text-muted-foreground">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </div>
  );
}

/** Large figure with a quiet caption, the visual anchor of a card. */
function Hero({ value, caption }: { value: ReactNode; caption?: ReactNode }) {
  /* "82.4 kg" reads as a large figure with a small unit; the text is unchanged. */
  const unit = typeof value === "string" ? /^(-?[\d.,]+)\s+(\S+)$/.exec(value) : null;
  return (
    <div className="min-w-0">
      <p className="text-4xl font-semibold leading-none tracking-tight tabular-nums text-foreground">
        {unit ? (
          <>
            {unit[1]}
            <span className="ml-1 text-lg font-medium tracking-normal text-muted-foreground">
              {unit[2]}
            </span>
          </>
        ) : (
          value
        )}
      </p>
      {caption ? <p className="mt-2 text-xs text-muted-foreground">{caption}</p> : null}
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
        {/* The whole ring in a faint tint of the series colour. */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          stroke={toneTint(tone, 18)}
        />
        {/* The logged share, drawn solid. */}
        {fraction > 0 ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap={fraction >= 1 ? "butt" : "round"}
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

/** Splits "3 of 5" into the leading figure and the rest, so the figure can lead. */
function splitHeadline(headline: string): [string, string] {
  const match = /^(\S+)(.*)$/.exec(headline);
  return match ? [match[1] ?? headline, match[2] ?? ""] : [headline, ""];
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
  icon,
  badge,
  children,
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
  /** Actions under the ring, so the card is something you can act on. */
  children?: ReactNode;
} & CardChrome) {
  const [lead, rest] = splitHeadline(headline);
  return (
    <StatCard title={title} tone={tone} icon={icon} badge={badge}>
      <div className="flex min-w-0 items-center gap-5">
        <div className="stat-well shrink-0 rounded-full p-2">
          <Ring done={done} total={total} tone={tone} size={104} stroke={11} label={ringLabel}>
            <span className="font-mono text-base font-semibold tabular-nums">{center}</span>
          </Ring>
        </div>
        <Hero
          value={
            <>
              {lead}
              {rest ? (
                <span className="text-lg font-medium tracking-normal text-muted-foreground">
                  {rest}
                </span>
              ) : null}
            </>
          }
          caption={detail}
        />
      </div>
      {children ? <div className="mt-4 min-w-0">{children}</div> : null}
    </StatCard>
  );
}

/** A single latest value with its date, for a series that has no history. */
export function LatestValueCard({
  title,
  value,
  detail,
  tone,
  icon,
  badge,
}: {
  title: string;
  value: string;
  detail?: ReactNode;
  tone?: ChartTone | undefined;
} & CardChrome) {
  return (
    <StatCard title={title} tone={tone} icon={icon} badge={badge}>
      <Hero value={value} caption={detail} />
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

const gridProps = {
  vertical: false,
  strokeDasharray: "3 3",
  stroke: "var(--border)",
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
  icon,
  badge,
}: CardChrome & {
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
  /** A factual line under the chart, such as how many entries it draws on. */
  summary?: ReactNode;
}) {
  const gradientId = `trend-${useId().replace(/:/g, "")}`;
  const config: ChartConfig = { value: { label: seriesLabel, color: toneColor(tone) } };
  const latest = points[points.length - 1];
  /* Markers only while they stay readable; the hover layer covers the rest. */
  const showDots = points.length <= 14;
  return (
    <StatCard title={title} description={description} tone={tone} icon={icon} badge={badge}>
      {latest ? (
        <Hero value={formatValue(latest.value)} caption={`Latest, ${formatDate(latest.date)}`} />
      ) : null}
      <div className="stat-well mt-4 px-2 pt-3 pb-1">
        <ChartContainer config={config} className="aspect-auto h-40 w-full justify-start">
          <AreaChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={toneColor(tone)} stopOpacity={0.3} />
                <stop offset="100%" stopColor={toneColor(tone)} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridProps} />
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
              cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
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
            <Area
              dataKey="value"
              type="monotone"
              stroke="var(--color-value)"
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={
                showDots
                  ? { r: 4, fill: "var(--color-value)", stroke: "var(--stat-well)", strokeWidth: 2 }
                  : false
              }
              activeDot={{
                r: 5,
                fill: "var(--color-value)",
                stroke: "var(--stat-well)",
                strokeWidth: 2,
              }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ChartContainer>
      </div>
      {summary ? <p className="mt-3 text-xs text-muted-foreground">{summary}</p> : null}
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
  hero,
  legend = false,
  summary,
  icon,
  badge,
}: CardChrome & {
  title: string;
  description?: ReactNode;
  rows: ({ weekStart: string; label: string } & Record<string, number | string>)[];
  series: BarSeries[];
  formatValue: (value: number) => string;
  /** The headline figure for the whole chart, such as the total it shows. */
  hero?: { value: string; caption: string };
  /** Show the legend even for a single series. It always shows for two or more. */
  legend?: boolean;
  summary?: ReactNode;
}) {
  /* Colour follows the series' fixed slot; "Other" is always neutral. */
  const colorOf = (entry: BarSeries, index: number) =>
    entry.key === "other" ? "var(--muted-foreground)" : toneColor(((index % 5) + 1) as ChartTone);
  const config: ChartConfig = Object.fromEntries(
    series.map((entry, index) => [entry.key, { label: entry.label, color: colorOf(entry, index) }]),
  );
  const showLegend = legend || series.length > 1;
  return (
    <StatCard title={title} description={description} tone={1} icon={icon} badge={badge}>
      {hero ? <Hero value={hero.value} caption={hero.caption} /> : null}
      <div className={cn("stat-well px-2 pt-3 pb-1", hero ? "mt-4" : null)}>
        <ChartContainer config={config} className="aspect-auto h-44 w-full justify-start">
          <BarChart
            data={rows}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
            barCategoryGap="22%"
          >
            <CartesianGrid {...gridProps} />
            <XAxis {...axisProps} dataKey="label" interval="preserveStartEnd" minTickGap={16} />
            <YAxis
              {...axisProps}
              width={44}
              allowDecimals={false}
              tickFormatter={(value: number) => formatValue(value)}
            />
            <ChartTooltip
              cursor={{ fill: "var(--muted)", opacity: 0.5 }}
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
                /* A thin card-coloured edge keeps stacked segments apart. */
                stroke="var(--stat-well)"
                strokeWidth={series.length > 1 ? 1.5 : 0}
                radius={4}
                maxBarSize={32}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ChartContainer>
      </div>
      {showLegend ? (
        <ul className="mt-4 grid min-w-0 gap-2 text-sm sm:grid-cols-2">
          {series.map((entry, index) => (
            <li
              key={entry.key}
              className="flex min-w-0 items-center justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2"
            >
              <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                <span
                  aria-hidden
                  className="size-3 shrink-0 rounded-[4px]"
                  style={{ background: colorOf(entry, index) }}
                />
                <span className="truncate">{entry.label}</span>
              </span>
              <span className="shrink-0 font-mono text-[13px] font-medium tabular-nums text-foreground">
                {formatValue(entry.total)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {summary ? <p className="mt-3 text-xs text-muted-foreground">{summary}</p> : null}
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
