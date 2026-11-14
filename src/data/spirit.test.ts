import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import {
  DAY_ORDER,
  duhaStart,
  isSunnah,
  loggablePrayers,
  PRAYER_NAMES,
  prayerLabel,
  prayerWindowEnds,
} from "./spirit";

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
  it("puts the sunnah of Fajr first, Duha between Fajr and Dhuhr, and Witr last", () => {
    expect(DAY_ORDER).toEqual([
      "sunnah_fajr",
      "fajr",
      "duha",
      "dhuhr",
      "asr",
      "maghrib",
      "isha",
      "witr",
    ]);
    expect(prayerLabel("sunnah_fajr")).toBe("Sunnah of Fajr");
    expect(prayerLabel("duha")).toBe("Duha");
    expect(prayerLabel("witr")).toBe("Witr");
  });

  it("shows Duha in the demo, and elsewhere only once the database accepts it", () => {
    expect(loggablePrayers(true)).toContain("duha");
    expect(loggablePrayers(false)).not.toContain("duha");
    expect(loggablePrayers(false)).toHaveLength(7);
  });

  it("starts Duha a quarter of an hour after sunrise", () => {
    expect(duhaStart(new Date(2026, 10, 14, 6, 10))).toEqual(new Date(2026, 10, 14, 6, 25));
  });

  it("keeps them out of the five", () => {
    expect(PRAYER_NAMES.some((name) => isSunnah(name))).toBe(false);
    expect(isSunnah("witr")).toBe(true);
    expect(isSunnah("sunnah_fajr")).toBe(true);
    expect(isSunnah("duha")).toBe(true);
  });
});
