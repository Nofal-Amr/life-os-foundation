import { addDays, format } from "date-fns";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { PLANS, planTasks } from "./plans";

describe("plans", () => {
  it("spreads every plan within its length, in date order", () => {
    const start = new Date(2026, 9, 8);
    for (const plan of PLANS) {
      const tasks = planTasks(plan, start);
      expect(tasks.length).toBeGreaterThan(3);
      expect(tasks[0]!.due).toBe("2026-10-08");
      const last = format(addDays(start, plan.days - 1), "yyyy-MM-dd");
      expect(tasks.every((task) => task.due <= last)).toBe(true);
      expect([...tasks].map((t) => t.due)).toEqual([...tasks].map((t) => t.due).sort());
    }
  });

  it("declutter has one area a day for a week", () => {
    const declutter = PLANS.find((plan) => plan.id === "declutter-7")!;
    expect(new Set(planTasks(declutter, new Date(2026, 9, 8)).map((t) => t.due)).size).toBe(7);
  });
});
