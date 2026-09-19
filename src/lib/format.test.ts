import { describe, expect, it } from "vitest";

import { DEFAULT_DISPLAY_PREFERENCES, formatMoney, formatSignedMoney, isValidCurrencyCode } from "./format";

describe("money formatting", () => {
  it("omits decimals for whole numbers", () => {
    expect(formatMoney(1200, DEFAULT_DISPLAY_PREFERENCES)).toBe("1,200");
  });

  it("always shows two digits when a fraction exists", () => {
    expect(formatMoney(1200.5, DEFAULT_DISPLAY_PREFERENCES)).toBe("1,200.50");
    expect(formatMoney(1200.50, DEFAULT_DISPLAY_PREFERENCES)).toBe("1,200.50");
    expect(formatMoney(1200.55, DEFAULT_DISPLAY_PREFERENCES)).toBe("1,200.55");
  });

  it("uses the same precision for signed values", () => {
    expect(formatSignedMoney(-1200.5, DEFAULT_DISPLAY_PREFERENCES).amount).toBe("−1,200.50");
    expect(formatSignedMoney(1200, DEFAULT_DISPLAY_PREFERENCES).amount).toBe("+1,200");
  });

  it("accepts supported ISO 4217 codes beyond suggestions", () => {
    expect(isValidCurrencyCode("JPY")).toBe(true);
    expect(isValidCurrencyCode("nope")).toBe(false);
  });
});
