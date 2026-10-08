import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { achievements, bosses, dailyQuests, goldBalance, shieldedStreak, titleFor } from "./game";
import type { PrayerLog } from "./spirit";
import type { Task } from "./tasks";
import type { Project } from "./projects";

const NAMES = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
const fullDay = (date: string) =>
  NAMES.map(
    (name) =>
      ({
        prayer_date: date,
        prayer_name: name,
        status: "on_time",
        completed: true,
      }) as unknown as PrayerLog,
  );
const days = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => `2026-10-${String(from + i).padStart(2, "0")}`);

const empty = {
  tasks: [] as Task[],
  prayerLogs: [] as PrayerLog[],
  habitLogs: [],
  transactions: [],
  dhikrLogs: [],
  healthSamples: [],
  projects: [] as Project[],
};

describe("achievements", () => {
  it("dates each one by when it was really earned", () => {
    const tasks = [
      { status: "completed", completed_at: "2026-10-02T10:00:00Z" },
      { status: "completed", completed_at: "2026-10-01T09:00:00Z" },
      { status: "todo", completed_at: null },
    ] as Task[];
    const list = achievements({ ...empty, tasks, prayerLogs: days(1, 7).flatMap(fullDay) });
    const byId = new Map(list.map((a) => [a.id, a]));
    expect(byId.get("first-task")?.earnedOn).toBe("2026-10-01");
    expect(byId.get("tasks-50")?.progress).toEqual({ have: 2, need: 50 });
    expect(byId.get("full-day")?.earnedOn).toBe("2026-10-01");
    expect(byId.get("full-week")?.earnedOn).toBe("2026-10-07");
    expect(byId.get("jamaah-40")?.earnedOn).toBeNull();
  });
});

describe("shieldedStreak", () => {
  it("earns a shield every 7 full days and spends it on a missed day", () => {
    const logs = [...days(1, 7), ...days(9, 10)].flatMap(fullDay);
    expect(shieldedStreak(logs, "2026-10-10")).toEqual({ days: 9, shields: 0 });
  });

  it("breaks without a shield, and today doesn't count until it's over", () => {
    const logs = [...days(1, 3), ...days(5, 6)].flatMap(fullDay);
    expect(shieldedStreak(logs, "2026-10-07")).toEqual({ days: 2, shields: 0 });
  });
});

describe("quests, bosses, titles, gold", () => {
  it("counts today's quests from real rows", () => {
    const quests = dailyQuests(
      { ...empty, prayerLogs: fullDay("2026-10-08").slice(0, 3) },
      "2026-10-08",
      (a) => a === "spirit",
    );
    expect(quests.find((q) => q.id === "pray-five")).toMatchObject({
      have: 3,
      need: 5,
      done: false,
    });
  });

  it("makes a boss of each project with tasks", () => {
    const projects = [{ id: "p", status: "active" }] as Project[];
    const tasks = [
      { project_id: "p", status: "completed" },
      { project_id: "p", status: "todo" },
      { project_id: "p", status: "cancelled" },
    ] as Task[];
    expect(bosses(projects, tasks)[0]).toMatchObject({ hp: 2, hits: 1, defeated: false });
  });

  it("titles by level, gold from XP", () => {
    expect(titleFor(1).title).toBe("Novice");
    expect(titleFor(11)).toMatchObject({ title: "Adept", next: { level: 15, title: "Expert" } });
    expect(goldBalance(1234, 50)).toEqual({ earned: 123, spent: 50, balance: 73 });
  });
});
