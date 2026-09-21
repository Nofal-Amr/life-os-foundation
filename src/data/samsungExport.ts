/**
 * Reads a Samsung Health data download ("Download personal data" in Samsung
 * Health's settings). The download is a folder of CSVs, one per data type,
 * each starting with a metadata line, then a header row. Column names are
 * often prefixed (com.samsung.health.sleep.start_time), so columns are
 * matched by their last part. Times are UTC ("2024-05-01 06:12:00.000").
 *
 * Rows become health_samples: daily steps, sleep sessions, daily average
 * heart rate, weight readings and workouts. Steps use the same daily id as
 * the Health Connect sync, so a later sync replaces a day, not doubles it.
 */
import { format } from "date-fns";

import type { HealthKind } from "./healthSamples";

export type ImportedSample = {
  kind: HealthKind;
  value: number;
  unit: string;
  start_at: string;
  end_at: string | null;
  source: string;
  external_id: string;
};

const SOURCE = "samsung-export";

/** Parses one CSV line, honouring quoted fields. */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      out.push(field);
      field = "";
    } else field += char;
  }
  out.push(field);
  return out;
}

type Table = { rows: Record<string, string>[] };

/** Samsung CSVs: line 1 is metadata, line 2 the header. Keys are the last dotted part. */
export function parseSamsungCsv(text: string): Table {
  const lines = text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (lines.length < 2) return { rows: [] };
  // Some exports have no metadata line; detect by looking for a known column.
  const headerIndex = /start_time|day_time|datauuid/.test(lines[0]!) ? 0 : 1;
  const header = parseCsvLine(lines[headerIndex]!).map(
    (name) => name.trim().split(".").pop() ?? name,
  );
  const rows = lines.slice(headerIndex + 1).map((line) => {
    const cells = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((name, index) => {
      if (name && !(name in row)) row[name] = (cells[index] ?? "").trim();
    });
    return row;
  });
  return { rows };
}

