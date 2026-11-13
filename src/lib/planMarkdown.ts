/**
 * Life OS plan markdown: a goal, its projects and tasks, habits and notes,
 * written as plain markdown that any AI chat (or a person) can produce.
 * The format is documented in docs/plan-markdown.md.
 *
 * The parser is forgiving about layout (bullet styles, code fences, chatter
 * before the plan, "Project:" or not) and strict about meaning: it never
 * invents a date. A date it can't read exactly is left out with a warning,
 * and "Week 2" or "@d3" only turn into dates from a start date you choose.
 */
import { addDays, format, parseISO } from "date-fns";

export type PlanPriority = "low" | "medium" | "high" | "critical";

export type PlanTask = {
  title: string;
  done: boolean;
  /** An exact date written on the line (YYYY-MM-DD). */
  due: string | null;
  /** "@d3": the third day of the plan (1 = start date). */
  day: number | null;
  /** The "Week N" section the task is in. */
  week: number | null;
  priority: PlanPriority | null;
  areas: string[];
  estimateMinutes: number | null;
  description: string | null;
  steps: PlanTask[];
  line: number;
};

export type PlanProject = {
  name: string;
  description: string | null;
  due: string | null;
  priority: PlanPriority | null;
  areas: string[];
  tasks: PlanTask[];
  line: number;
};

export type PlanHabit = { name: string; frequency: "daily" | "weekly"; line: number };

export type PlanGoal = {
  name: string;
  description: string | null;
  deadline: string | null;
  areas: string[];
  line: number;
};

export type PlanWarning = { line: number; message: string };

export type ParsedPlan = {
  goal: PlanGoal | null;
  projects: PlanProject[];
  /** Tasks that aren't under a project; they belong to the goal directly. */
  tasks: PlanTask[];
  habits: PlanHabit[];
  notes: string | null;
  warnings: PlanWarning[];
};

