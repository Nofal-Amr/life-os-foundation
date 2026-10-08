/**
 * Ready-made plans: a project with its tasks spread over the days from
 * today. Starting one only creates ordinary tasks — change, move or delete
 * any of them afterwards.
 */
import { addDays, format } from "date-fns";

import { createProject } from "./projects";
import { createTask } from "./tasks";

export type PlanStep = { day: number; title: string };
export type Plan = {
  id: string;
  name: string;
  summary: string;
  days: number;
  icon: string;
  steps: PlanStep[];
};

/** A step every `every` days from `from` to `to`, numbered. */
function repeat(title: (n: number) => string, from: number, to: number, every: number): PlanStep[] {
  const out: PlanStep[] = [];
  for (let day = from, n = 1; day <= to; day += every, n++) out.push({ day, title: title(n) });
  return out;
}

export const PLANS: Plan[] = [
  {
    id: "fit-30",
    name: "Get moving in 30 days",
    summary: "Walks that grow, three short workouts a week, and a check at the end.",
    days: 30,
    icon: "dumbbell",
    steps: [
      { day: 0, title: "Note how you feel and your weight today" },
      ...repeat((n) => `Walk ${10 + Math.min(n, 10) * 2} minutes`, 0, 29, 2),
      ...repeat((n) => `Short workout #${n} (15 min)`, 1, 29, 3),
      { day: 29, title: "Look back: what got easier?" },
    ],
  },
  {
    id: "language-60",
    name: "Language basics in 60 days",
    summary: "15 minutes a day, a weekly review, and a short conversation at the end.",
    days: 60,
    icon: "globe",
    steps: [
      { day: 0, title: "Pick the app or book, and the 15-minute slot" },
      ...repeat((n) => `15 minutes practice (session ${n})`, 0, 59, 1).filter(
        (_, i) => i % 7 !== 6,
      ),
      ...repeat((n) => `Weekly review #${n}: words and phrases`, 6, 59, 7),
      { day: 59, title: "Have a 5-minute conversation" },
    ],
  },
  {
    id: "declutter-7",
    name: "Declutter the home in 7 days",
    summary: "One area a day, with a bag to give away at the end.",
    days: 7,
    icon: "home",
    steps: [
      { day: 0, title: "Clear the entrance and shoes" },
      { day: 1, title: "Clear the kitchen counters" },
      { day: 2, title: "One wardrobe: give away what you didn't wear in a year" },
      { day: 3, title: "Bathroom cabinet: throw out expired things" },
      { day: 4, title: "Papers: file or bin" },
      { day: 5, title: "Desk and cables" },
      { day: 6, title: "Drop off the give-away bag" },
    ],
  },
  {
    id: "exam-14",
    name: "Exam prep in 14 days",
    summary: "Topics split over the days, practice papers, and a rest day before.",
    days: 14,
    icon: "graduation-cap",
    steps: [
      { day: 0, title: "List every topic and what's weakest" },
      ...repeat((n) => `Study topic block ${n} (2 × 45 min)`, 1, 9, 1),
      { day: 10, title: "Practice paper 1, timed" },
      { day: 11, title: "Go over mistakes from paper 1" },
      { day: 12, title: "Practice paper 2, timed" },
      { day: 13, title: "Light review only, sleep early" },
    ],
  },
  {
    id: "ramadan",
    name: "Get ready for Ramadan (2 weeks)",
    summary: "Shift sleep, ease into fasting, plan Quran and give early.",
    days: 14,
    icon: "moon",
    steps: [
      { day: 0, title: "Set a Quran plan (how many pages a day)" },
      { day: 1, title: "Make up any missed fasts" },
      { day: 3, title: "Fast a voluntary day (Monday or Thursday)" },
      { day: 5, title: "Move bedtime 30 minutes earlier" },
      { day: 7, title: "Plan suhoor and iftar shopping" },
      { day: 9, title: "Fast a voluntary day" },
      { day: 11, title: "Decide your sadaqah and give part now" },
      { day: 13, title: "Clean and prepare the prayer space" },
    ],
  },
  {
    id: "book-month",
    name: "Read a book in a month",
    summary: "Pick it, then a little every day with a weekly check.",
    days: 30,
    icon: "book-open",
    steps: [
      { day: 0, title: "Choose the book and where you'll read" },
      ...repeat((n) => `Read 20 pages (day ${n})`, 1, 28, 1).filter((_, i) => i % 7 !== 6),
      ...repeat((n) => `Week ${n}: write 3 lines on what stuck`, 7, 28, 7),
      { day: 29, title: "Finish and note the one idea to keep" },
    ],
  },
];

/** The dated tasks a plan creates, from a start date. */
export function planTasks(plan: Plan, start: Date): { title: string; due: string }[] {
  return [...plan.steps]
    .sort((a, b) => a.day - b.day)
    .map((step) => ({ title: step.title, due: format(addDays(start, step.day), "yyyy-MM-dd") }));
}

export async function startPlan(
  plan: Plan,
  start = new Date(),
): Promise<{ projectId: string; tasks: number }> {
  const tasks = planTasks(plan, start);
  const project = await createProject({
    name: plan.name,
    description: plan.summary,
    status: "active",
    priority: "medium",
    start_date: format(start, "yyyy-MM-dd"),
    due_date: tasks.at(-1)?.due ?? null,
    icon: plan.icon,
    color: null,
  });
  for (const task of tasks) {
    await createTask({
      title: task.title,
      description: null,
      status: "todo",
      priority: "medium",
      due_date: task.due,
      project_id: project.id,
      capability_id: null,
      goal_id: null,
    });
  }
  return { projectId: project.id, tasks: tasks.length };
}
