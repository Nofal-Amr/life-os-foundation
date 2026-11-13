import { format, parseISO, subDays } from "date-fns";

import type { Goal } from "./goals";
import type { Habit, HabitLog } from "./habits";
import type { Project } from "./projects";
import type { Task } from "./tasks";

/**
 * How tasks, projects and goals connect. Everything is derived from the links
 * tasks already carry (project_id, goal_id); nothing is estimated.
 */

export type Count = { done: number; total: number };

/** Top-level tasks only: steps belong to their task and aren't counted twice. */
const counted = (task: Task) => task.parent_task_id == null && task.status !== "cancelled";

function countOf(tasks: Task[]): Count {
  const list = tasks.filter(counted);
  return { done: list.filter((task) => task.status === "completed").length, total: list.length };
}

/** Tasks done out of the tasks in a project. */
export function projectProgress(tasks: Task[], projectId: string): Count {
  return countOf(tasks.filter((task) => task.project_id === projectId));
}

/** Goals a project moves forward: any goal one of its tasks is linked to. */
export function projectGoals(tasks: Task[], goals: Goal[], projectId: string): Goal[] {
  const ids = new Set(
    tasks
      .filter((task) => task.project_id === projectId && task.goal_id)
      .map((task) => task.goal_id as string),
  );
  return goals.filter((goal) => ids.has(goal.id));
}

export type GoalLinks = {
  /** All tasks linked to the goal, done out of total. */
  tasks: Count;
  /** Projects with at least one task linked to the goal, with that project's own progress. */
  projects: { project: Project; progress: Count }[];
  /** Open linked tasks, soonest due first, for "what moves this next". */
  next: Task[];
};

export function goalLinks(tasks: Task[], projects: Project[], goalId: string): GoalLinks {
  const linked = tasks.filter((task) => task.goal_id === goalId);
  const projectIds = new Set(linked.map((task) => task.project_id).filter(Boolean) as string[]);
  const next = linked
    .filter((task) => counted(task) && task.status !== "completed")
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
  return {
    tasks: countOf(linked),
    projects: projects
      .filter((project) => projectIds.has(project.id))
      .map((project) => ({ project, progress: projectProgress(tasks, project.id) })),
    next,
  };
}

/**
 * Habits can count toward a goal once the database has `habits.goal_id`
 * (migration 20261114090000_habit_goals.sql). Until then rows don't carry
 * the field, and linking stays hidden.
 */
export function habitGoalsAvailable(habits: Habit[]): boolean {
  return habits.some((habit) => "goal_id" in habit);
}

export type GoalHabit = {
  habit: Habit;
  /** Days with an entry in the seven days up to today, out of seven. */
  lastSeven: Count;
};

/** Active habits linked to a goal, with their own logs over the last week. */
export function goalHabits(
  habits: Habit[],
  logs: HabitLog[],
  goalId: string,
  today: string,
): GoalHabit[] {
  const from = format(subDays(parseISO(today), 6), "yyyy-MM-dd");
  return habits
    .filter((habit) => habit.active && habit.goal_id === goalId)
    .map((habit) => {
      const days = new Set(
        logs
          .filter(
            (log) => log.habit_id === habit.id && log.log_date >= from && log.log_date <= today,
          )
          .map((log) => log.log_date),
      );
      return { habit, lastSeven: { done: days.size, total: 7 } };
    });
}
