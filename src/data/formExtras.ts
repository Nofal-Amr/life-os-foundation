/**
 * How many of a form's folded ("More options") fields hold something other
 * than the default. Used to show "3 set" and to open the fold when editing.
 */

type TaskExtras = {
  description?: unknown;
  status?: unknown;
  priority?: unknown;
  start_date?: unknown;
  due_time?: unknown;
  energy?: unknown;
  repeat?: unknown;
  max_date?: unknown;
  estimated_minutes?: unknown;
  capability_id?: unknown;
  goal_id?: unknown;
};

const filled = (value: unknown) => value !== null && value !== undefined && value !== "";

export function taskExtrasSet(form: TaskExtras): number {
  return [
    filled(form.description),
    filled(form.status) && form.status !== "inbox" && form.status !== "todo",
    filled(form.priority) && form.priority !== "medium",
    filled(form.start_date),
    filled(form.due_time),
    filled(form.energy),
    filled(form.repeat),
    filled(form.max_date),
    filled(form.estimated_minutes),
    filled(form.capability_id),
    filled(form.goal_id),
  ].filter(Boolean).length;
}

type HabitExtras = {
  description?: unknown;
  icon?: unknown;
  color?: unknown;
  frequency?: unknown;
  target?: unknown;
  active?: unknown;
};

export function habitExtrasSet(form: HabitExtras): number {
  return [
    filled(form.description),
    filled(form.icon),
    filled(form.color),
    filled(form.frequency) && form.frequency !== "daily",
    filled(form.target) && form.target !== 1,
    form.active === false,
  ].filter(Boolean).length;
}

type ProjectExtras = {
  description?: unknown;
  icon?: unknown;
  color?: unknown;
  image_url?: unknown;
  status?: unknown;
  priority?: unknown;
  start_date?: unknown;
  due_date?: unknown;
};

export function projectExtrasSet(form: ProjectExtras): number {
  return [
    filled(form.description),
    filled(form.icon),
    filled(form.color),
    filled(form.image_url),
    filled(form.status) && form.status !== "planning",
    filled(form.priority) && form.priority !== "medium",
    filled(form.start_date),
    filled(form.due_date),
  ].filter(Boolean).length;
}
