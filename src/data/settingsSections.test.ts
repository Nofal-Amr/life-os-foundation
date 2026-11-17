import { describe, expect, it } from "vitest";

import { SETTINGS_SECTIONS, settingsSection, visibleSettingsSections } from "./settingsSections";

describe("settings sections", () => {
  it("reads only known sections from the address", () => {
    expect(settingsSection("prayer")).toBe("prayer");
    expect(settingsSection("nope")).toBeUndefined();
    expect(settingsSection(undefined)).toBeUndefined();
  });

  it("leaves out the parts for areas that are off", () => {
    const keys = visibleSettingsSections(["do"]).map((section) => section.key);
    expect(keys).not.toContain("prayer");
    expect(keys).not.toContain("money");
    expect(keys).not.toContain("body");
    expect(keys).toEqual(["profile", "areas", "phone", "work", "calendar", "look", "data"]);
  });

  it("shows every part when every area is on", () => {
    expect(visibleSettingsSections(["do", "money", "body", "spirit"])).toHaveLength(
      SETTINGS_SECTIONS.length,
    );
  });
});
