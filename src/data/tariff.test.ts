import { describe, expect, it } from "vitest";

import {
  EGYPT_RESIDENTIAL_2026 as EG,
  billFor,
  tierFor,
  tierRangeLabel,
  untilNextTier,
} from "./tariff";

const round = (value: number) => Math.round(value * 100) / 100;

describe("Egypt residential tiers", () => {
  it("places consumption in tiers 1 to 7", () => {
    expect(
      [0, 50, 51, 100, 101, 200, 201, 350, 351, 650, 651, 1000, 1001].map((k) => tierFor(EG, k)),
    ).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7]);
  });

  it("bills tiers 1 and 2 progressively from zero", () => {
    // 50 × 0.68 + 30 × 0.78 + 2 EGP fee
    expect(round(billFor(EG, 80).total)).toBe(round(50 * 0.68 + 30 * 0.78 + 2));
  });

  it("starts tiers 3 to 5 at the tier 3 rate from zero", () => {
    // 200 × 0.95 + 100 × 1.55 + 11 fee
    const bill = billFor(EG, 300);
    expect(bill.tier).toBe(4);
    expect(round(bill.energy)).toBe(round(200 * 0.95 + 100 * 1.55));
    expect(bill.fee).toBe(11);
    // 200 × 0.95 + 150 × 1.55 + 100 × 1.95
    expect(round(billFor(EG, 450).energy)).toBe(round(200 * 0.95 + 150 * 1.55 + 100 * 1.95));
  });

  it("charges the whole bill at one rate in tiers 6 and 7", () => {
    expect(round(billFor(EG, 800).total)).toBe(round(800 * 2.1 + 25));
    expect(round(billFor(EG, 1200).total)).toBe(round(1200 * 2.58 + 40));
  });

  it("says how far the next tier is", () => {
    expect(untilNextTier(EG, 180)).toEqual({ next: 4, kwh: 20 });
    expect(untilNextTier(EG, 1500)).toBeNull();
    expect(tierRangeLabel(EG, 4)).toBe("201–350 kWh");
    expect(tierRangeLabel(EG, 7)).toBe("over 1000 kWh");
  });
});
