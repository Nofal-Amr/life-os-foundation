import { describe, expect, it } from "vitest";

import type { Note } from "@/data/notes";
import type { Project } from "@/data/projects";
import {
  SPACES,
  calendarShowsSpace,
  spaceNotes,
  spaceOfTask,
  spaceProject,
  withCalendarSpace,
} from "@/data/spaces";

const project = (over: Partial<Project>): Project =>
  ({ id: "p", name: "X", icon: null, description: null, ...over }) as Project;
const note = (over: Partial<Note>): Note =>
  ({ id: "n", title: "", body: "", tags: [], archived: false, ...over }) as Note;

describe("spaces", () => {
  const work = project({ id: "w", name: "Work", description: SPACES.work.description });
  const study = project({ id: "s", name: "Study", icon: "graduation-cap" });
  const other = project({ id: "o", name: "Home" });

  it("finds a space's project by its description, or its name and icon", () => {
    expect(spaceProject([other, work], "work")?.id).toBe("w");
    expect(spaceProject([other, study], "study")?.id).toBe("s");
    expect(spaceProject([other], "work")).toBeNull();
  });

  it("puts a task in the space of its project", () => {
    const projects = [work, study, other];
    expect(spaceOfTask({ project_id: "w" }, projects)).toBe("work");
    expect(spaceOfTask({ project_id: "s" }, projects)).toBe("study");
    expect(spaceOfTask({ project_id: "o" }, projects)).toBe("life");
    expect(spaceOfTask({ project_id: null }, projects)).toBe("life");
  });

  it("splits a space's notes from its ideas", () => {
    const notes = [
      note({ id: "a", tags: ["Work"] }),
      note({ id: "b", tags: ["work", "idea"] }),
      note({ id: "c", tags: ["study"] }),
      note({ id: "d", tags: ["work"], archived: true }),
    ];
    expect(spaceNotes(notes, "work", "notes").map((n) => n.id)).toEqual(["a"]);
    expect(spaceNotes(notes, "work", "ideas").map((n) => n.id)).toEqual(["b"]);
    expect(spaceNotes(notes, "study", "notes").map((n) => n.id)).toEqual(["c"]);
  });

  it("stores the calendar choice without touching the areas", () => {
    const hidden = withCalendarSpace(["do", "notes"], "work", false);
    expect(hidden).toEqual(["do", "notes", "calendar:hide-work"]);
    expect(calendarShowsSpace(hidden, "work")).toBe(false);
    expect(calendarShowsSpace(hidden, "study")).toBe(true);
    expect(withCalendarSpace(hidden, "work", true)).toEqual(["do", "notes"]);
  });
});
