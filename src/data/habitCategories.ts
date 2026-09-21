/**
 * Which part of life a habit belongs to. A habit shows up in that area
 * (Health habits on the Health page, and so on). Until you choose one, the
 * category is guessed from the name; the guess is only ever a suggestion.
 */

export const HABIT_CATEGORIES = [
  { value: "health", label: "Health" },
  { value: "money", label: "Money" },
  { value: "work", label: "Work" },
  { value: "spirit", label: "Spirit" },
  { value: "home", label: "Home" },
  { value: "mind", label: "Mind" },
  { value: "people", label: "People" },
  { value: "other", label: "Other" },
] as const;

export type HabitCategory = (typeof HABIT_CATEGORIES)[number]["value"];

// Checked in this order, so "Water the plants" is Home before "water" is Health.
const KEYWORDS: [HabitCategory, string[]][] = [
  ["spirit", ["pray", "prayer", "salah", "salat", "quran", "qur'an", "adhkar", "azkar", "dhikr", "dua", "fast", "fasting", "sadaqa", "charity", "tahajjud", "sunnah"]],
  ["home", ["plant", "plants", "clean", "tidy", "dishes", "laundry", "cook", "cooking", "vacuum", "bed making", "make the bed", "declutter", "groceries"]],
  ["money", ["save", "saving", "savings", "budget", "spend", "spending", "invest", "expense", "expenses", "money", "no-spend", "bills"]],
  ["people", ["call", "family", "friend", "friends", "mom", "mum", "dad", "parents", "grandma", "grandpa", "visit", "kids", "wife", "husband"]],
  ["mind", ["read", "reading", "book", "books", "journal", "journaling", "meditate", "meditation", "learn", "learning", "study", "language", "duolingo", "gratitude", "write", "writing", "course"]],
  ["work", ["work", "code", "coding", "email", "emails", "inbox", "deep work", "focus", "plan the day", "plan my day", "portfolio", "project", "client", "clients"]],
  ["health", ["walk", "walking", "run", "running", "gym", "workout", "exercise", "stretch", "stretching", "yoga", "water", "drink", "sleep", "bed", "steps", "vitamin", "vitamins", "medicine", "meds", "swim", "cycle", "cycling", "bike", "diet", "fruit", "vegetables", "protein", "weight", "push-ups", "pushups", "sugar"]],
];

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A best guess from the habit's name; "other" when nothing matches. */
export function guessHabitCategory(name: string): HabitCategory {
  const text = name.toLowerCase();
  for (const [category, words] of KEYWORDS) {
    if (words.some((word) => new RegExp(`(^|[^a-z])${escape(word)}([^a-z]|$)`).test(text))) {
      return category;
    }
  }
  return "other";
}

const isCategory = (value: unknown): value is HabitCategory =>
  HABIT_CATEGORIES.some((item) => item.value === value);

/** The chosen category, or the guess while none is chosen. */
export function habitCategory(habit: { name: string; category?: string | null }): HabitCategory {
  return isCategory(habit.category) ? habit.category : guessHabitCategory(habit.name);
}

export const categoryLabel = (value: HabitCategory) =>
  HABIT_CATEGORIES.find((item) => item.value === value)?.label ?? "Other";
