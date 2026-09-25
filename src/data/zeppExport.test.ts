import { describe, expect, it } from "vitest";

import { looksLikeZepp, parseZeppExport, zeppTime } from "./zeppExport";

const activity = {
  name: "ACTIVITY/ACTIVITY_1695000000.csv",
  text: "date,steps,calories,distance,runDistance\n2026-09-23,8123,310,5900,120\n2026-09-24,0,0,0,0\n",
};
const sleep = {
  name: "SLEEP/SLEEP_1695000000.csv",
  text:
    "date,deepSleepTime,shallowSleepTime,wakeTime,start,stop,REMTime,naps\n" +
    "2026-09-24,95,260,12,2026-09-23 22:40:00+0000,2026-09-24 05:10:00+0000,40,\n",
};
const heart = {
  name: "HEARTRATE_AUTO/HEARTRATE_AUTO_1695000000.csv",
  text: "date,time,heartRate\n2026-09-24,08:00,60\n2026-09-24,08:10,70\n2026-09-24,08:20,300\n",
};

describe("zeppTime", () => {
  it("reads Zepp's UTC timestamps", () => {
    expect(zeppTime("2023-02-18 02:13:00+0000")).toBe("2023-02-18T02:13:00.000Z");
    expect(zeppTime("")).toBeNull();
  });
});

describe("parseZeppExport", () => {
  it("recognises a Zepp Life export", () => {
    expect(looksLikeZepp([activity])).toBe(true);
    expect(looksLikeZepp([{ name: "com.samsung.shealth.step_daily_trend.csv", text: "x" }])).toBe(
      false,
    );
  });

  it("turns daily steps, sleep windows and heart rate into samples", () => {
    const result = parseZeppExport([activity, sleep, heart]);
    expect(result.counts).toEqual({ steps: 1, sleep: 1, heart_rate: 1 });
    const steps = result.samples.find((sample) => sample.kind === "steps")!;
    expect(steps).toMatchObject({ value: 8123, external_id: "day-2026-09-23" });
    const night = result.samples.find((sample) => sample.kind === "sleep")!;
    expect(night.value).toBe(390); // 22:40 to 05:10
    const bpm = result.samples.find((sample) => sample.kind === "heart_rate")!;
    expect(bpm).toMatchObject({ value: 65, external_id: "hr-day-2026-09-24" }); // 300 ignored
    expect(result.files).toHaveLength(3);
  });
});