/** "2024-05-01 06:12:00.000" (UTC) → ISO string; epoch ms also accepted. */
function utc(value: string | undefined): string | null {
  if (!value) return null;
  if (/^\d{10,}$/.test(value)) return new Date(Number(value)).toISOString();
  const date = new Date(value.replace(" ", "T") + (/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? "" : "Z"));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const num = (value: string | undefined) => (value == null || value === "" ? NaN : Number(value));

export type ImportResult = {
  samples: ImportedSample[];
  counts: Partial<Record<HealthKind, number>>;
  from: string | null;
  to: string | null;
  files: string[];
};

export function parseSamsungExport(files: { name: string; text: string }[]): ImportResult {
  const samples: ImportedSample[] = [];
  const used: string[] = [];
  const base = (name: string) => name.split(/[\\/]/).pop() ?? name;
  // Some downloads hold both step files; they describe the same days, so use one.
  const hasTrend = files.some((file) =>
    base(file.name).startsWith("com.samsung.shealth.step_daily_trend"),
  );

  for (const file of files) {
    const name = base(file.name);
    if (!name.endsWith(".csv")) continue;

    if (
      name.startsWith("com.samsung.shealth.step_daily_trend") ||
      (!hasTrend && name.startsWith("com.samsung.shealth.tracker.pedometer_day_summary"))
    ) {
      // One row per device per day. In step_daily_trend, source_type -2 is
      // Samsung's merged total; newer versions use pedometer_day_summary.
      const best = new Map<string, { steps: number; merged: boolean }>();
      for (const row of parseSamsungCsv(file.text).rows) {
        const steps = num(row["count"] || row["step_count"]);
        const at = utc(row["day_time"]);
        if (!at || !(steps > 0)) continue;
        const day = at.slice(0, 10);
        const merged = row["source_type"] === "-2";
        const current = best.get(day);
        if (
          !current ||
          (merged && !current.merged) ||
          (merged === current.merged && steps > current.steps)
        ) {
          best.set(day, { steps, merged });
        }
      }
      for (const [day, { steps }] of best) {
        const start = new Date(`${day}T00:00:00`);
        samples.push({
          kind: "steps",
          value: steps,
          unit: "count",
          start_at: start.toISOString(),
          end_at: new Date(start.getTime() + 86_400_000).toISOString(),
          source: SOURCE,
          external_id: `day-${day}`,
        });
      }
      used.push(name);
    } else if (
      name.startsWith("com.samsung.shealth.sleep.") ||
      name.startsWith("com.samsung.health.sleep.")
    ) {
      for (const row of parseSamsungCsv(file.text).rows) {
        const start = utc(row["start_time"]);
        const end = utc(row["end_time"]);
        if (!start || !end) continue;
        const minutes = (new Date(end).getTime() - new Date(start).getTime()) / 60_000;
        if (!(minutes > 0) || minutes > 24 * 60) continue;
        samples.push({
          kind: "sleep",
          value: Math.round(minutes),
          unit: "min",
          start_at: start,
          end_at: end,
          source: SOURCE,
          external_id: `sleep-${row["datauuid"] || start}`,
        });
        // Newer downloads include Samsung's own sleep score (0-100).
        const score = num(row["sleep_score"]);
        if (score > 0 && score <= 100) {
          samples.push({
            kind: "sleep_score",
            value: score,
            unit: "score",
            start_at: start,
            end_at: end,
            source: SOURCE,
            external_id: `sleep-score-${row["datauuid"] || start}`,
          });
        }
      }
      used.push(name);
    } else if (name.startsWith("com.samsung.shealth.tracker.heart_rate")) {
      // Thousands of readings: keep one daily average.
      const days = new Map<string, number[]>();
      for (const row of parseSamsungCsv(file.text).rows) {
        const bpm = num(row["heart_rate"]);
        const at = utc(row["start_time"]);
        if (!at || !(bpm > 20 && bpm < 250)) continue;
        const day = format(new Date(at), "yyyy-MM-dd");
        days.set(day, [...(days.get(day) ?? []), bpm]);
      }
      for (const [day, values] of days) {
        const start = new Date(`${day}T00:00:00`);
        samples.push({
          kind: "heart_rate",
          value: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
          unit: "bpm",
          start_at: start.toISOString(),
          end_at: new Date(start.getTime() + 86_400_000).toISOString(),
          source: SOURCE,
          external_id: `hr-day-${day}`,
        });
      }
      used.push(name);
    } else if (name.startsWith("com.samsung.health.weight")) {
      for (const row of parseSamsungCsv(file.text).rows) {
        const kg = num(row["weight"]);
        const at = utc(row["start_time"]);
        if (!at || !(kg > 20 && kg < 400)) continue;
        samples.push({
          kind: "weight",
          value: kg,
          unit: "kg",
          start_at: at,
          end_at: null,
          source: SOURCE,
          external_id: `weight-${row["datauuid"] || at}`,
        });
      }
      used.push(name);
    } else if (name.startsWith("com.samsung.shealth.exercise.") && !name.includes("weather")) {
      for (const row of parseSamsungCsv(file.text).rows) {
        const start = utc(row["start_time"]);
        const end = utc(row["end_time"]);
        if (!start) continue;
        const duration = num(row["duration"]);
        const minutes =
          duration > 0
            ? duration / 60_000
            : end
              ? (new Date(end).getTime() - new Date(start).getTime()) / 60_000
              : NaN;
        if (!(minutes > 0)) continue;
        samples.push({
          kind: "exercise",
          value: Math.round(minutes),
          unit: "min",
          start_at: start,
          end_at: end,
          source: SOURCE,
          external_id: `exercise-${row["datauuid"] || start}`,
        });
      }
      used.push(name);
    }
  }

  // One row per (kind, id): a single save can't touch the same row twice.
  const unique = new Map<string, ImportedSample>();
  for (const sample of samples) {
    const key = `${sample.kind}|${sample.external_id}`;
    const existing = unique.get(key);
    if (!existing || sample.value > existing.value) unique.set(key, sample);
  }
  samples.length = 0;
  samples.push(...unique.values());

  const counts: Partial<Record<HealthKind, number>> = {};
  for (const sample of samples) counts[sample.kind] = (counts[sample.kind] ?? 0) + 1;
  const times = samples.map((sample) => sample.start_at).sort();
  return { samples, counts, from: times[0] ?? null, to: times.at(-1) ?? null, files: used };
}
