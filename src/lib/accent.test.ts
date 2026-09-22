import { describe, expect, it } from "vitest";

import { accentFromWallpaper, parseHex, toHsl } from "./accent";

describe("toHsl", () => {
  it("reads hue and saturation", () => {
    const blue = toHsl(parseHex("#1e6fd9")!);
    expect(Math.round(blue.h)).toBe(214);
    expect(blue.s).toBeGreaterThan(0.5);
    expect(toHsl(parseHex("#808080")!).s).toBe(0);
  });
});

describe("accentFromWallpaper", () => {
  it("picks the most colourful colour and keeps its hue", () => {
    // A muted beige first (what Android often reports), then the blue.
    const accent = accentFromWallpaper("#c9b2a1,#1e6fd9,#3a3f44", "dark");
    expect(accent).toMatch(/^hsl\(214 /);
    expect(accent).toContain("72%");
  });

  it("uses a darker lightness for the light theme", () => {
    expect(accentFromWallpaper("#1e6fd9", "light")).toContain("48%");
  });

  it("is null for a wallpaper with no real colour", () => {
    expect(accentFromWallpaper("#808080,#7a7a7a", "dark")).toBeNull();
    expect(accentFromWallpaper("", "dark")).toBeNull();
  });
});
