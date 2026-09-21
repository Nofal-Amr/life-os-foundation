import { describe, expect, it } from "vitest";

import { dailyValues, lastDays, type HealthSample } from "./healthSamples";

const s = (kind: string, value: number, start: string, end: string | null = null) =>
  ({ kind, value, start_at: start, end_at: end }) as HealthSample;

describe("daily health values", () => {
  const days = ["2026-09-20", "2026-09-21"];

  it("adds up steps per day and leaves empty days empty", () => {
    const samples = [
      s("steps", 1200, "2026-09-21T08:00:00"),
      s("steps", 800, "2026-09-21T18:00:00"),
    ];
    expect(dailyValues(samples, "steps", days)).toEqual([null, 2000]);
  });

  it("counts sleep on the day it ends", () => {
    const samples = [s("sleep", 420, "2026-09-20T23:30:00", "2026-09-21T06:30:00")];
    expect(dailyValues(samples, "sleep", days)).toEqual([null, 420]);
  });

  it("averages heart rate and keeps the latest weight", () => {
    const samples = [
      s("heart_rate", 60, "2026-09-21T08:00:00"),
      s("heart_rate", 80, "2026-09-21T09:00:00"),
      s("weight", 81.2, "2026-09-21T07:00:00"),
      s("weight", 80.9, "2026-09-21T21:00:00"),
    ];
    expect(dailyValues(samples, "heart_rate", days)).toEqual([null, 70]);
    expect(dailyValues(samples, "weight", days)).toEqual([null, 80.9]);
  });

  it("lists the last N days ending today", () => {
    expect(lastDays(3, "2026-09-21")).toEqual(["2026-09-19", "2026-09-20", "2026-09-21"]);
  });
});
