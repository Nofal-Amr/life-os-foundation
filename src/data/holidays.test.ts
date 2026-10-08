import { describe, expect, it } from "vitest";

import { hijriOf, islamicDays, visibleHolidays } from "./holidays";

describe("Islamic occasions", () => {
  it("reads the Hijri date (Umm al-Qura)", () => {
    // 1 Ramadan 1447 is 18 February 2026 in Umm al-Qura.
    expect(hijriOf(new Date(2026, 1, 18, 12))).toEqual({ month: 9, day: 1 });
  });

  it("finds each occasion once in a year", () => {
    const names = islamicDays(2026).map((day) => day.name);
    expect(names).toContain("Eid al-Fitr");
    expect(names).toContain("Eid al-Adha");
    expect(names.filter((name) => name === "Eid al-Fitr")).toHaveLength(1);
    expect(islamicDays(2026).find((day) => day.name === "Eid al-Fitr")?.date).toBe("2026-03-20");
  });

  it("leaves out hidden days", () => {
    const list = [
      { date: "2026-03-20", name: "Eid al-Fitr", localName: null, kind: "islamic" as const },
      { date: "2026-01-07", name: "Christmas", localName: null, kind: "public" as const },
    ];
    expect(
      visibleHolidays(list, { country: "EG", islamic: true, hidden: ["2026-01-07|Christmas"] }).map(
        (h) => h.name,
      ),
    ).toEqual(["Eid al-Fitr"]);
  });
});
