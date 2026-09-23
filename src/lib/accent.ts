/**
 * Picking an accent from the phone wallpaper.
 *
 * Android hands back the wallpaper's primary, secondary and tertiary colours.
 * The primary is often a muted beige or grey (the average of the picture), so
 * we take the most colourful one and then set its lightness to something that
 * reads on the current theme, keeping its hue.
 */

export type Rgb = { r: number; g: number; b: number };

export function parseHex(hex: string): Rgb | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = Number.parseInt(match[1]!, 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

/** Hue 0-360, saturation 0-1, lightness 0-1. */
export function toHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const l = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return { h: 0, s: 0, l };
  const s = delta / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === red) h = 60 * (((green - blue) / delta) % 6);
  else if (max === green) h = 60 * ((blue - red) / delta + 2);
  else h = 60 * ((red - green) / delta + 4);
  return { h: (h + 360) % 360, s, l };
}

/**
 * The accent to use, as a CSS colour, or null when the wallpaper has no
 * colour at all (a grey or black picture). A muted picture keeps its hue and
 * is lifted to a saturation that reads as an accent.
 *
 * @param list "#rrggbb,#rrggbb,..." from the Android bridge
 * @param theme which theme it has to read on
 */
export function accentFromWallpaper(list: string, theme: "light" | "dark"): string | null {
  const colors = list
    .split(",")
    .map((hex) => parseHex(hex))
    .filter((color): color is Rgb => color != null)
    .map((color) => toHsl(color));
  if (!colors.length) return null;
  // The most colourful one; a near-grey wallpaper gives nothing usable.
  const best = colors.reduce((a, b) => (b.s > a.s ? b : a));
  if (best.s < 0.06) return null;
  const saturation = Math.min(0.9, Math.max(0.45, best.s));
  const lightness = theme === "dark" ? 0.72 : 0.48;
  return `hsl(${Math.round(best.h)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%)`;
}

/**
 * The main colours of a picture, most prominent first, as "#rrggbb,...".
 * Pixels are grouped by hue; each group is weighted by how colourful its
 * pixels are, so a small blue sky beats a large grey wall.
 *
 * @param data RGBA bytes, e.g. from a small canvas's getImageData
 */
export function colorsFromPixels(data: ArrayLike<number>, count = 3): string {
  const buckets = Array.from({ length: 24 }, () => ({ weight: 0, r: 0, g: 0, b: 0 }));
  for (let index = 0; index + 3 < data.length; index += 4) {
    if ((data[index + 3] ?? 0) < 128) continue;
    const rgb = { r: data[index] ?? 0, g: data[index + 1] ?? 0, b: data[index + 2] ?? 0 };
    const { h, s, l } = toHsl(rgb);
    if (s < 0.12 || l < 0.08 || l > 0.95) continue;
    const bucket = buckets[Math.floor(h / 15) % 24]!;
    bucket.weight += s;
    bucket.r += rgb.r * s;
    bucket.g += rgb.g * s;
    bucket.b += rgb.b * s;
  }
  const hex = (value: number) => Math.round(value).toString(16).padStart(2, "0");
  return buckets
    .filter((bucket) => bucket.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, count)
    .map(
      (bucket) =>
        `#${hex(bucket.r / bucket.weight)}${hex(bucket.g / bucket.weight)}${hex(bucket.b / bucket.weight)}`,
    )
    .join(",");
}
