import { describe, expect, it } from "vitest";

import { hijriOf, islamicDays, visibleHolidays, withOfficialIslamicDays } from "./holidays";

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

describe("official Islamic days off", () => {
  // What the public-holiday source gives for Egypt in 2026: no Eid al-Fitr, no Arafah.
  const source = [
    {
      date: "2026-01-07",
      name: "Christmas Day (Orthodox)",
      localName: null,
      kind: "public" as const,
    },
    { date: "2026-05-27", name: "Eid Al-Adha", localName: null, kind: "public" as const },
    { date: "2026-06-18", name: "Islamic New Year", localName: null, kind: "public" as const },
    {
      date: "2026-08-26",
      name: "Prophet Muhammad's Birthday",
      localName: null,
      kind: "public" as const,
    },
  ];

  it("adds Egypt's missing Eid al-Fitr (three days) and the Day of Arafah", () => {
    const list = withOfficialIslamicDays(source, 2026, "EG");
    const added = list.filter((item) => item.kind === "islamic");
    expect(added.map((item) => [item.date, item.name])).toEqual([
      ["2026-03-20", "Eid al-Fitr (day 1)"],
      ["2026-03-21", "Eid al-Fitr (day 2)"],
      ["2026-03-22", "Eid al-Fitr (day 3)"],
      ["2026-05-26", "Day of Arafah"],
    ]);
  });

  it("keeps the source's own dates for holidays it already lists", () => {
    const list = withOfficialIslamicDays(source, 2026, "EG");
    expect(list.filter((item) => /adha|new year|birthday/i.test(item.name))).toHaveLength(3);
    expect(list.map((item) => item.date)).toEqual([...list.map((item) => item.date)].sort());
  });

  it("leaves other countries as the source gives them", () => {
    expect(withOfficialIslamicDays(source, 2026, "DE")).toBe(source);
  });
});
