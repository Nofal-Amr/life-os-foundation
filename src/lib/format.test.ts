import { describe, expect, it } from "vitest";

import { DEFAULT_DISPLAY_PREFERENCES, formatMoney, isValidCurrencyCode } from "./format";

describe("money formatting", () => {
  it("omits trailing zero decimals", () => {
    expect(formatMoney(1200, DEFAULT_DISPLAY_PREFERENCES)).toBe("1,200");
  });

  it("keeps two digits when a fraction exists", () => {
    expect(formatMoney(1200.5, DEFAULT_DISPLAY_PREFERENCES)).toBe("1,200.5");
  });

  it("accepts supported ISO 4217 codes beyond suggestions", () => {
    expect(isValidCurrencyCode("JPY")).toBe(true);
    expect(isValidCurrencyCode("nope")).toBe(false);
  });
});