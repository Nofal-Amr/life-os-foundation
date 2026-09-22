import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { accentFromWallpaper } from "@/lib/accent";

/**
 * How the app looks, beyond light and dark: text size and accent colour.
 * Both are per device (like the theme) and apply instantly, offline.
 */

export const TEXT_SIZES = [
  { value: "small", label: "Small", scale: 0.9375 },
  { value: "default", label: "Default", scale: 1 },
  { value: "large", label: "Large", scale: 1.125 },
  { value: "larger", label: "Larger", scale: 1.25 },
] as const;
export type TextSize = (typeof TEXT_SIZES)[number]["value"];

/** Fixed accents, as oklch for light and dark. "default" keeps the theme's own. */
export const ACCENTS = [
  { value: "default", label: "Life OS", light: null, dark: null },
  { value: "blue", label: "Blue", light: "oklch(0.55 0.16 250)", dark: "oklch(0.74 0.13 250)" },
  { value: "violet", label: "Violet", light: "oklch(0.55 0.18 295)", dark: "oklch(0.75 0.14 295)" },
  { value: "green", label: "Green", light: "oklch(0.52 0.14 150)", dark: "oklch(0.76 0.13 150)" },
  { value: "amber", label: "Amber", light: "oklch(0.6 0.14 70)", dark: "oklch(0.8 0.13 75)" },
  { value: "rose", label: "Rose", light: "oklch(0.56 0.18 10)", dark: "oklch(0.75 0.15 10)" },
  /** From the picture itself: the most colourful of its colours. */
  { value: "wallpaper", label: "From wallpaper", light: null, dark: null },
  /** Android's own Material You palette (Settings, Wallpaper & style). */
  { value: "system", label: "System palette", light: null, dark: null },
] as const;
export type Accent = (typeof ACCENTS)[number]["value"];

const SIZE_KEY = "life-os-text-size";
const ACCENT_KEY = "life-os-accent";
const PHONE_KEY = "life-os-phone-colors";

/** Applied before React hydrates, so text size and a fixed accent never flash. */
export const appearanceBootScript = `(function(){try{var d=document.documentElement;var s=localStorage.getItem("${SIZE_KEY}");var m={small:0.9375,"default":1,large:1.125,larger:1.25};if(s&&m[s])d.style.fontSize=(m[s]*100)+"%";var a=localStorage.getItem("${ACCENT_KEY}");if(a&&a!=="wallpaper"&&a!=="system")d.dataset.accent=a}catch(e){}})()`;

type PhoneColors = { wallpaper: string; system: string };

type AppearanceValue = {
  textSize: TextSize;
  setTextSize: (size: TextSize) => void;
  accent: Accent;
  setAccent: (accent: Accent) => void;
  /** The colour each phone-based choice resolves to now, for the swatches. */
  phoneAccents: { wallpaper: string | null; system: string | null };
  /** Running in the Android app, where phone colours exist at all. */
  onPhone: boolean;
};

const AppearanceContext = createContext<AppearanceValue | null>(null);

const read = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string | null) => {
  try {
    if (value == null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Storage unavailable; the choice still applies for this session.
  }
};

/** Colours from the Android app: the wallpaper's, and the system palette's. */
function nativeColors(): PhoneColors | null {
  const bridge = (window as { LifeOSNative?: { systemAccent?: () => string } }).LifeOSNative;
  try {
    const raw = bridge?.systemAccent?.();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PhoneColors>;
    return { wallpaper: parsed.wallpaper ?? "", system: parsed.system ?? "" };
  } catch {
    return null;
  }
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [textSize, setSize] = useState<TextSize>("default");
  const [accent, setAccentState] = useState<Accent>("default");
  const [phone, setPhone] = useState<PhoneColors | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const storedSize = read(SIZE_KEY);
    if (TEXT_SIZES.some((size) => size.value === storedSize)) setSize(storedSize as TextSize);
    const storedAccent = read(ACCENT_KEY);
    if (ACCENTS.some((item) => item.value === storedAccent)) setAccentState(storedAccent as Accent);

    const fromPhone = nativeColors();
    if (fromPhone) {
      setPhone(fromPhone);
      write(PHONE_KEY, JSON.stringify(fromPhone));
    } else {
      const remembered = read(PHONE_KEY);
      if (remembered) {
        try {
          setPhone(JSON.parse(remembered) as PhoneColors);
        } catch {
          // Ignore a corrupt copy.
        }
      }
    }
  }, []);

  // Follow the theme, so a phone colour stays readable in both.
  useEffect(() => {
    const root = document.documentElement;
    const update = () => setTheme(root.dataset["theme"] === "dark" ? "dark" : "light");
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme", "class"] });
    return () => observer.disconnect();
  }, []);

  const phoneAccents = useMemo(
    () => ({
      wallpaper: phone?.wallpaper ? accentFromWallpaper(phone.wallpaper, theme) : null,
      system: phone?.system ? accentFromWallpaper(phone.system, theme) : null,
    }),
    [phone, theme],
  );

  useEffect(() => {
    const root = document.documentElement;
    const scale = TEXT_SIZES.find((size) => size.value === textSize)?.scale ?? 1;
    root.style.fontSize = scale === 1 ? "" : `${scale * 100}%`;
  }, [textSize]);

  useEffect(() => {
    const root = document.documentElement;
    const names = ["--primary", "--ring", "--sidebar-primary", "--sidebar-ring"];
    for (const name of names) root.style.removeProperty(name);

    const fromPhone =
      accent === "wallpaper" ? phoneAccents.wallpaper : accent === "system" ? phoneAccents.system : null;
    if (fromPhone) {
      for (const name of names) root.style.setProperty(name, fromPhone);
      delete root.dataset["accent"];
      return;
    }
    if (accent === "default" || accent === "wallpaper" || accent === "system") {
      delete root.dataset["accent"];
    } else {
      root.dataset["accent"] = accent;
    }
  }, [accent, phoneAccents]);

  const value = useMemo<AppearanceValue>(
    () => ({
      textSize,
      accent,
      phoneAccents,
      onPhone: phone != null,
      setTextSize: (next) => {
        setSize(next);
        write(SIZE_KEY, next === "default" ? null : next);
      },
      setAccent: (next) => {
        setAccentState(next);
        write(ACCENT_KEY, next === "default" ? null : next);
      },
    }),
    [textSize, accent, phoneAccents, phone],
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): AppearanceValue {
  const value = useContext(AppearanceContext);
  if (!value) throw new Error("useAppearance must be used inside AppearanceProvider");
  return value;
}
