import { describe, expect, it } from "vitest";

import { accentFromWallpaper, colorsFromPixels, parseHex, toHsl } from "./accent";

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

describe("colorsFromPixels", () => {
  const pixels = (...colors: [number, number, number, number][]) => colors.flatMap((c) => c);

  it("finds the colourful part of a mostly grey picture", () => {
    const grey: [number, number, number, number] = [128, 128, 128, 255];
    const blue: [number, number, number, number] = [30, 111, 217, 255];
    const data = pixels(...Array(20).fill(grey), blue, blue);
    expect(colorsFromPixels(data)).toBe("#1e6fd9");
  });

  it("is empty for a picture with no colour", () => {
    expect(colorsFromPixels(pixels([0, 0, 0, 255], [255, 255, 255, 255], [90, 90, 90, 255]))).toBe(
      "",
    );
  });
});
