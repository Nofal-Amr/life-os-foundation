/**
 * Language: English (default) or Arabic, chosen per device in Settings.
 *
 * Translation is by phrase: the English text is the key, so anything not in
 * the dictionary simply stays English. The shared building blocks (buttons,
 * labels, dialog and card titles, page headers, menus, navigation) translate
 * their own text, which covers most of the app without touching every page.
 * Arabic also turns the page right-to-left.
 */
import { useSyncExternalStore } from "react";

import { AR } from "./i18n.ar";

export type Lang = "en" | "ar";

const KEY = "life-os-lang";
const listeners = new Set<() => void>();

function readLang(): Lang {
  try {
    return localStorage.getItem(KEY) === "ar" ? "ar" : "en";
  } catch {
    return "en";
  }
}

let current: Lang = typeof window === "undefined" ? "en" : readLang();

/** Applies the language to the page: lang and direction. */
export function applyLang(lang: Lang = current) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
}

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang) {
  current = lang;
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // This session only.
  }
  applyLang(lang);
  listeners.forEach((listener) => listener());
}

/** The phrase in the current language (English when there's no translation). */
export function t(text: string): string {
  if (current !== "ar" || !text) return text;
  const exact = AR[text];
  if (exact) return exact;
  const trimmed = text.trim();
  if (trimmed !== text && AR[trimmed]) return text.replace(trimmed, AR[trimmed]!);
  // "Save." / "Save…" → translate the words, keep the ending.
  const ending = /([.…:!?]+)$/.exec(trimmed)?.[1];
  if (ending) {
    const base = AR[trimmed.slice(0, -ending.length)];
    if (base) return base + ending.replace(/\?/g, "؟");
  }
  return text;
}

/** Re-renders when the language changes; returns the translate function. */
export function useT(): (text: string) => string {
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
    () => "en" as Lang,
  );
  return t;
}

/** Translates plain-text children (strings and arrays of strings); leaves elements alone. */
export function tChildren<T>(children: T): T {
  if (typeof children === "string") return t(children) as T;
  if (Array.isArray(children))
    return children.map((child) => (typeof child === "string" ? t(child) : child)) as T;
  return children;
}
