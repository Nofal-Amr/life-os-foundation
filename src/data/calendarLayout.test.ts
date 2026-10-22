import { describe, expect, it } from "vitest";

import { layoutTimed, weekDays } from "./calendarLayout";

const at = (time: string) => new Date(`2026-10-22T${time}:00`);

describe("layoutTimed", () => {
  it("places an event by its start and length", () => {
    const [block] = layoutTimed([{ id: "a", start: at("09:00"), end: at("10:30") }], at("00:00"));
    expect(block).toMatchObject({ id: "a", top: 9 * 60, height: 90, column: 0, columns: 1 });
  });

  it("puts overlapping events side by side", () => {
    const blocks = layoutTimed(
      [
        { id: "a", start: at("09:00"), end: at("10:00") },
        { id: "b", start: at("09:30"), end: at("11:00") },
        { id: "c", start: at("12:00"), end: at("13:00") },
      ],
      at("00:00"),
    );
    const byId = Object.fromEntries(blocks.map((block) => [block.id, block]));
    expect([byId["a"]!.column, byId["a"]!.columns]).toEqual([0, 2]);
    expect([byId["b"]!.column, byId["b"]!.columns]).toEqual([1, 2]);
    expect([byId["c"]!.column, byId["c"]!.columns]).toEqual([0, 1]);
  });

  it("gives events with no end a short block, and clips to the day", () => {
    const blocks = layoutTimed(
      [
        { id: "a", start: at("08:00"), end: null },
        { id: "b", start: at("23:30"), end: new Date("2026-10-23T02:00:00") },
      ],
      at("00:00"),
    );
    expect(blocks[0]).toMatchObject({ top: 480, height: 30 });
    expect(blocks[1]).toMatchObject({ top: 1410, height: 30 });
  });
});

describe("weekDays", () => {
  it("starts the week on the chosen day", () => {
    // 22 Oct 2026 is a Thursday.
    expect(weekDays(new Date("2026-10-22T12:00:00"), 6).map((day) => day.getDate())).toEqual([
      17, 18, 19, 20, 21, 22, 23,
    ]);
    expect(weekDays(new Date("2026-10-22T12:00:00"), 1)[0]!.getDate()).toBe(19);
  });
});
