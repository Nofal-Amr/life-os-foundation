/**
 * Reads a Zepp Life (formerly Mi Fit) data export: CSV files such as
 * ACTIVITY_*.csv, SLEEP_*.csv and HEARTRATE_AUTO_*.csv. The export arrives
 * as a password-protected .zip by email, so the CSVs are picked after
 * unzipping.
 *
 * - ACTIVITY: date,steps,calories,distance,runDistance (one row per day)
 * - SLEEP: date,deepSleepTime,shallowSleepTime,wakeTime,start,stop,REMTime,naps
 *   (minutes; start and stop in UTC like "2023-02-18 02:13:00+0000")
 * - HEARTRATE_AUTO: date,time,heartRate (local date and time)
 *
 * Steps and heart rate use the same daily ids as the Samsung import and the
 * Health Connect sync, so importing the same day twice replaces it.
 */
import { format } from "date-fns";

import type { HealthKind } from "./healthSamples";
import { parseCsvLine, type ImportResult, type ImportedSample } from "./samsungExport";

const SOURCE = "zepp-export";

function table(text: string): Record<string, string>[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (lines.length < 2) return [];
  const header = parseCsvLine(lines[0]!).map((name) => name.trim());
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((name, index) => (row[name] = (cells[index] ?? "").trim()));
    return row;
  });
}

/** "2023-02-18 02:13:00+0000" (UTC) → ISO; null when empty or invalid. */
export function zeppTime(value: string | undefined): string | null {
  if (!value) return null;
  const iso = value
    .trim()
    .replace(" ", "T")
    .replace(/([+-]\d\d)(\d\d)$/, "$1:$2");
  const date = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const num = (value: string | undefined) => (value == null || value === "" ? NaN : Number(value));
const base = (name: string) => name.split(/[\\/]/).pop() ?? name;

/** Whether picked files look like a Zepp Life export rather than Samsung's. */
export function looksLikeZepp(files: { name: string; text: string }[]): boolean {
  return files.some((file) => {
    const name = base(file.name).toUpperCase();
    const header = file.text.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? "";
    return (
      /^(ACTIVITY|SLEEP|HEARTRATE)/.test(name) ||
      /deepSleepTime|shallowSleepTime/.test(header) ||
      /^date,steps,/.test(header) ||
      /^date,time,heartRate/.test(header)
    );
  });
}

export function parseZeppExport(files: { name: string; text: string }[]): ImportResult {
  const samples: ImportedSample[] = [];
  const used: string[] = [];

  for (const file of files) {
    const name = base(file.name);
    const upper = name.toUpperCase();
    const header = file.text.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? "";

    if (upper.startsWith("ACTIVITY") || /^date,steps,/.test(header)) {
      if (upper.startsWith("ACTIVITY_MINUTE") || upper.startsWith("ACTIVITY_STAGE")) continue;
      for (const row of table(file.text)) {
        const day = row["date"];
        const steps = num(row["steps"]);
        if (!day || !/^\d{4}-\d\d-\d\d$/.test(day) || !(steps > 0)) continue;
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
    } else if (upper.startsWith("SLEEP") || /deepSleepTime/.test(header)) {
      for (const row of table(file.text)) {
        const start = zeppTime(row["start"]);
        const end = zeppTime(row["stop"]);
        const asleep =
          (num(row["deepSleepTime"]) || 0) +
          (num(row["shallowSleepTime"]) || 0) +
          (num(row["REMTime"]) || 0);
        // The sleep window, as the other sources record it; the asleep
        // minutes when the window is missing.
        const windowMinutes =
          start && end ? (new Date(end).getTime() - new Date(start).getTime()) / 60_000 : NaN;
        const minutes = windowMinutes > 0 ? windowMinutes : asleep;
        if (!(minutes > 0) || minutes > 24 * 60 || !start) continue;
        samples.push({
          kind: "sleep",
          value: Math.round(minutes),
          unit: "min",
          start_at: start,
          end_at: end,
          source: SOURCE,
          external_id: `sleep-${start}`,
        });
      }
      used.push(name);
    } else if (upper.startsWith("HEARTRATE") || /^date,time,heartRate/.test(header)) {
      const days = new Map<string, number[]>();
      for (const row of table(file.text)) {
        const bpm = num(row["heartRate"]);
        const day =
          row["date"] ??
          (zeppTime(row["time"]) ? format(new Date(zeppTime(row["time"])!), "yyyy-MM-dd") : "");
        if (!day || !(bpm > 20 && bpm < 250)) continue;
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
    }
  }

  const unique = new Map<string, ImportedSample>();
  for (const sample of samples) {
    const key = `${sample.kind}|${sample.external_id}`;
    const existing = unique.get(key);
    if (!existing || sample.value > existing.value) unique.set(key, sample);
  }
  const list = [...unique.values()];
  const counts: Partial<Record<HealthKind, number>> = {};
  for (const sample of list) counts[sample.kind] = (counts[sample.kind] ?? 0) + 1;
  const times = list.map((sample) => sample.start_at).sort();
  return { samples: list, counts, from: times[0] ?? null, to: times.at(-1) ?? null, files: used };
}
