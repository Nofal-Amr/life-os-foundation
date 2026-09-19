/**
 * Per-user module choices. Nothing here stores data — it only decides which
 * parts of the app are shown. Turning a module off never deletes rows.
 */
export const MODULE_KEYS = [
  "do",
  "money",
  "body",
  "spirit",
  "resources",
  "food",
  "habits",
  "notes",
  "calendar",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

export const MODULES: { key: ModuleKey; label: string; description: string }[] = [
  { key: "do", label: "Do", description: "Tasks, projects and goals in one place." },
  { key: "money", label: "Money", description: "Accounts, spending and what is left before payday." },
  { key: "body", label: "Body", description: "Health log, weight and medication." },
  { key: "spirit", label: "Spirit", description: "The five daily prayers, logged in a tap." },
  { key: "resources", label: "Resources", description: "Electricity, water and internet usage." },
  { key: "food", label: "Food", description: "What you ate and the calories in it." },
  { key: "habits", label: "Habits", description: "Small things you want to keep doing." },
  { key: "notes", label: "Notes", description: "Quick thoughts you do not want to lose." },
  { key: "calendar", label: "Calendar", description: "Everything with a date, on one month view." },
];

export const ALL_MODULE_KEYS: string[] = [...MODULE_KEYS];

export function moduleLabel(key: string): string {
  return MODULES.find((module) => module.key === key)?.label ?? key;
}

/** Missing preferences mean "everything on" so the app never looks broken. */
export function enabledModules(enabled: string[] | null | undefined): string[] {
  return enabled && enabled.length ? enabled : ALL_MODULE_KEYS;
}

export function isModuleEnabled(enabled: string[] | null | undefined, key: ModuleKey): boolean {
  return enabledModules(enabled).includes(key);
}

/** Longest prefixes first so /finance/transactions matches before /finance. */
const ROUTE_MODULES: { prefix: string; module: ModuleKey }[] = [
  { prefix: "/tasks", module: "do" },
  { prefix: "/projects", module: "do" },
  { prefix: "/goals", module: "do" },
  { prefix: "/capabilities", module: "do" },
  { prefix: "/habits", module: "habits" },
  { prefix: "/finance", module: "money" },
  { prefix: "/resources", module: "resources" },
  { prefix: "/food", module: "food" },
  { prefix: "/health", module: "body" },
  { prefix: "/spirit", module: "spirit" },
  { prefix: "/notes", module: "notes" },
  { prefix: "/calendar", module: "calendar" },
];

export function moduleForPath(pathname: string): ModuleKey | null {
  return ROUTE_MODULES.find((entry) => pathname.startsWith(entry.prefix))?.module ?? null;
}
