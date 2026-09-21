import { describe, expect, it } from "vitest";

import {
  entryMinutes,
  formatClock,
  formatMinutes,
  minutesByDay,
  minutesByKey,
  minutesByTask,
  runningEntry,
  type TimeEntry,
} from "./time";

const at = (day: string, time: string) => new Date(`${day}T${time}:00`).toISOString();
const entry = (extra: Partial<TimeEntry>) =>
  ({
    id: Math.random().toString(),
    activity_id: null,
    task_id: null,
    label: null,
    ended_at: null,
    ...extra,
  }) as TimeEntry;

describe("time tracking", () => {
  const gaming = entry({
    activity_id: "g",
    started_at: at("2026-09-20", "20:00"),
    ended_at: at("2026-09-20", "21:30"),
  });
  const task = entry({
    task_id: "t1",
    started_at: at("2026-09-21", "09:00"),
    ended_at: at("2026-09-21", "09:45"),
  });
  const running = entry({ activity_id: "g", started_at: at("2026-09-21", "18:00") });
  const now = new Date(at("2026-09-21", "18:20")).getTime();

  it("counts a finished entry and a running one up to now", () => {
    expect(entryMinutes(gaming)).toBe(90);
    expect(entryMinutes(running, now)).toBe(20);
    expect(runningEntry([gaming, running])).toBe(running);
  });

  it("totals minutes per day and per activity or task", () => {
    const days = ["2026-09-20", "2026-09-21"];
    expect(minutesByDay([gaming, task, running], days, now)).toEqual([90, 65]);
    const byKey = minutesByKey([gaming, task, running], days, now);
    expect(byKey.get("a:g")).toBe(110);
    expect(byKey.get("t:t1")).toBe(45);
    expect(minutesByTask([gaming, task]).get("t1")).toBe(45);
  });

  it("formats durations and clocks", () => {
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(90)).toBe("1 h 30");
    expect(formatMinutes(120)).toBe("2 h");
    expect(formatClock(3_723_000)).toBe("01:02:03");
  });
});
