import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { prayerLabel, prayerWindowEnds } from "./spirit";

describe("prayerLabel", () => {
  it("calls Dhuhr Jumu'ah on Fridays only", () => {
    expect(prayerLabel("dhuhr", "2026-09-25")).toBe("Jumu'ah"); // a Friday
    expect(prayerLabel("dhuhr", "2026-09-24")).toBe("Dhuhr");
    expect(prayerLabel("asr", "2026-09-25")).toBe("Asr");
    expect(prayerLabel("dhuhr")).toBe("Dhuhr");
  });
});

describe("prayerWindowEnds", () => {
  it("ends Fajr at sunrise and Isha at the next Fajr", () => {
    const at = (h: number) => new Date(2026, 8, 25, h);
    const ends = prayerWindowEnds(
      { fajr: at(4), sunrise: at(6), dhuhr: at(12), asr: at(15), maghrib: at(18), isha: at(19) },
      new Date(2026, 8, 26, 4),
    );
    expect(ends.fajr).toEqual(at(6));
    expect(ends.dhuhr).toEqual(at(15));
    expect(ends.maghrib).toEqual(at(19));
    expect(ends.isha).toEqual(new Date(2026, 8, 26, 4));
  });
});
