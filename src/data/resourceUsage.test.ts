import { describe, expect, it } from "vitest";

import { usageBuckets } from "./resourceUsage";

const today = new Date("2026-09-25T15:00:00");

describe("usageBuckets", () => {
  it("spreads a meter's rise evenly over the days between readings", () => {
    const buckets = usageBuckets(
      "meter",
      [
        { reading: 100, reading_at: "2026-09-21T00:00:00" },
        { reading: 140, reading_at: "2026-09-25T00:00:00" },
      ],
      "day",
      today,
      6,
    );
    expect(buckets.map((b) => [b.key, b.value])).toEqual([
      ["2026-09-20", null],
      ["2026-09-21", 10],
      ["2026-09-22", 10],
      ["2026-09-23", 10],
      ["2026-09-24", 10],
      ["2026-09-25", null],
    ]);
  });

  it("counts a balance's drops and skips top-ups", () => {
    const buckets = usageBuckets(
      "quota",
      [
        { reading: 50, reading_at: "2026-09-22T00:00:00" },
        { reading: 40, reading_at: "2026-09-23T00:00:00" },
        { reading: 90, reading_at: "2026-09-24T00:00:00" },
        { reading: 85, reading_at: "2026-09-25T00:00:00" },
      ],
      "day",
      today,
      4,
    );
    expect(buckets.map((b) => b.value)).toEqual([10, 0, 5, null]);
  });

  it("adds up whole months", () => {
    const buckets = usageBuckets(
      "meter",
      [
        { reading: 0, reading_at: "2026-08-01T00:00:00" },
        { reading: 31, reading_at: "2026-09-01T00:00:00" },
        { reading: 61, reading_at: "2026-10-01T00:00:00" },
      ],
      "month",
      today,
      3,
    );
    expect(buckets.map((b) => [b.key, b.value])).toEqual([
      ["2026-07", null],
      ["2026-08", 31],
      ["2026-09", 30],
    ]);
  });
});
