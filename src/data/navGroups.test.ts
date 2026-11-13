import { describe, expect, it } from "vitest";

import { TOOL_GROUPS, visibleToolGroups } from "./navGroups";

const ALL = ["do", "calendar", "notes", "study", "relationships"];
const labels = (groups: ReturnType<typeof visibleToolGroups>) =>
  Object.fromEntries(groups.map((group) => [group.label, group.tools.map((tool) => tool.label)]));

describe("TOOL_GROUPS", () => {
  it("is Plan, Library and Shared, in that order", () => {
    expect(TOOL_GROUPS.map((group) => group.label)).toEqual(["Plan", "Library", "Shared"]);
  });

  it("lists every tool once", () => {
    const paths = TOOL_GROUPS.flatMap((group) => group.tools.map((tool) => tool.to));
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("keeps every page the old flat list had, plus Week, Time and Import a plan", () => {
    const paths = TOOL_GROUPS.flatMap((group) => group.tools.map((tool) => tool.to));
    for (const path of [
      "/calendar",
      "/notes",
      "/study",
      "/reminders",
      "/messages",
      "/work",
      "/insights",
      "/together",
      "/relationships",
      "/quests",
      "/review",
      "/week",
      "/time",
      "/import-plan",
    ]) {
      expect(paths).toContain(path);
    }
  });
});

describe("visibleToolGroups", () => {
  it("shows the groups in the Serious skin, without Quests or Work", () => {
    expect(labels(visibleToolGroups({ enabled: ALL, skin: "serious", inCompany: false }))).toEqual({
      Plan: ["Calendar", "Week", "Reminders", "Daily review", "Time", "Insights"],
      Library: ["Notes", "Study", "Import a plan"],
      Shared: ["Relationships", "Together", "Messages"],
    });
  });

  it("adds Quests in the RPG skin and Work once in a company", () => {
    const groups = labels(visibleToolGroups({ enabled: ALL, skin: "rpg", inCompany: true }));
    expect(groups["Plan"]).toContain("Quests");
    expect(groups["Shared"]).toContain("Work");
  });

  it("hides areas the user switched off, and a group left empty", () => {
    const groups = labels(visibleToolGroups({ enabled: [], skin: "serious", inCompany: false }));
    expect(groups["Library"]).toBeUndefined();
    expect(groups["Plan"]).not.toContain("Calendar");
    expect(groups["Shared"]).toEqual(["Together", "Messages"]);
  });
});