const PRIORITY_WORDS: Record<string, PlanPriority> = {
  low: "low",
  medium: "medium",
  med: "medium",
  normal: "medium",
  high: "high",
  urgent: "critical",
  critical: "critical",
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar date in YYYY-MM-DD, or null. */
export function exactDate(value: string): string | null {
  if (!ISO.test(value)) return null;
  const parsed = parseISO(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return format(parsed, "yyyy-MM-dd") === value ? value : null;
}

type Tokens = {
  text: string;
  due: string | null;
  day: number | null;
  priority: PlanPriority | null;
  areas: string[];
  estimateMinutes: number | null;
};

/** Pulls @date, @dN, !priority, #area and ~estimate out of a line. */
function readTokens(raw: string, line: number, warnings: PlanWarning[]): Tokens {
  let due: string | null = null;
  let day: number | null = null;
  let priority: PlanPriority | null = null;
  let estimateMinutes: number | null = null;
  const areas: string[] = [];
  const words: string[] = [];

  for (const word of raw.split(/\s+/)) {
    if (!word) continue;
    const clean = word.replace(/[,;]+$/, "");
    if (/^@\S+/.test(clean)) {
      const value = clean.slice(1).replace(/[()]/g, "");
      const dayMatch = /^d(?:ay)?(\d{1,3})$/i.exec(value);
      if (dayMatch) {
        const n = Number(dayMatch[1]);
        if (n >= 1) day = n;
        else warnings.push({ line, message: `"${clean}": days start at @d1.` });
        continue;
      }
      const date = exactDate(value);
      if (date) due = date;
      else
        warnings.push({
          line,
          message: `"${clean}" isn't a date in YYYY-MM-DD form, so it was left without a date.`,
        });
      continue;
    }
    if (/^!\S+/.test(clean)) {
      const level = PRIORITY_WORDS[clean.slice(1).toLowerCase()];
      if (level) priority = level;
      else
        warnings.push({
          line,
          message: `"${clean}" isn't a priority (low, medium, high, critical).`,
        });
      continue;
    }
    if (/^#[\p{L}\p{N}_-]+$/u.test(clean)) {
      const area = clean.slice(1).toLowerCase();
      if (!areas.includes(area)) areas.push(area);
      continue;
    }
    const estimate = /^~(\d+(?:\.\d+)?)(m|min|h|hr|d)$/i.exec(clean);
    if (estimate) {
      const n = Number(estimate[1]);
      const unit = estimate[2]!.toLowerCase();
      estimateMinutes = Math.round(
        unit.startsWith("m") ? n : unit.startsWith("h") ? n * 60 : n * 480,
      );
      continue;
    }
    words.push(word);
  }
  return {
    text: words.join(" ").replace(/\s+/g, " ").trim(),
    due,
    day,
    priority,
    areas,
    estimateMinutes,
  };
}

function stripMarkup(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function appendText(existing: string | null, line: string): string {
  return existing ? `${existing}\n${line}` : line;
}

type Section = "plan" | "habits" | "notes";

const HABITS_HEADING = /^(habits?|routines?|daily habits)$/i;
const NOTES_HEADING = /^(notes?|resources|tips)$/i;
const WEEK_HEADING = /^week\s*(\d{1,2})\b[\s:—–-]*(.*)$/i;

/** Reads plan markdown. Never throws; problems come back as warnings. */
export function parsePlan(markdown: string): ParsedPlan {
  const plan: ParsedPlan = {
    goal: null,
    projects: [],
    tasks: [],
    habits: [],
    notes: null,
    warnings: [],
  };
  const warnings = plan.warnings;
  const lines = (markdown ?? "").replace(/\r\n?/g, "\n").split("\n");

  let section: Section = "plan";
  let project: PlanProject | null = null;
  let week: number | null = null;
  /** Last task at each indent level, for steps and descriptions. */
  let lastTask: PlanTask | null = null;
  let lastTaskIndent = 0;
  let lastTop: PlanTask | null = null;

  const taskList = () => (project ? project.tasks : plan.tasks);

  lines.forEach((rawLine, index) => {
    const line = index + 1;
    const text = rawLine.replace(/\t/g, "  ");
    const trimmed = text.trim();
    if (!trimmed && section === "notes" && plan.notes !== null) {
      plan.notes = appendText(plan.notes, "");
      return;
    }
    if (!trimmed || /^```/.test(trimmed) || /^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) return;

    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      const level = heading[1]!.length;
      const title = stripMarkup(heading[2]!.replace(/\s+#+\s*$/, ""));
      lastTask = null;
      lastTop = null;
      const goalMatch = /^goal\s*[:—–-]\s*(.*)$/i.exec(title);
      const projectMatch = /^project\s*[:—–-]\s*(.*)$/i.exec(title);
      const weekMatch = WEEK_HEADING.exec(title);

      const special = HABITS_HEADING.test(title) || NOTES_HEADING.test(title);
      if (goalMatch || (level === 1 && !plan.goal && !weekMatch && !projectMatch && !special)) {
        const tokens = readTokens(goalMatch ? goalMatch[1]! : title, line, warnings);
        if (plan.goal) {
          warnings.push({ line, message: "A plan has one goal; this one was read as a project." });
        } else {
          plan.goal = {
            name: tokens.text || "Untitled goal",
            description: null,
            deadline: tokens.due,
            areas: tokens.areas,
            line,
          };
          section = "plan";
          project = null;
          week = null;
          return;
        }
      }
      if (HABITS_HEADING.test(title)) {
        section = "habits";
        project = null;
        week = null;
        return;
      }
      if (NOTES_HEADING.test(title)) {
        section = "notes";
        return;
      }
      section = "plan";
      if (weekMatch) {
        week = Number(weekMatch[1]);
        if (week < 1) {
          warnings.push({ line, message: "Weeks start at Week 1." });
          week = null;
        }
        return;
      }
      // Any other heading is a project.
      const tokens = readTokens(
        projectMatch ? projectMatch[1]! : goalMatch ? goalMatch[1]! : title,
        line,
        warnings,
      );
      if (!tokens.text) {
        warnings.push({ line, message: "A project heading without a name was skipped." });
        return;
      }
      project = {
        name: tokens.text,
        description: null,
        due: tokens.due,
        priority: tokens.priority,
        areas: tokens.areas,
        tasks: [],
        line,
      };
      plan.projects.push(project);
      week = null;
      return;
    }

    if (section === "notes") {
      plan.notes = appendText(plan.notes, rawLine.trimEnd());
      return;
    }

    const bullet = /^(\s*)(?:[-*+•]|\d+[.)])\s+(?:\[( |x|X)\]\s*)?(.*)$/.exec(text);

    if (section === "habits") {
      if (!bullet) return;
      const body = stripMarkup(bullet[3]!);
      const weekly = /\b(weekly|every week|per week|a week|times a week|\/\s*week)\b/i.test(body);
      const name = body
        .replace(/\(?\b(daily|every day|each day|weekly|every week|per week)\b\)?/gi, "")
        .replace(/[\s,;:—–-]+$/, "")
        .replace(/\s+/g, " ")
        .trim();
      if (name) plan.habits.push({ name, frequency: weekly ? "weekly" : "daily", line });
      return;
    }

    // Goal lines like "Deadline: 2026-12-11" or "Area: #career".
    const field = /^(deadline|due|target date|area|areas)\s*:\s*(.*)$/i.exec(trimmed);
    if (field && plan.goal && !project && !lastTask) {
      const key = field[1]!.toLowerCase();
      if (key.startsWith("area")) {
        for (const area of field[2]!.split(/[\s,]+/)) {
          const name = area.replace(/^#/, "").toLowerCase();
          if (name && !plan.goal.areas.includes(name)) plan.goal.areas.push(name);
        }
      } else {
        const value = field[2]!.trim().replace(/^@/, "");
        const date = exactDate(value);
        if (date) plan.goal.deadline = date;
        else
          warnings.push({
            line,
            message: `"${value}" isn't a date in YYYY-MM-DD form, so the goal has no deadline.`,
          });
      }
      return;
    }

    if (bullet) {
      const indent = bullet[1]!.length;
      const tokens = readTokens(stripMarkup(bullet[3]!), line, warnings);
      if (!tokens.text) {
        warnings.push({ line, message: "An empty task was skipped." });
        return;
      }
      const task: PlanTask = {
        title: tokens.text,
        done: (bullet[2] ?? "").toLowerCase() === "x",
        due: tokens.due,
        day: tokens.day,
        week,
        priority: tokens.priority,
        areas: tokens.areas,
        estimateMinutes: tokens.estimateMinutes,
        description: null,
        steps: [],
        line,
      };
      if (indent >= 2 && lastTop) {
        lastTop.steps.push(task);
      } else {
        taskList().push(task);
        lastTop = task;
      }
      lastTask = task;
      lastTaskIndent = indent;
      return;
    }

    // Plain text: a description of whatever it follows.
    const paragraph = stripMarkup(trimmed.replace(/^>\s?/, ""));
    if (!paragraph) return;
    const indent = text.length - text.trimStart().length;
    if (lastTask && indent > lastTaskIndent) {
      lastTask.description = appendText(lastTask.description, paragraph);
    } else if (lastTop && indent > 0) {
      lastTop.description = appendText(lastTop.description, paragraph);
    } else if (project && !project.tasks.length) {
      project.description = appendText(project.description, paragraph);
    } else if (plan.goal && !project && !plan.tasks.length) {
      plan.goal.description = appendText(plan.goal.description, paragraph);
    } else if (!plan.goal && !plan.projects.length && !plan.tasks.length) {
      // Chatter before the plan ("Here is your plan:"): ignored.
    } else {
      warnings.push({
        line,
        message: `This line wasn't part of a task or heading: "${paragraph}"`,
      });
    }
  });

  if (plan.notes !== null) plan.notes = plan.notes.trim() || null;
  if (!plan.goal && !plan.projects.length && !plan.tasks.length && !plan.habits.length) {
    warnings.push({
      line: 0,
      message:
        "No goal, project, task or habit was found. Start with '# Goal: …' and '- [ ] task' lines.",
    });
  }
  return plan;
}

