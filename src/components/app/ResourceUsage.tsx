import { format } from "date-fns";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { usageBuckets, type UsagePeriod } from "@/data/resourceUsage";
import { cn } from "@/lib/utils";

const axisProps = {
  tickLine: false,
  axisLine: false,
  tickMargin: 8,
  className: "text-xs",
} as const;
const gridProps = { vertical: false, strokeDasharray: "3 3", stroke: "var(--border)" } as const;

function round(value: number) {
  return value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
}

/**
 * How much of a resource was used per day or per month, worked out from its
 * readings. One series, so it wears the resource's own colour and needs no
 * legend; days no reading covers stay empty rather than showing zero.
 */
export function ResourceUsage({
  kind,
  unit,
  color,
  readings,
}: {
  kind: "meter" | "quota";
  unit: string;
  color?: string | null;
  readings: { reading: number | string; reading_at: string }[];
}) {
  const [period, setPeriod] = useState<UsagePeriod>("day");
  const buckets = useMemo(() => usageBuckets(kind, readings, period), [kind, readings, period]);
  const covered = buckets.filter((bucket) => bucket.value != null);
  const total = covered.reduce((sum, bucket) => sum + (bucket.value ?? 0), 0);
  const fill = color ?? "var(--primary)";
  const config: ChartConfig = { value: { label: "Used", color: fill } };
  const rows = buckets.map((bucket) => ({
    key: bucket.key,
    label: format(bucket.start, period === "day" ? "d MMM" : "MMM"),
    long: format(bucket.start, period === "day" ? "EEE d MMM" : "MMMM yyyy"),
    value: bucket.value == null ? null : round(bucket.value),
  }));

  return (
    <section className="mt-4 min-w-0" aria-label="Usage">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2xl font-semibold leading-none tabular-nums">
            {round(total)} <span className="text-sm font-normal text-muted-foreground">{unit}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {covered.length
              ? `Used over ${covered.length} ${period === "day" ? (covered.length === 1 ? "day" : "days") : covered.length === 1 ? "month" : "months"} with readings · about ${round(total / covered.length)} ${unit} a ${period}`
              : `No two readings cover the last ${period === "day" ? "30 days" : "12 months"} yet.`}
          </p>
        </div>
        <div
          className="flex gap-1 rounded-lg bg-secondary p-1"
          role="radiogroup"
          aria-label="Show usage by"
        >
          {(["day", "month"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={period === value}
              onClick={() => setPeriod(value)}
              className={cn(
                "min-h-8 rounded-md px-3 text-xs font-medium transition-colors",
                period === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              {value === "day" ? "Per day" : "Per month"}
            </button>
          ))}
        </div>
      </div>

      {covered.length ? (
        <div className="stat-well mt-3 px-2 pt-3 pb-1">
          <ChartContainer config={config} className="aspect-auto h-40 w-full justify-start">
            <BarChart
              data={rows}
              margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              barCategoryGap="18%"
            >
              <CartesianGrid {...gridProps} />
              <XAxis {...axisProps} dataKey="label" interval="preserveStartEnd" minTickGap={18} />
              <YAxis
                {...axisProps}
                width={40}
                tickFormatter={(value: number) => String(round(value))}
              />
              <ChartTooltip
                cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                content={
                  <ChartTooltipContent
                    hideIndicator
                    labelFormatter={(_, payload) => String(payload?.[0]?.payload?.long ?? "")}
                    formatter={(value) => (
                      <span className="font-medium tabular-nums">
                        {value == null ? "No reading" : `${value} ${unit}`}
                      </span>
                    )}
                  />
                }
              />
              <Bar
                dataKey="value"
                fill={fill}
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
                isAnimationActive={false}
              />
            </BarChart>
          </ChartContainer>
        </div>
      ) : null}

      {covered.length ? (
        <details className="mt-2 text-xs text-muted-foreground">
          <summary className="min-h-8 cursor-pointer select-none py-1">Show as a table</summary>
          <table className="mt-1 w-full max-w-xs tabular-nums">
            <tbody>
              {rows
                .filter((row) => row.value != null)
                .reverse()
                .map((row) => (
                  <tr key={row.key} className="border-t border-border/60">
                    <td className="py-1.5 pr-4">{row.long}</td>
                    <td className="py-1.5 text-right text-foreground">
                      {row.value} {unit}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </details>
      ) : null}
    </section>
  );
}
