import { describe, expect, it } from "vitest";

import { buildHub, levelFor, prayerStreak, statFor } from "./hub";
import type { PrayerLog } from "./spirit";
import type { Task } from "./tasks";

const prayers = (date: string, count: number, status = "on_time") =>
  ["fajr", "dhuhr", "asr", "maghrib", "isha"]
    .slice(0, count)
    .map(
      (name) => ({ prayer_date: date, prayer_name: name, status, completed: true }) as PrayerLog,
    );

const none = {
  tasks: [] as Task[],
  prayerLogs: [] as PrayerLog[],
  medications: [],
  medicationLogs: [],
  habits: [],
  habitLogs: [],
  transactions: [],
};

describe("hub", () => {
  it("levels up at 50 XP and gets gradually longer", () => {
    expect(levelFor(0)).toEqual({ level: 1, into: 0, span: 50 });
    expect(levelFor(50).level).toBe(2);
    expect(levelFor(112).level).toBe(2);
    expect(levelFor(113).level).toBe(3); // 50 + 63
  });

  it("turns a 7-day ratio into a 0-100 stat, or nothing without a denominator", () => {
    expect(statFor({ done: 7, total: 35 })).toBe(20);
    expect(statFor(null)).toBeNull();
  });

  it("counts days with all five prayed, forgiving an unfinished today", () => {
    const logs = [
      ...prayers("2026-09-19", 5),
      ...prayers("2026-09-20", 5),
      ...prayers("2026-09-21", 3),
    ];
    expect(prayerStreak(logs, "2026-09-21")).toBe(2);
    expect(prayerStreak([...prayers("2026-09-20", 5, "missed")], "2026-09-21")).toBe(0);
  });

  it("gives XP only for real rows and shows only enabled dimensions", () => {
    const hub = buildHub({
      ...none,
      today: "2026-09-21",
      tasks: [
        { id: "a", status: "completed", due_date: "2026-09-20", parent_task_id: null } as Task,
        { id: "b", status: "todo", due_date: "2026-09-21", parent_task_id: null } as Task,
      ],
      prayerLogs: [...prayers("2026-09-21", 2, "jamaah"), ...prayers("2026-09-20", 1, "late")],
      enabled: (d) => d === "work" || d === "spirit",
    });
    expect(hub.lines.map((l) => l.key)).toEqual(["work", "spirit"]);
    const work = hub.lines[0]!;
    expect(work.xp).toBe(10);
    expect(work.count).toBe("1 of 2 tasks done");
    expect(hub.lines[1]!.xp).toBe(15 * 2 + 5);
  });
});
