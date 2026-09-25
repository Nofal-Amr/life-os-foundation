import { describe, expect, it } from "vitest";

import { dayDots } from "./habits";

describe("dayDots", () => {
  it("covers the last days, oldest first, ending today", () => {
    const dots = dayDots([{ log_date: "2026-09-25" }, { log_date: "2026-09-20" }], "2026-09-25", 7);
    expect(dots.map((dot) => dot.date)).toEqual([
      "2026-09-19",
      "2026-09-20",
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
      "2026-09-24",
      "2026-09-25",
    ]);
    expect(dots.filter((dot) => dot.logged).map((dot) => dot.date)).toEqual([
      "2026-09-20",
      "2026-09-25",
    ]);
  });

  it("crosses month ends", () => {
    expect(dayDots([], "2026-10-01", 2).map((dot) => dot.date)).toEqual([
      "2026-09-30",
      "2026-10-01",
    ]);
  });
});
