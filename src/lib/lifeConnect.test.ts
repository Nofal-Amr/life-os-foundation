import { describe, expect, it } from "vitest";

import { forwardsOneTimeCodes } from "./native";

describe("Life Connect one-time codes", () => {
  it("keeps codes on the SIM phone when you never chose", () => {
    expect(forwardsOneTimeCodes(null)).toBe(false);
  });

  it("keeps codes on the SIM phone when you switched them off", () => {
    expect(forwardsOneTimeCodes("0")).toBe(false);
  });

  it("forwards codes only when you switched them on", () => {
    expect(forwardsOneTimeCodes("1")).toBe(true);
  });

  it("treats anything unexpected as off", () => {
    expect(forwardsOneTimeCodes("true")).toBe(false);
    expect(forwardsOneTimeCodes("")).toBe(false);
  });
});
