/**
 * Work and Study as spaces of their own: their own tasks, notes, ideas and
 * calendar, built on the rows Life OS already has. No new tables.
 *
 * - Tasks live in one project per space (made the first time you add one).
 * - Notes carry the space's tag ("work" or "study"); ideas also carry "idea".
 * - The main calendar can show or hide each space; the choice is stored with
 *   the other area choices.
 */
import type { Note } from "@/data/notes";
import type { Project } from "@/data/projects";
import type { Task } from "@/data/tasks";

export type SpaceKey = "work" | "study";
export type CalendarSpace = SpaceKey | "life";

export const SPACES: Record<
  SpaceKey,
  { name: string; icon: string; color: string; description: string }
> = {
  work: {
    name: "Work",
    icon: "briefcase",
    color: "var(--entity-blue)",
    description: "Your Work space: tasks you add in Work.",
  },
  study: {
    name: "Study",
    icon: "graduation-cap",
    color: "var(--entity-violet)",
    description: "Your Study space: tasks you add in Study.",
  },
};

export type SpaceTab = "tasks" | "notes" | "ideas" | "calendar";

export const SPACE_TABS: { value: SpaceTab; label: string }[] = [
  { value: "tasks", label: "Tasks" },
  { value: "notes", label: "Notes" },
  { value: "ideas", label: "Ideas" },
  { value: "calendar", label: "Calendar" },
];

export const IDEA_TAG = "idea";

/** The project that holds a space's tasks, if it exists yet. */
export function spaceProject(projects: Project[], space: SpaceKey): Project | null {
  const meta = SPACES[space];
  return (
    projects.find((project) => project.description === meta.description) ??
    projects.find(
      (project) => project.icon === meta.icon && project.name.trim().toLowerCase() === space,
    ) ??
    null
  );
}

/** Which space a task belongs to: by its project, otherwise "life". */
export function spaceOfTask(task: Pick<Task, "project_id">, projects: Project[]): CalendarSpace {
  if (!task.project_id) return "life";
  for (const space of ["work", "study"] as const) {
    if (spaceProject(projects, space)?.id === task.project_id) return space;
  }
  return "life";
}

const hasTag = (note: Pick<Note, "tags">, tag: string) =>
  note.tags.some((item) => item.trim().toLowerCase() === tag);

/** A space's notes or ideas, newest first, archived ones left out. */
export function spaceNotes(notes: Note[], space: SpaceKey, kind: "notes" | "ideas"): Note[] {
  return notes.filter(
    (note) =>
      !note.archived &&
      hasTag(note, space) &&
      (kind === "ideas" ? hasTag(note, IDEA_TAG) : !hasTag(note, IDEA_TAG)),
  );
}

export function spaceTags(space: SpaceKey, kind: "notes" | "ideas"): string[] {
  return kind === "ideas" ? [space, IDEA_TAG] : [space];
}

/* The main calendar's choice, kept with the area choices (no new column). */
const HIDE_FLAG = (space: SpaceKey) => `calendar:hide-${space}`;

export function calendarShowsSpace(enabled: readonly string[], space: SpaceKey): boolean {
  return !enabled.includes(HIDE_FLAG(space));
}

export function withCalendarSpace(
  enabled: readonly string[],
  space: SpaceKey,
  show: boolean,
): string[] {
  const rest = enabled.filter((item) => item !== HIDE_FLAG(space));
  return show ? rest : [...rest, HIDE_FLAG(space)];
}
