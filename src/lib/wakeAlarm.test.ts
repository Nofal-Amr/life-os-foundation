import { describe, expect, it } from "vitest";

import { DEFAULT_WAKE, minutesBefore, wakeAlarmAt } from "./wakeAlarm";

const at = (text: string) => new Date(text);

describe("minutesBefore", () => {
  it("uses the default unless a prayer has its own", () => {
    expect(minutesBefore(DEFAULT_WAKE, "fajr")).toBe(10);
    expect(minutesBefore({ minutes: 15, each: { sunrise: 20 } }, "sunrise")).toBe(20);
    expect(minutesBefore({ minutes: 15, each: { sunrise: 20 } }, "fajr")).toBe(15);
  });
});

describe("wakeAlarmAt", () => {
  const fajrToday = at("2026-11-13T04:47:00");
  const fajrTomorrow = at("2026-11-14T04:48:00");

  it("is today when there's still time", () => {
    expect(wakeAlarmAt(at("2026-11-13T01:00:00"), fajrToday, fajrTomorrow, 10)).toEqual({
      at: at("2026-11-13T04:37:00"),
      tomorrow: false,
    });
  });

  it("is tomorrow, from tomorrow's time, once today's has passed", () => {
    expect(wakeAlarmAt(at("2026-11-13T22:00:00"), fajrToday, fajrTomorrow, 10)).toEqual({
      at: at("2026-11-14T04:38:00"),
      tomorrow: true,
    });
  });

  it("crosses midnight backwards when the prayer is just after it", () => {
    const early = at("2026-06-21T00:05:00");
    const result = wakeAlarmAt(at("2026-06-20T21:00:00"), early, early, 20);
    expect(result.at).toEqual(at("2026-06-20T23:45:00"));
  });
});