/* ----------------------------------------------------------- Dates */

/** Every task in the plan, steps included. */
export function allTasks(plan: ParsedPlan): PlanTask[] {
  const out: PlanTask[] = [];
  const walk = (tasks: PlanTask[]) =>
    tasks.forEach((task) => {
      out.push(task);
      walk(task.steps);
    });
  walk(plan.tasks);
  plan.projects.forEach((project) => walk(project.tasks));
  return out;
}

/** True when some dates can only be worked out from a start date. */
export function needsStartDate(plan: ParsedPlan): boolean {
  return allTasks(plan).some((task) => !task.due && (task.day !== null || task.week !== null));
}

/**
 * The date a task is due: the date written on it; else "@dN" counted from
 * the start (day 1 = start); else the last day of its week (Week 1 ends on
 * day 7). Without a start date, only written dates count.
 */
export function taskDueDate(task: PlanTask, start: string | null): string | null {
  if (task.due) return task.due;
  const from = start ? exactDate(start) : null;
  if (!from) return null;
  const base = parseISO(from);
  if (task.day !== null) return format(addDays(base, task.day - 1), "yyyy-MM-dd");
  if (task.week !== null) return format(addDays(base, task.week * 7 - 1), "yyyy-MM-dd");
  return null;
}

/** The first day of a task's week (start date of its window), when known. */
export function taskStartDate(task: PlanTask, start: string | null): string | null {
  const from = start ? exactDate(start) : null;
  if (!from || task.week === null || task.day !== null || task.due) return null;
  return format(addDays(parseISO(from), (task.week - 1) * 7), "yyyy-MM-dd");
}

/** Counts for a short summary: "1 goal, 3 projects, 24 tasks, 2 habits". */
export function planCounts(plan: ParsedPlan) {
  return {
    goal: plan.goal ? 1 : 0,
    projects: plan.projects.length,
    tasks: allTasks(plan).length,
    habits: plan.habits.length,
    notes: plan.notes ? 1 : 0,
  };
}
