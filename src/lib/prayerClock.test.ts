import { describe, expect, it } from "vitest";

import { hijriDate, nextPrayerAt, timeLeft } from "./prayerClock";

const day = (hhmm: string, date = "2026-11-12") => new Date(`${date}T${hhmm}:00`);

const today = {
  fajr: day("04:50"),
  dhuhr: day("11:40"),
  asr: day("14:40"),
  maghrib: day("17:00"),
  isha: day("18:20"),
};
const tomorrowFajr = day("04:51", "2026-11-13");

describe("nextPrayerAt", () => {
  it("is Fajr before dawn", () => {
    expect(nextPrayerAt(day("03:00"), today, tomorrowFajr)).toEqual({
      name: "fajr",
      at: today.fajr,
      tomorrow: false,
    });
  });

  it("is the next one during the day", () => {
    expect(nextPrayerAt(day("12:00"), today, tomorrowFajr)?.name).toBe("asr");
    expect(nextPrayerAt(day("17:00"), today, tomorrowFajr)?.name).toBe("isha");
  });

  it("is tomorrow's Fajr after Isha", () => {
    expect(nextPrayerAt(day("21:00"), today, tomorrowFajr)).toEqual({
      name: "fajr",
      at: tomorrowFajr,
      tomorrow: true,
    });
  });
});

describe("timeLeft", () => {
  it("rounds up to whole minutes", () => {
    expect(timeLeft(30 * 1000)).toBe("1 min");
    expect(timeLeft(12 * 60 * 1000 + 1)).toBe("13 min");
  });

  it("shows hours and minutes", () => {
    expect(timeLeft(80 * 60 * 1000)).toBe("1 h 20 min");
    expect(timeLeft(120 * 60 * 1000)).toBe("2 h");
  });

  it("has an Arabic form", () => {
    expect(timeLeft(80 * 60 * 1000, "ar")).toBe("١ س ٢٠ د");
  });

  it("never goes below a minute", () => {
    expect(timeLeft(0)).toBe("1 min");
    expect(timeLeft(-5000)).toBe("1 min");
  });
});

describe("hijriDate", () => {
  it("gives the Umm al-Qura date in English", () => {
    // 1 Ramadan 1447 is 18 February 2026 in Umm al-Qura.
    expect(hijriDate(new Date("2026-02-18T12:00:00"), "en")).toMatch(/^1 Ramadan 1447/);
  });

  it("gives the date in Arabic", () => {
    const text = hijriDate(new Date("2026-02-18T12:00:00"), "ar");
    expect(text).toContain("رمضان");
    expect(text).toContain("١٤٤٧");
  });
});
