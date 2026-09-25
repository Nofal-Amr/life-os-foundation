import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { buildWidgetPayload } from "./prayerWidget";
import type { PrayerLog } from "./spirit";

const timesFor = (date: string) => {
  const at = (h: number) => new Date(`${date}T${String(h).padStart(2, "0")}:00:00`);
  return { fajr: at(5), dhuhr: at(12), asr: at(15), maghrib: at(18), isha: at(20) };
};

describe("buildWidgetPayload", () => {
  it("covers yesterday, today and tomorrow with statuses", () => {
    const logs = [
      {
        prayer_date: "2026-09-25",
        prayer_name: "fajr",
        status: "jamaah",
        completed: true,
        on_time: true,
      },
    ] as unknown as PrayerLog[];
    const payload = buildWidgetPayload({
      today: "2026-09-25",
      place: "Cairo",
      logs,
      timesFor,
      now: 1,
    });
    expect(payload.days.map((day) => day.date)).toEqual(["2026-09-24", "2026-09-25", "2026-09-26"]);
    expect(payload.days[1]!.prayers[0]).toMatchObject({ key: "fajr", status: "jamaah" });
    expect(payload.days[1]!.prayers[1]!.status).toBeNull();
    expect(payload.place).toBe("Cairo");
  });

  it("calls Dhuhr Jumu'ah on a Friday", () => {
    const payload = buildWidgetPayload({ today: "2026-09-25", place: null, logs: [], timesFor });
    expect(payload.days[1]!.prayers[1]!.label).toBe("Jumu'ah");
    expect(payload.days[0]!.prayers[1]!.label).toBe("Dhuhr");
    expect(payload.place).toBe("Prayer times");
  });
});
