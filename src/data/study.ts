/**
 * Student mode: courses, the weekly timetable, and assignments/exams.
 * Includes a reader for the .ics calendar file most university portals
 * export, turning repeating classes into timetable slots and one-off exams
 * into exam items.
 */
import { queryOptions } from "@tanstack/react-query";
import { differenceInCalendarDays, format, parseISO } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { currentUserId, unwrap } from "@/lib/supabase-helpers";

export type Course = Database["public"]["Tables"]["courses"]["Row"];
export type ClassSession = Database["public"]["Tables"]["class_sessions"]["Row"];
export type StudyItem = Database["public"]["Tables"]["study_items"]["Row"];
export type StudyKind = "assignment" | "exam" | "quiz" | "project" | "reading";

export const STUDY_KINDS: { value: StudyKind; label: string }[] = [
  { value: "assignment", label: "Assignment" },
  { value: "exam", label: "Exam" },
  { value: "quiz", label: "Quiz" },
  { value: "project", label: "Project" },
  { value: "reading", label: "Reading" },
];

export const studyKeys = {
  courses: ["courses"] as const,
  sessions: ["class_sessions"] as const,
  items: ["study_items"] as const,
};

export const coursesQuery = () =>
  queryOptions({
    queryKey: studyKeys.courses,
    queryFn: async () =>
      unwrap(await supabase.from("courses").select("*").order("name")) as Course[],
  });

export const classSessionsQuery = () =>
  queryOptions({
    queryKey: studyKeys.sessions,
    queryFn: async () =>
      unwrap(
        await supabase.from("class_sessions").select("*").order("weekday").order("starts"),
      ) as ClassSession[],
  });

export const studyItemsQuery = () =>
  queryOptions({
    queryKey: studyKeys.items,
    queryFn: async () =>
      unwrap(
        await supabase.from("study_items").select("*").order("due_at", { nullsFirst: false }),
      ) as StudyItem[],
  });

/* ------------------------------------------------------------- writes */

export async function addCourse(input: {
  name: string;
  code: string | null;
  teacher: string | null;
  color: string | null;
}): Promise<Course> {
  const user_id = await currentUserId();
  return unwrap(
    await supabase
      .from("courses")
      .insert({ ...input, user_id })
      .select()
      .single(),
  ) as Course;
}

export async function updateCourse(id: string, input: Partial<Course>): Promise<void> {
  unwrap(await supabase.from("courses").update(input).eq("id", id).select());
}

export async function deleteCourse(id: string): Promise<void> {
  unwrap(await supabase.from("courses").delete().eq("id", id).select());
}

export async function addSession(input: {
  course_id: string;
  weekday: number;
  starts: string;
  ends: string;
  room: string | null;
  kind: string | null;
}): Promise<void> {
  const user_id = await currentUserId();
  unwrap(
    await supabase
      .from("class_sessions")
      .insert({ ...input, user_id })
      .select(),
  );
}

export async function deleteSession(id: string): Promise<void> {
  unwrap(await supabase.from("class_sessions").delete().eq("id", id).select());
}

export type StudyItemInput = {
  course_id: string | null;
  kind: StudyKind;
  title: string;
  due_at: string | null;
  weight: number | null;
  note: string | null;
};

export async function addStudyItem(input: StudyItemInput): Promise<void> {
  const user_id = await currentUserId();
  unwrap(
    await supabase
      .from("study_items")
      .insert({ ...input, user_id })
      .select(),
  );
}

export async function updateStudyItem(
  id: string,
  input: Partial<StudyItemInput> & {
    done?: boolean;
    grade?: number | null;
    max_grade?: number | null;
  },
): Promise<void> {
  unwrap(await supabase.from("study_items").update(input).eq("id", id).select());
}

export async function deleteStudyItem(id: string): Promise<void> {
  unwrap(await supabase.from("study_items").delete().eq("id", id).select());
}

/* ------------------------------------------------------------ reading */

/** "09:00:00" → "09:00". */
export const hhmm = (time: string) => time.slice(0, 5);

/** Today's classes, in order. */
export function classesOn(sessions: ClassSession[], date: string): ClassSession[] {
  const weekday = parseISO(date).getDay();
  return sessions
    .filter((session) => session.weekday === weekday)
    .sort((a, b) => a.starts.localeCompare(b.starts));
}

/** "in 3 days", "tomorrow", "today", "2 days ago". */
export function dueLabel(dueAt: string, today = new Date()): string {
  const days = differenceInCalendarDays(new Date(dueAt), today);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}

/** Open items due from today on, soonest first; overdue ones first of all. */
export function upcomingItems(items: StudyItem[], today = new Date()): StudyItem[] {
  return items
    .filter((item) => !item.done && item.due_at)
    .sort((a, b) => a.due_at!.localeCompare(b.due_at!))
    .filter((item) => differenceInCalendarDays(new Date(item.due_at!), today) >= -14);
}

