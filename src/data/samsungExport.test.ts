import { describe, expect, it } from "vitest";

import { parseCsvLine, parseSamsungExport } from "./samsungExport";

describe("Samsung Health download", () => {
  it("parses quoted CSV fields", () => {
    expect(parseCsvLine('a,"b,c","""d"""')).toEqual(["a", "b,c", '"d"']);
  });

  it("keeps Samsung's merged daily step total over per-device rows", () => {
    const csv = [
      "com.samsung.shealth.step_daily_trend,6302000,4",
      "binning_data,update_time,create_time,source_type,count,speed,distance,calorie,deviceuuid,pkg_name,day_time,datauuid,",
      ",x,x,0,4000,1,1,1,phone,pkg,1789948800000,u1,",
      ",x,x,-2,6500,1,1,1,all,pkg,1789948800000,u2,",
      ",x,x,0,3000,1,1,1,watch,pkg,1790035200000,u3,",
    ].join("\n");
    const result = parseSamsungExport([
      { name: "samsunghealth_x/com.samsung.shealth.step_daily_trend.20260921.csv", text: csv },
    ]);
    expect(result.counts.steps).toBe(2);
    expect(result.samples.map((s) => s.value)).toEqual([6500, 3000]);
    expect(result.samples[0]!.external_id).toMatch(/^day-\d{4}-\d{2}-\d{2}$/);
  });

  it("reads prefixed sleep, heart rate, weight and exercise columns", () => {
    const files = [
      {
        name: "com.samsung.shealth.sleep.20260921.csv",
        text: [
          "com.samsung.shealth.sleep,6302000,1",
          "com.samsung.health.sleep.start_time,com.samsung.health.sleep.end_time,com.samsung.health.sleep.datauuid",
          "2026-09-20 21:30:00.000,2026-09-21 05:00:00.000,s1",
        ].join("\n"),
      },
      {
        name: "com.samsung.shealth.tracker.heart_rate.20260921.csv",
        text: [
          "com.samsung.shealth.tracker.heart_rate,6302000,1",
          "com.samsung.health.heart_rate.start_time,com.samsung.health.heart_rate.heart_rate,com.samsung.health.heart_rate.datauuid",
          "2026-09-21 08:00:00.000,60,h1",
          "2026-09-21 09:00:00.000,80,h2",
        ].join("\n"),
      },
      {
        name: "com.samsung.health.weight.20260921.csv",
        text: [
          "com.samsung.health.weight,6302000,1",
          "start_time,weight,time_offset,datauuid",
          "2026-09-21 05:10:00.000,107.2,UTC+0300,w1",
        ].join("\n"),
      },
      {
        name: "com.samsung.shealth.exercise.20260921.csv",
        text: [
          "com.samsung.shealth.exercise,6302000,1",
          "com.samsung.health.exercise.start_time,com.samsung.health.exercise.end_time,com.samsung.health.exercise.duration,com.samsung.health.exercise.datauuid",
          "2026-09-21 16:00:00.000,2026-09-21 16:45:00.000,2700000,e1",
        ].join("\n"),
      },
    ];
    const result = parseSamsungExport(files);
    expect(result.counts).toEqual({ sleep: 1, heart_rate: 1, weight: 1, exercise: 1 });
    const by = new Map(result.samples.map((s) => [s.kind, s]));
    expect(by.get("sleep")!.value).toBe(450);
    expect(by.get("heart_rate")!.value).toBe(70);
    expect(by.get("weight")!.value).toBe(107.2);
    expect(by.get("exercise")!.value).toBe(45);
    expect(result.files).toHaveLength(4);
  });

  it("ignores files it doesn't know", () => {
    expect(
      parseSamsungExport([{ name: "com.samsung.health.floors_climbed.1.csv", text: "a\nb" }])
        .samples,
    ).toEqual([]);
  });
});
