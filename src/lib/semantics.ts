import { GOAL_STATUSES, PRIORITIES, PROJECT_STATUSES, TASK_STATUSES, labelOf } from "@/data/enums";
import type { GoalStatus, Priority, ProjectStatus, TaskStatus } from "@/data/enums";

/**
 * One colour language for the whole app. Tones map to theme tokens so both
 * light and dark stay correct, and every use keeps its text label.
 */
export type Tone = "neutral" | "info" | "positive" | "warning" | "danger" | "quiet";

export function priorityTone(priority: Priority): Tone {
  switch (priority) {
    case "low":
      return "quiet";
    case "medium":
      return "neutral";
    case "high":
      return "warning";
    case "critical":
      return "danger";
    default:
      return "neutral";
  }
}

export function taskStatusTone(status: TaskStatus): Tone {
  switch (status) {
    case "inbox":
      return "quiet";
    case "todo":
      return "neutral";
    case "in_progress":
      return "info";
    case "waiting":
      return "warning";
    case "completed":
      return "positive";
    case "cancelled":
      return "quiet";
    default:
      return "neutral";
  }
}

export function projectStatusTone(status: ProjectStatus): Tone {
  switch (status) {
    case "planning":
      return "neutral";
    case "active":
      return "info";
    case "on_hold":
      return "warning";
    case "completed":
      return "positive";
    case "archived":
      return "quiet";
    default:
      return "neutral";
  }
}

export function goalStatusTone(status: GoalStatus): Tone {
  switch (status) {
    case "not_started":
      return "quiet";
    case "active":
      return "info";
    case "completed":
      return "positive";
    case "archived":
      return "quiet";
    default:
      return "neutral";
  }
}

/** Scales where a higher number is better (mood, food quality). */
export function positiveScaleTone(value: number): Tone {
  if (value <= 1) return "danger";
  if (value === 2) return "warning";
  if (value === 3) return "neutral";
  return "positive";
}

/** Scales where a higher number is heavier (stress). */
export function loadScaleTone(value: number): Tone {
  if (value >= 5) return "danger";
  if (value === 4) return "warning";
  if (value === 3) return "neutral";
  return "positive";
}

export function scaleTone(kind: "stress" | "mood" | "food", value: number): Tone {
  return kind === "stress" ? loadScaleTone(value) : positiveScaleTone(value);
}

export function priorityLabel(priority: Priority): string {
  return labelOf(PRIORITIES, priority);
}

export function taskStatusLabel(status: TaskStatus): string {
  return labelOf(TASK_STATUSES, status);
}

export function projectStatusLabel(status: ProjectStatus): string {
  return labelOf(PROJECT_STATUSES, status);
}

export function goalStatusLabel(status: GoalStatus): string {
  return labelOf(GOAL_STATUSES, status);
}
