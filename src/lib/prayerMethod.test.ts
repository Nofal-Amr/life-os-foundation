import { describe, expect, it } from "vitest";

import { localMethod, methodSuggestion } from "./prayerMethod";

describe("localMethod", () => {
  it("reads the country from the saved place name", () => {
    expect(localMethod("Alexandria, Egypt", null, null)).toBe("Egyptian");
    expect(localMethod("Riyadh, Saudi Arabia", null, null)).toBe("UmmAlQura");
    expect(localMethod("Dubai, United Arab Emirates", null, null)).toBe("Dubai");
    expect(localMethod("Lahore, Pakistan", null, null)).toBe("Karachi");
    expect(localMethod("Istanbul, Türkiye", null, null)).toBe("Turkey");
  });

  it("knows Egypt from its coordinates when the name has no country", () => {
    expect(localMethod("Cairo", 30.0444, 31.2357)).toBe("Egyptian");
    expect(localMethod("Aswan", 24.09, 32.9)).toBe("Egyptian");
  });

  it("stays quiet when it can't tell", () => {
    expect(localMethod("Berlin, Germany", 52.52, 13.4)).toBeNull();
    expect(localMethod(null, null, null)).toBeNull();
  });
});

describe("methodSuggestion", () => {
  it("suggests the local method when another one is saved", () => {
    expect(methodSuggestion("MuslimWorldLeague", "Cairo, Egypt", 30.04, 31.23)).toBe("Egyptian");
    expect(methodSuggestion(null, "Cairo, Egypt", 30.04, 31.23)).toBe("Egyptian");
  });

  it("says nothing when the local method is already in use", () => {
    expect(methodSuggestion("Egyptian", "Cairo, Egypt", 30.04, 31.23)).toBeNull();
  });
});
