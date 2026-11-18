/**
 * A class schedule from text: the answer an AI chat gives when you show it a
 * screenshot of your timetable (with SCHEDULE_PROMPT), or the text the phone
 * reads from the screenshot itself. Life OS sends nothing to an AI; you paste
 * the answer, check the preview, and import.
 *
 * The prompt asks for one line per class or exam:
 *   CLASS | Monday | 09:00 | 10:30 | Calculus I | Room 204
 *   EXAM | 2026-12-14 | 10:00 | Calculus I | Midterm
 * Looser lines also work: "Mon 9:00-10:30 Calculus I (Room 204)".
 */
import type { ImportedExam, ImportedSlot } from "@/data/study";

export const SCHEDULE_PROMPT = `I'm attaching a screenshot of my class schedule. Turn it into plain lines, one per weekly class and one per exam, exactly in this format and nothing else:

CLASS | <weekday in English> | <start, 24-hour HH:MM> | <end, 24-hour HH:MM> | <course name> | <room, or leave empty>
EXAM | <date YYYY-MM-DD> | <start, 24-hour HH:MM> | <course name> | <exam name, like Midterm or Final>

Rules:
- One line per class per weekday (a class on Sunday and Tuesday is two lines).
- Use the course's full name as it appears, the same spelling every time.
- Skip breaks, lunch and anything that isn't a class or an exam.
- If something is unreadable, skip it rather than guess.`;

export type ScheduleResult = {
  slots: ImportedSlot[];
  exams: ImportedExam[];
  /** Lines that looked like data but couldn't be read, to show the person. */
  skipped: string[];
};

const WEEKDAYS: [RegExp, number][] = [
  [/^(sun(day)?|su|الأحد|الاحد|أحد|احد)$/i, 0],
  [/^(mon(day)?|mo|الإثنين|الاثنين|إثنين|اثنين)$/i, 1],
  [/^(tue(s(day)?)?|tu|الثلاثاء|ثلاثاء)$/i, 2],
  [/^(wed(nesday)?|we|الأربعاء|الاربعاء|أربعاء|اربعاء)$/i, 3],
  [/^(thu(r(s(day)?)?)?|th|الخميس|خميس)$/i, 4],
  [/^(fri(day)?|fr|الجمعة|جمعة)$/i, 5],
  [/^(sat(urday)?|sa|السبت|سبت)$/i, 6],
];

export function weekdayOf(word: string): number | null {
  const clean = word.trim().replace(/[.,:]$/, "");
  for (const [pattern, day] of WEEKDAYS) if (pattern.test(clean)) return day;
  return null;
}

/** "9:00", "09:00", "9:00 AM", "1:30pm", "13.30" → "HH:mm"; null if not a time. */
export function clockOf(text: string): string | null {
  const m = /^(\d{1,2})[:.](\d{2})\s*(am|pm|a\.m\.|p\.m\.|ص|م)?$/i.exec(text.trim());
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2]);
  const half = m[3]?.toLowerCase().replace(/\./g, "");
  if (half === "pm" || half === "م") hour = (hour % 12) + 12;
  else if (half === "am" || half === "ص") hour = hour % 12;
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

const TIME = String.raw`\d{1,2}[:.]\d{2}\s*(?:am|pm|a\.m\.|p\.m\.|ص|م)?`;

/** A local date and time as an ISO string. */
function localIso(date: string, time: string): string | null {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const value = new Date(y!, mo! - 1, d!, h, mi);
  if (Number.isNaN(value.getTime()) || value.getMonth() !== mo! - 1) return null;
  return value.toISOString();
}

function clean(text: string | undefined): string {
  return (text ?? "").replace(/^[\s\-–•*]+|[\s\-–•*]+$/g, "").trim();
}

function fromPipes(cells: string[], result: ScheduleResult, line: string): boolean {
  const kind = cells[0]!.toUpperCase();
  if (kind === "CLASS") {
    const weekday = weekdayOf(cells[1] ?? "");
    const starts = clockOf(cells[2] ?? "");
    const ends = clockOf(cells[3] ?? "");
    const course = clean(cells[4]);
    if (weekday === null || !starts || !ends || !course || ends <= starts) {
      result.skipped.push(line);
      return true;
    }
    result.slots.push({ course, weekday, starts, ends, room: clean(cells[5]) || null });
    return true;
  }
  if (kind === "EXAM") {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(cells[1]?.trim() ?? "") ? cells[1]!.trim() : null;
    const time = clockOf(cells[2] ?? "") ?? "09:00";
    const course = clean(cells[3]);
    const name = clean(cells[4]);
    const dueAt = date ? localIso(date, time) : null;
    if (!dueAt || !course) {
      result.skipped.push(line);
      return true;
    }
    result.exams.push({ course, title: name ? `${course} · ${name}` : course, dueAt });
    return true;
  }
  return false;
}

/** "Mon 9:00-10:30 Calculus I (Room 204)" and the like. */
function fromLoose(line: string, result: ScheduleResult, day: number | null): number | null {
  const words = line.split(/\s+/);
  const lead = weekdayOf(words[0] ?? "");
  const weekday = lead ?? day;
  const rest = lead !== null ? words.slice(1).join(" ") : line;
  const range = new RegExp(`(${TIME})\\s*(?:-|–|—|to|إلى|الى)\\s*(${TIME})`, "i").exec(rest);
  if (!range) {
    // A bare weekday heading ("Monday") sets the day for the lines under it.
    return lead !== null && !rest.trim() ? lead : day;
  }
  const starts = clockOf(range[1]!);
  const ends = clockOf(range[2]!);
  let title = clean(rest.replace(range[0], " ").replace(/\s+/g, " "));
  let room: string | null = null;
  const roomMatch = /\(([^)]+)\)\s*$|\b((?:room|hall|lab|قاعة|معمل)\s*[\w-]+)\s*$/i.exec(title);
  if (roomMatch) {
    room = clean(roomMatch[1] ?? roomMatch[2]);
    title = clean(title.slice(0, roomMatch.index));
  }
  if (weekday === null || !starts || !ends || ends <= starts || !title) {
    result.skipped.push(line);
    return weekday;
  }
  result.slots.push({ course: title, weekday, starts, ends, room });
  return weekday;
}

export function parseSchedule(text: string): ScheduleResult {
  const result: ScheduleResult = { slots: [], exams: [], skipped: [] };
  let day: number | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/`/g, "").trim();
    if (!line || /^```/.test(line)) continue;
    const cells = line.split("|").map((cell) => cell.trim());
    if (cells.length >= 4 && fromPipes(cells, result, line)) continue;
    day = fromLoose(line, result, day);
  }
  // The same class twice (an AI repeating itself) counts once.
  const seen = new Set<string>();
  result.slots = result.slots.filter((slot) => {
    const key = `${slot.course.toLowerCase()}|${slot.weekday}|${slot.starts}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return result;
}
