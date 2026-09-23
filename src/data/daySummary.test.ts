import { describe, expect, it } from "vitest";

import { dayLines, listNames, type DayInputs } from "./daySummary";

const empty: DayInputs = {
  date: "2026-09-23",
  tasks: [],
  transactions: [],
  categories: [],
  foodLogs: [],
  medications: [],
  medicationLogs: [],
  resources: [],
  readings: [],
  sleepMinutes: null,
  prayersLogged: 0,
  habitsTicked: 0,
  minutesTracked: 0,
};

const fmt = {
  money: (value: number) => `${value} EGP`,
  duration: (minutes: number) => `${minutes}m`,
};

describe("listNames", () => {
  it("drops repeats and shortens a long list", () => {
    expect(listNames(["Fuel", "Fuel", "Lunch"])).toBe("Fuel, Lunch");
    expect(listNames(["A", "B", "C", "D", "E"])).toBe("A, B, C and 2 more");
  });
});

describe("dayLines", () => {
  it("is empty when nothing was logged", () => {
    expect(dayLines(empty, fmt)).toEqual([]);
  });

  it("names what the money went on", () => {
    const lines = dayLines(
      {
        ...empty,
        categories: [{ id: "c1", name: "Groceries" }],
        transactions: [
          {
            kind: "expense",
            date: "2026-09-23",
            amount: 100,
            description: "Fuel 92",
            category_id: null,
          },
          {
            kind: "expense",
            date: "2026-09-23",
            amount: "50",
            description: null,
            category_id: "c1",
          },
          {
            kind: "expense",
            date: "2026-09-22",
            amount: 999,
            description: "Yesterday",
            category_id: null,
          },
          { kind: "income", date: "2026-09-23", amount: 300, description: null, category_id: null },
        ],
      },
      fmt,
    );
    expect(lines.find((line) => line.key === "spent")).toEqual({
      key: "spent",
      text: "150 EGP spent",
      detail: "Fuel 92, Groceries",
    });
    expect(lines.find((line) => line.key === "income")?.text).toBe("300 EGP received");
  });

  it("includes medication taken and meter readings", () => {
    const lines = dayLines(
      {
        ...empty,
        medications: [{ id: "m1", name: "Vitamin D" }],
        medicationLogs: [
          { log_date: "2026-09-23", medication_id: "m1", taken: true },
          { log_date: "2026-09-23", medication_id: "m1", taken: false },
        ],
        resources: [{ id: "r1", name: "Electricity", unit: "kWh" }],
        readings: [{ resource_id: "r1", reading: 1520, reading_at: "2026-09-23T10:00:00" }],
      },
      fmt,
    );
    expect(lines.find((line) => line.key === "medication")).toMatchObject({
      text: "1 dose taken",
      detail: "Vitamin D",
    });
    expect(lines.find((line) => line.key === "readings")?.detail).toBe("Electricity 1520 kWh");
  });

  it("adds up stored calories without multiplying again", () => {
    const lines = dayLines(
      {
        ...empty,
        foodLogs: [
          { log_date: "2026-09-23", calories: 260 },
          { log_date: "2026-09-23", calories: 130 },
        ],
      },
      fmt,
    );
    expect(lines.find((line) => line.key === "food")?.text).toBe("390 kcal logged");
  });
});
