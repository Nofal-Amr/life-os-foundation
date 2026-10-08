import { describe, expect, it } from "vitest";

import { numbersIn, receiptFrom } from "./ocr";

describe("numbersIn", () => {
  it("puts the longest number first, as a meter reading usually is", () => {
    expect(numbersIn("kWh 012345.6\n21 08")).toEqual([12345.6, 21, 8]);
    expect(numbersIn("ODO 84,512 km  TRIP 312.4")).toEqual([84512, 312.4]);
  });
});

describe("receiptFrom", () => {
  it("takes the Total line, not subtotal or VAT", () => {
    const text = [
      "CARREFOUR MAADI",
      "Tax invoice",
      "Milk 2L      65.00",
      "Bread        12.50",
      "Subtotal     77.50",
      "VAT 14%      10.85",
      "TOTAL EGP    88.35",
      "Cash        100.00",
      "Change       11.65",
    ].join("\n");
    expect(receiptFrom(text)).toEqual({ total: 88.35, merchant: "CARREFOUR MAADI" });
  });

  it("reads Arabic totals and falls back to the largest amount", () => {
    expect(receiptFrom("مطعم الشبراوي\nفول 25\nطعمية 15\nالإجمالي 40").total).toBe(40);
    expect(receiptFrom("Kiosk\n12.00\n30.00\n7.50").total).toBe(30);
  });
});
