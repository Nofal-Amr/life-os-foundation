/**
 * One line, understood: "120 lunch" is spending, "+500 bonus" is income,
 * "call mom tomorrow" is a task due tomorrow. Plain rules, no guessing
 * beyond what's typed — the preview always shows what it will save.
 */
import { addDays, format, nextDay, type Day } from "date-fns";

export type Capture =
  | { kind: "spending"; amount: number; note: string }
  | { kind: "income"; amount: number; note: string }
  | { kind: "task"; title: string; due: string | null };

const NUMBER = String.raw`(\d+(?:[.,]\d{1,2})?)`;
const DAYS: Record<string, Day> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

/** Arabic-Indic digits to plain ones, so "١٢٠ غدا" works too. */
function plainDigits(text: string): string {
  return text
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

const amount = (value: string) => Number(value.replace(",", "."));

export function parseCapture(input: string, today = new Date()): Capture | null {
  const text = plainDigits(input).trim().replace(/\s+/g, " ");
  if (!text) return null;

  // "+500 bonus" / "bonus +500": money in.
  const income =
    new RegExp(`^\\+\\s?${NUMBER}(?:\\s+(.+))?$`).exec(text) ??
    new RegExp(`^(.+?)\\s+\\+\\s?${NUMBER}$`).exec(text);
  if (income) {
    const first = income[1]!;
    const isLeading = /^\+/.test(text);
    const value = amount(isLeading ? first : income[2]!);
    const note = (isLeading ? income[2] : first) ?? "";
    if (value > 0) return { kind: "income", amount: value, note: note.trim() };
  }

  // "120 lunch" / "lunch 120": money out — a number with words, nothing else.
  const leading = new RegExp(`^${NUMBER}(?:\\s+(.+))?$`).exec(text);
  const trailing = new RegExp(`^(.+?)\\s+${NUMBER}$`).exec(text);
  if (leading && !/^\d+\s*(am|pm|h|min|mins|minutes|hours?)\b/i.test(text)) {
    const value = amount(leading[1]!);
    if (value > 0) return { kind: "spending", amount: value, note: (leading[2] ?? "").trim() };
  }
  if (trailing && !/\b(at|by|in|on)$/i.test(trailing[1]!)) {
    const value = amount(trailing[2]!);
    if (value > 0) return { kind: "spending", amount: value, note: trailing[1]!.trim() };
  }

  // Anything else is a task; a day word at the end sets the due date.
  let title = text;
  let due: string | null = null;
  const when =
    /\s+(today|tonight|tomorrow|tmrw|بكرة|بكره|غدا|النهارده|اليوم|(?:on |next )?(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat))$/i.exec(
      text,
    );
  if (when) {
    const word = when[1]!.toLowerCase().replace(/^(on|next) /, "");
    if (["today", "tonight", "اليوم", "النهارده"].includes(word)) due = format(today, "yyyy-MM-dd");
    else if (["tomorrow", "tmrw", "بكرة", "بكره", "غدا"].includes(word))
      due = format(addDays(today, 1), "yyyy-MM-dd");
    else if (word in DAYS) due = format(nextDay(today, DAYS[word]!), "yyyy-MM-dd");
    if (due) title = text.slice(0, when.index).trim();
  }
  if (!title) return null;
  return { kind: "task", title, due };
}
