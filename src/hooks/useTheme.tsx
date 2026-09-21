import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type Theme = "light" | "dark";
export type ThemePreference = Theme | "system";

type ThemeContextValue = {
  /** The theme actually on screen. */
  theme: Theme;
  /** What the user chose; "system" follows the device setting. */
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "life-os-theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Runs before React hydrates (inlined in the document head) so the page never
 * flashes the wrong theme. Keep in sync with the resolution logic below.
 */
export const themeBootScript = `(function(){try{var p=localStorage.getItem("${STORAGE_KEY}");var d=p==="dark"||((p!=="light")&&matchMedia("${DARK_QUERY}").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){}})()`;

function readPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>("system");
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    setPreference(readPreference());
    const media = window.matchMedia(DARK_QUERY);
    setSystemDark(media.matches);
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const theme: Theme = preference === "system" ? (systemDark ? "dark" : "light") : preference;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.dataset["theme"] = theme;
  }, [theme]);

  const value = useMemo<ThemeContextValue>(() => {
    const choose = (next: ThemePreference) => {
      setPreference(next);
      try {
        if (next === "system") window.localStorage.removeItem(STORAGE_KEY);
        else window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Storage unavailable; the choice still applies for this session.
      }
    };
    return {
      theme,
      preference,
      setPreference: choose,
      toggleTheme: () => choose(theme === "light" ? "dark" : "light"),
    };
  }, [theme, preference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider.");
  return context;
}