/** Average grade so far for a course, as a percentage, from graded items. */
export function courseAverage(
  items: StudyItem[],
  courseId: string,
): { percent: number; graded: number } | null {
  const graded = items.filter(
    (item) =>
      item.course_id === courseId &&
      item.grade != null &&
      item.max_grade != null &&
      item.max_grade > 0,
  );
  if (!graded.length) return null;
  const weighted = graded.every((item) => item.weight != null && item.weight > 0);
  let total = 0;
  let weights = 0;
  for (const item of graded) {
    const weight = weighted ? Number(item.weight) : 1;
    total += (Number(item.grade) / Number(item.max_grade)) * weight;
    weights += weight;
  }
  return { percent: Math.round((total / weights) * 1000) / 10, graded: graded.length };
}

/* ------------------------------------------------------- .ics import */

export type ImportedSlot = {
  course: string;
  weekday: number;
  starts: string;
  ends: string;
  room: string | null;
};
export type ImportedExam = { course: string; title: string; dueAt: string };

const DAY_CODES: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
const EXAM_WORDS = /\b(exam|midterm|mid-term|final|quiz|test)\b|امتحان|اختبار|ميدتيرم|كويز/i;

/** "20261004T100000Z" or "20261004T100000" (local) → Date. */
function icsDate(value: string): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h = "00", mi = "00", s = "00", z] = m;
  return z
    ? new Date(Date.UTC(+y!, +mo! - 1, +d!, +h, +mi, +s))
    : new Date(+y!, +mo! - 1, +d!, +h, +mi, +s);
}

function unescape(text: string): string {
  return text
    .replace(/\\n/gi, " ")
    .replace(/\\([,;\\])/g, "$1")
    .trim();
}

/**
 * Reads an .ics export. Repeating classes (an RRULE, or the same class at
 * the same weekday and time at least twice) become timetable slots; one-off
 * events that look like exams become exam items. Everything else is skipped.
 */
export function parseIcs(text: string): { slots: ImportedSlot[]; exams: ImportedExam[] } {
  // Unfold continued lines.
  const lines = text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  type Event = {
    summary: string;
    start: Date | null;
    end: Date | null;
    location: string | null;
    byDay: number[] | null;
  };
  const events: Event[] = [];
  let current: Event | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT")
      current = { summary: "", start: null, end: null, location: null, byDay: null };
    else if (line === "END:VEVENT") {
      if (current?.summary && current.start) events.push(current);
      current = null;
    } else if (current) {
      const colon = line.indexOf(":");
      if (colon < 0) continue;
      const name = line.slice(0, colon).split(";")[0]!.toUpperCase();
      const value = line.slice(colon + 1);
      if (name === "SUMMARY") current.summary = unescape(value);
      else if (name === "DTSTART") current.start = icsDate(value);
      else if (name === "DTEND") current.end = icsDate(value);
      else if (name === "LOCATION") current.location = unescape(value) || null;
      else if (name === "RRULE" && /FREQ=WEEKLY/i.test(value)) {
        const byDay = /BYDAY=([A-Z,0-9-]+)/i.exec(value)?.[1];
        current.byDay = byDay
          ? byDay
              .split(",")
              .map((code) => DAY_CODES[code.slice(-2).toUpperCase()]!)
              .filter((d) => d != null)
          : [];
      }
    }
  }

  const slots = new Map<string, ImportedSlot & { count: number; recurring: boolean }>();
  const exams: ImportedExam[] = [];
  for (const event of events) {
    const start = event.start!;
    const end = event.end ?? new Date(start.getTime() + 60 * 60_000);
    const starts = format(start, "HH:mm");
    const ends = format(end, "HH:mm");
    const days = event.byDay && event.byDay.length ? event.byDay : [start.getDay()];
    if (!event.byDay && EXAM_WORDS.test(event.summary)) {
      exams.push({ course: event.summary, title: event.summary, dueAt: start.toISOString() });
      continue;
    }
    for (const weekday of days) {
      const key = `${event.summary}|${weekday}|${starts}`;
      const slot = slots.get(key);
      if (slot) slot.count += 1;
      else
        slots.set(key, {
          course: event.summary,
          weekday,
          starts,
          ends: ends > starts ? ends : starts,
          room: event.location,
          count: 1,
          recurring: event.byDay != null,
        });
    }
  }
  return {
    slots: [...slots.values()]
      .filter((slot) => (slot.recurring || slot.count >= 2) && slot.ends > slot.starts)
      .map(({ count: _count, recurring: _recurring, ...slot }) => slot),
    exams: exams.filter((exam) => new Date(exam.dueAt).getTime() > Date.now() - 86_400_000),
  };
}
