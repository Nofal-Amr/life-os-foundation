import { describe, expect, it } from "vitest";

import type { Transaction } from "./finance";
import { workdayCost } from "./workdayCost";

const tx = (date: string, amount: number, category: string | null, kind = "expense") =>
  ({ date, amount: -amount, category_id: category, kind }) as unknown as Transaction;

describe("workdayCost", () => {
  // Thursday 8 Oct 2026; Sunday–Thursday workdays.
  const today = new Date(2026, 9, 8, 12);
  const workdays = [0, 1, 2, 3, 4];

  it("adds up the chosen categories on workdays only", () => {
    const result = workdayCost({
      transactions: [
        tx("2026-10-08", 100, "fuel"),
        tx("2026-10-07", 50, "food"),
        tx("2026-10-09", 70, "fuel"), // tomorrow: outside the period
        tx("2026-10-03", 40, "fuel"), // Saturday: a day off
        tx("2026-10-06", 999, "rent"), // not a chosen category
        tx("2026-10-05", 30, null),
      ],
      categoryIds: ["fuel", "food"],
      workdays,
      days: 7,
      today,
    });
    expect(result.total).toBe(150);
    expect(result.offDays).toBe(40);
    expect(result.entries).toBe(2);
    expect(result.workdays).toBe(5);
    expect(result.perWorkday).toBe(30);
  });
});
