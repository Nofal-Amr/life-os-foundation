import { describe, expect, it } from "vitest";

import type { Project } from "@/data/projects";
import {
  SPACES,
  projectSpace,
  spaceOfTask,
  spaceProjectIds,
  withProjectSpace,
} from "@/data/spaces";

const project = (over: Partial<Project>): Project =>
  ({ id: "p", name: "X", icon: null, description: null, ...over }) as Project;

describe("moving a project into a space", () => {
  const work = project({ id: "w", name: "Work", description: SPACES.work.description });
  const thesis = project({ id: "t", name: "Thesis" });
  const kaitech = project({ id: "k", name: "Kaitech" });
  const projects = [work, thesis, kaitech];
  const base = ["do", "money"];

  it("moves a project, and switches the space on", () => {
    const next = withProjectSpace(base, "k", "work");
    expect(next).toContain("work");
    expect(projectSpace(next, kaitech, projects)).toBe("work");
    expect(projectSpace(next, thesis, projects)).toBe("life");
  });

  it("brings the project's tasks and subtasks with it", () => {
    const next = withProjectSpace(base, "k", "work");
    expect(spaceOfTask({ project_id: "k" }, projects, next)).toBe("work");
    expect(spaceOfTask({ project_id: "t" }, projects, next)).toBe("life");
    expect(spaceOfTask({ project_id: null }, projects, next)).toBe("life");
  });

  it("moving again replaces the space, and Life takes it back out", () => {
    let next = withProjectSpace(base, "t", "work");
    next = withProjectSpace(next, "t", "study");
    expect(projectSpace(next, thesis, projects)).toBe("study");
    expect(next.filter((item) => item.endsWith(":t"))).toHaveLength(1);
    next = withProjectSpace(next, "t", "life");
    expect(projectSpace(next, thesis, projects)).toBe("life");
    expect(next).toContain("study");
  });

  it("lists the space's own project and the ones moved in", () => {
    const next = withProjectSpace(base, "k", "work");
    expect([...spaceProjectIds(projects, next, "work")]).toEqual(["w", "k"]);
    expect([...spaceProjectIds(projects, next, "study")]).toEqual([]);
  });

  it("the space's own project always counts as that space", () => {
    expect(projectSpace(base, work, projects)).toBe("work");
  });
});
