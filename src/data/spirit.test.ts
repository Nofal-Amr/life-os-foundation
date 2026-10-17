import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { DAY_ORDER, isSunnah, PRAYER_NAMES, prayerLabel, prayerWindowEnds } from "./spirit";

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

describe("sunnah prayers", () => {
  it("puts the sunnah of Fajr first and Witr last, around the five", () => {
    expect(DAY_ORDER).toEqual(["sunnah_fajr", ...PRAYER_NAMES, "witr"]);
    expect(prayerLabel("sunnah_fajr")).toBe("Sunnah of Fajr");
    expect(prayerLabel("witr")).toBe("Witr");
  });

  it("keeps them out of the five", () => {
    expect(PRAYER_NAMES.some((name) => isSunnah(name))).toBe(false);
    expect(isSunnah("witr")).toBe(true);
    expect(isSunnah("sunnah_fajr")).toBe(true);
  });
});
