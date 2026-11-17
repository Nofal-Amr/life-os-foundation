import type { ModuleKey } from "@/data/modules";

export type SettingsSectionKey =
  | "profile"
  | "areas"
  | "prayer"
  | "money"
  | "body"
  | "phone"
  | "work"
  | "calendar"
  | "look"
  | "data";

/**
 * Settings as a short list: each row opens one part, so the page never shows
 * every card at once. A part tied to an area shows only while that area is on.
 */
export const SETTINGS_SECTIONS: {
  key: SettingsSectionKey;
  label: string;
  description: string;
  module?: ModuleKey;
}[] = [
  { key: "profile", label: "Profile", description: "Your name, picture, units and formats." },
  { key: "areas", label: "Areas", description: "Choose which parts of Life OS you see." },
  {
    key: "prayer",
    label: "Prayer",
    description: "Location, calculation method and reminders.",
    module: "spirit",
  },
  {
    key: "money",
    label: "Money",
    description: "Payday, currency and bank notifications.",
    module: "money",
  },
  { key: "body", label: "Body", description: "Height, weight and goals.", module: "body" },
  {
    key: "phone",
    label: "Phone and watch",
    description: "Life Connect, the watch and the on-phone assistant.",
  },
  { key: "work", label: "Work", description: "Your company and clocking in." },
  {
    key: "calendar",
    label: "Calendar",
    description: "Work and Study, holidays and Google Calendar.",
  },
  {
    key: "look",
    label: "Language and look",
    description: "Language, theme, colour and text size.",
  },
  {
    key: "data",
    label: "Your data",
    description: "Export, crash reports and deleting your account.",
  },
];

export function settingsSection(value: unknown): SettingsSectionKey | undefined {
  return SETTINGS_SECTIONS.find((section) => section.key === value)?.key;
}

/** The rows this person sees: parts for areas they switched off are left out. */
export function visibleSettingsSections(enabled: readonly string[]) {
  return SETTINGS_SECTIONS.filter((section) => !section.module || enabled.includes(section.module));
}
