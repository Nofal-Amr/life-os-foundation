import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "@/lib/dates";
import {
  BookOpen,
  CalendarClock,
  Camera,
  Copy,
  FileUp,
  GraduationCap,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { DatePicker } from "@/components/app/DatePicker";
import { SpaceTabContent, TabRow } from "@/components/app/spaces/SpaceTabs";
import { SPACE_TABS, type SpaceTab } from "@/data/spaces";
import { PageHeader } from "@/components/app/PageHeader";
import { ErrorState, LoadingState } from "@/components/app/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SCHEDULE_PROMPT, parseSchedule, type ScheduleResult } from "@/data/scheduleImport";
import { readPhoto } from "@/lib/ocr";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  STUDY_KINDS,
  addCourse,
  addSession,
  addStudyItem,
  classSessionsQuery,
  classesOn,
  courseAverage,
  coursesQuery,
  deleteCourse,
  deleteSession,
  deleteStudyItem,
  dueLabel,
  hhmm,
  parseIcs,
  studyItemsQuery,
  studyKeys,
  upcomingItems,
  updateStudyItem,
  type Course,
  type ImportedExam,
  type ImportedSlot,
  type StudyKind,
} from "@/data/study";
import { usePreferences } from "@/hooks/usePreferences";
import { todayISO } from "@/lib/date";
import { toError } from "@/lib/supabase-helpers";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/study")({
  head: () => ({ meta: [{ title: "Study · Life OS" }] }),
  component: StudyPage,
});

type StudyTab = "due" | "week" | "courses" | SpaceTab;
const STUDY_TABS: { value: StudyTab; label: string }[] = [
  { value: "due", label: "Due" },
  { value: "week", label: "Timetable" },
  { value: "courses", label: "Courses" },
  ...SPACE_TABS,
];

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function StudyPage() {
  const courses = useQuery(coursesQuery());
  const sessions = useQuery(classSessionsQuery());
  const items = useQuery(studyItemsQuery());
  const [tab, setTab] = useState<StudyTab>("due");

  if (courses.isLoading || sessions.isLoading || items.isLoading) {
    return (
      <>
        <PageHeader title="Study" description="Classes, assignments and exams." />
        <LoadingState rows={4} />
      </>
    );
  }
  const error = courses.error ?? sessions.error ?? items.error;
  if (error) {
    return (
      <>
        <PageHeader title="Study" description="Classes, assignments and exams." />
        <ErrorState error={error} onRetry={() => void courses.refetch()} />
      </>
    );
  }

  const list = courses.data ?? [];
  const today = classesOn(sessions.data ?? [], todayISO());

  return (
    <>
      <PageHeader title="Study" description="Classes, assignments and exams." />
      <div className="space-y-5">
        <section className="stat-card p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <CalendarClock className="size-4" /> {t("Today's classes")}
          </p>
          {today.length ? (
            <ul className="space-y-1.5 text-sm">
              {today.map((session) => (
                <li key={session.id} className="flex items-baseline gap-3">
                  <span className="w-24 tabular-nums text-muted-foreground">
                    {hhmm(session.starts)}–{hhmm(session.ends)}
                  </span>
                  <span className="font-medium">
                    {list.find((c) => c.id === session.course_id)?.name}
                  </span>
                  {session.room ? (
                    <span className="text-xs text-muted-foreground">{session.room}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t("No classes today.")}</p>
          )}
        </section>

        <TabRow tabs={STUDY_TABS} value={tab} onChange={setTab} label="Study" />

        {tab === "due" ? <DueTab courses={list} /> : null}
        {tab === "week" ? <TimetableTab courses={list} /> : null}
        {tab === "courses" ? <CoursesTab courses={list} /> : null}
        {tab === "tasks" || tab === "notes" || tab === "ideas" || tab === "calendar" ? (
          <SpaceTabContent space="study" tab={tab} />
        ) : null}
      </div>
    </>
  );
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    for (const key of Object.values(studyKeys))
      void queryClient.invalidateQueries({ queryKey: key });
  };
}

function CourseSelect({
  courses,
  value,
  onChange,
  allowNone = false,
}: {
  courses: Course[];
  value: string;
  onChange: (value: string) => void;
  allowNone?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-11">
        <SelectValue placeholder="Course" />
      </SelectTrigger>
      <SelectContent>
        {allowNone ? <SelectItem value="none">{t("No course")}</SelectItem> : null}
        {courses.map((course) => (
          <SelectItem key={course.id} value={course.id}>
            {course.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function DueTab({ courses }: { courses: Course[] }) {
  const items = useQuery(studyItemsQuery());
  const invalidate = useInvalidate();
  const { fmtDate } = usePreferences();
  const [kind, setKind] = useState<StudyKind>("assignment");
  const [title, setTitle] = useState("");
  const [course, setCourse] = useState("none");
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState("23:59");
  const [grading, setGrading] = useState<string | null>(null);
  const [grade, setGrade] = useState("");
  const [max, setMax] = useState("");
  const onError = (error: unknown) => toast.error(toError(error).message);

  const add = useMutation({
    mutationFn: () =>
      addStudyItem({
        kind,
        title: title.trim(),
        course_id: course === "none" ? null : course,
        due_at: new Date(`${date}T${time || "23:59"}:00`).toISOString(),
        weight: null,
        note: null,
      }),
    onSuccess: () => {
      setTitle("");
      invalidate();
    },
    onError,
  });
  const toggle = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) => updateStudyItem(id, { done }),
    onSuccess: invalidate,
    onError,
  });
  const saveGrade = useMutation({
    mutationFn: (id: string) =>
      updateStudyItem(id, {
        grade: grade === "" ? null : Number(grade),
        max_grade: max === "" ? null : Number(max),
        done: true,
      }),
    onSuccess: () => {
      setGrading(null);
      invalidate();
    },
    onError,
  });
  const remove = useMutation({ mutationFn: deleteStudyItem, onSuccess: invalidate, onError });

  const upcoming = upcomingItems(items.data ?? []);
  const done = (items.data ?? [])
    .filter((item) => item.done)
    .slice(-10)
    .reverse();
  const courseName = (id: string | null) => courses.find((c) => c.id === id)?.name;

  return (
    <div className="space-y-5">
      <form
        className="stat-card grid gap-3 p-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (title.trim()) add.mutate();
        }}
      >
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="study-title">{t("What's due")}</Label>
          <Input
            id="study-title"
            className="h-11"
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Problem set 4"
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t("Kind")}</Label>
          <Select value={kind} onValueChange={(value) => setKind(value as StudyKind)}>
            <SelectTrigger className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STUDY_KINDS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {t(option.label)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{t("Course")}</Label>
          <CourseSelect courses={courses} value={course} onChange={setCourse} allowNone />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="study-date">{t("Due")}</Label>
          <DatePicker id="study-date" value={date} onChange={(value) => value && setDate(value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="study-time">{t("Time")}</Label>
          <Input
            id="study-time"
            type="time"
            className="h-11"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
        <Button
          type="submit"
          className="h-11 sm:col-span-2"
          disabled={!title.trim() || add.isPending}
        >
          <Plus className="size-4" /> {t("Add")}
        </Button>
      </form>

      {upcoming.length ? (
        <ul className="space-y-2">
          {upcoming.map((item) => {
            const overdue = new Date(item.due_at!).getTime() < Date.now();
            return (
              <li key={item.id} className="stat-card flex items-center gap-3 p-3">
                <input
                  type="checkbox"
                  className="size-5 accent-[var(--primary)]"
                  aria-label={`Done: ${item.title}`}
                  checked={item.done}
                  onChange={(e) => toggle.mutate({ id: item.id, done: e.target.checked })}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {item.title}
                    <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-2xs uppercase tracking-wide text-muted-foreground">
                      {item.kind}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "block text-xs",
                      overdue ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {courseName(item.course_id) ? `${courseName(item.course_id)} · ` : ""}
                    Due {dueLabel(item.due_at!)} ({fmtDate(item.due_at!.slice(0, 10))},{" "}
                    {format(new Date(item.due_at!), "HH:mm")})
                  </span>
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Delete ${item.title}`}
                  onClick={() => remove.mutate(item.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t("Nothing due. Add assignments and exams above.")}
        </p>
      )}

      {done.length ? (
        <section className="space-y-2">
          <p className="text-sm font-semibold">{t("Done")}</p>
          <ul className="space-y-1.5">
            {done.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span className="text-muted-foreground">
                  {item.title}
                  {item.grade != null && item.max_grade ? ` · ${item.grade}/${item.max_grade}` : ""}
                </span>
                {grading === item.id ? (
                  <span className="flex items-center gap-1">
                    <Input
                      className="h-9 w-16"
                      inputMode="decimal"
                      placeholder="Got"
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                    />
                    <span>/</span>
                    <Input
                      className="h-9 w-16"
                      inputMode="decimal"
                      placeholder="Out of"
                      value={max}
                      onChange={(e) => setMax(e.target.value)}
                    />
                    <Button size="sm" onClick={() => saveGrade.mutate(item.id)}>
                      Save
                    </Button>
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setGrading(item.id);
                      setGrade(item.grade == null ? "" : String(item.grade));
                      setMax(item.max_grade == null ? "" : String(item.max_grade));
                    }}
                  >
                    {item.grade != null ? "Edit grade" : "Add grade"}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function TimetableTab({ courses }: { courses: Course[] }) {
  const sessions = useQuery(classSessionsQuery());
  const invalidate = useInvalidate();
  const { weekStartsOn } = usePreferences();
  const [course, setCourse] = useState(courses[0]?.id ?? "");
  const [day, setDay] = useState(String(new Date().getDay()));
  const [starts, setStarts] = useState("09:00");
  const [ends, setEnds] = useState("10:30");
  const [room, setRoom] = useState("");
  const onError = (error: unknown) => toast.error(toError(error).message);

  const add = useMutation({
    mutationFn: () =>
      addSession({
        course_id: course,
        weekday: Number(day),
        starts,
        ends,
        room: room.trim() || null,
        kind: null,
      }),
    onSuccess: () => {
      setRoom("");
      invalidate();
    },
    onError,
  });
  const remove = useMutation({ mutationFn: deleteSession, onSuccess: invalidate, onError });
  const order = Array.from({ length: 7 }, (_, i) => (weekStartsOn + i) % 7);

  return (
    <div className="space-y-5">
      <ScheduleFromAi courses={courses} />
      <IcsImport courses={courses} />
      {courses.length ? (
        <form
          className="stat-card grid gap-3 p-4 sm:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (course && ends > starts) add.mutate();
          }}
        >
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t("Course")}</Label>
            <CourseSelect courses={courses} value={course} onChange={setCourse} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("Day")}</Label>
            <Select value={day} onValueChange={setDay}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {order.map((index) => (
                  <SelectItem key={index} value={String(index)}>
                    {DAYS[index]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="class-start">{t("From")}</Label>
            <Input
              id="class-start"
              type="time"
              className="h-11"
              value={starts}
              onChange={(e) => setStarts(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="class-end">{t("To")}</Label>
            <Input
              id="class-end"
              type="time"
              className="h-11"
              value={ends}
              onChange={(e) => setEnds(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="class-room">{t("Room")}</Label>
            <Input
              id="class-room"
              className="h-11"
              maxLength={60}
              value={room}
              onChange={(e) => setRoom(e.target.value)}
            />
          </div>
          <Button
            type="submit"
            className="h-11 sm:col-span-3"
            disabled={!course || ends <= starts || add.isPending}
          >
            <Plus className="size-4" /> {t("Add class")}
          </Button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t("Add a course first (Courses tab), or import your timetable.")}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {order.map((weekday) => {
          const daySessions = (sessions.data ?? [])
            .filter((session) => session.weekday === weekday)
            .sort((a, b) => a.starts.localeCompare(b.starts));
          if (!daySessions.length) return null;
          return (
            <section key={weekday} className="stat-card space-y-2 p-3">
              <p className="text-sm font-semibold">{DAYS[weekday]}</p>
              <ul className="space-y-1.5">
                {daySessions.map((session) => (
                  <li key={session.id} className="flex items-center gap-2 text-sm">
                    <span className="w-24 shrink-0 tabular-nums text-muted-foreground">
                      {hhmm(session.starts)}–{hhmm(session.ends)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {courses.find((c) => c.id === session.course_id)?.name}
                      {session.room ? (
                        <span className="text-xs text-muted-foreground"> · {session.room}</span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      aria-label="Remove class"
                      className="text-muted-foreground"
                      onClick={() => remove.mutate(session.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

/** Adds classes and exams, making a course for each new course name. */
async function importSchedule(
  courses: Course[],
  result: { slots: ImportedSlot[]; exams: ImportedExam[] },
): Promise<void> {
  const byName = new Map(courses.map((course) => [course.name.toLowerCase(), course.id]));
  const courseFor = async (name: string) => {
    const key = name.toLowerCase();
    const existing = byName.get(key);
    if (existing) return existing;
    const created = await addCourse({
      name: name.slice(0, 100),
      code: null,
      teacher: null,
      color: null,
    });
    byName.set(key, created.id);
    return created.id;
  };
  for (const slot of result.slots) {
    await addSession({
      course_id: await courseFor(slot.course),
      weekday: slot.weekday,
      starts: slot.starts,
      ends: slot.ends,
      room: slot.room?.slice(0, 60) ?? null,
      kind: null,
    });
  }
  for (const exam of result.exams) {
    await addStudyItem({
      kind: "exam",
      title: exam.title.slice(0, 200),
      course_id: byName.get(exam.course.toLowerCase()) ?? null,
      due_at: exam.dueAt,
      weight: null,
      note: null,
    });
  }
}

/**
 * A schedule from a screenshot: copy a prompt into any AI chat with the
 * screenshot and paste its answer, or let the phone read the screenshot.
 * Nothing is sent anywhere by Life OS; you check the list before importing.
 */
function ScheduleFromAi({ courses }: { courses: Course[] }) {
  const invalidate = useInvalidate();
  const photo = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [reading, setReading] = useState(false);
  const [preview, setPreview] = useState<ScheduleResult | null>(null);

  const run = useMutation({
    mutationFn: (result: ScheduleResult) => importSchedule(courses, result),
    onSuccess: (_, result) => {
      toast.success(`${t("Added")} ${countLabel(result)}`);
      setPreview(null);
      setText("");
      setOpen(false);
      invalidate();
    },
    onError: (error) => toast.error(toError(error).message),
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(SCHEDULE_PROMPT);
      toast.success(t("Prompt copied. Paste it in your AI chat with the screenshot."));
    } catch {
      toast.error(t("Couldn't copy. Select the prompt and copy it yourself."));
    }
  };
  const check = (value = text) => {
    const result = parseSchedule(value);
    if (!result.slots.length && !result.exams.length)
      toast.error(t("No classes or exams found in that text."));
    setPreview(result);
  };
  const dropSlot = (index: number) =>
    preview && setPreview({ ...preview, slots: preview.slots.filter((_, i) => i !== index) });
  const dropExam = (index: number) =>
    preview && setPreview({ ...preview, exams: preview.exams.filter((_, i) => i !== index) });

  if (!open)
    return (
      <section className="rounded-xl border border-dashed border-border p-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4" /> {t("From a screenshot of your schedule")}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t(
            "Show your timetable to any AI chat with our prompt, then paste its answer here. You check the list before anything is added.",
          )}
        </p>
        <Button size="sm" variant="outline" className="mt-3" onClick={() => setOpen(true)}>
          {t("Make my schedule")}
        </Button>
      </section>
    );

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Sparkles className="size-4" /> {t("From a screenshot of your schedule")}
      </p>
      <ol className="list-decimal space-y-1 ps-5 text-sm text-muted-foreground">
        <li>{t("Copy the prompt.")}</li>
        <li>
          {t("In ChatGPT, Gemini, Claude or any AI chat, paste it and attach the screenshot.")}
        </li>
        <li>{t("Paste its answer below and check the list.")}</li>
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={copy}>
          <Copy className="size-4" /> {t("Copy the prompt")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={reading}
          onClick={() => photo.current?.click()}
        >
          {reading ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}{" "}
          {t("Or read it on this phone")}
        </Button>
      </div>
      <input
        ref={photo}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setReading(true);
          try {
            const read = await readPhoto(file, "text");
            setText(read.trim());
            check(read);
          } catch {
            toast.error(t("Couldn't read the photo on this device."));
          } finally {
            setReading(false);
          }
        }}
      />
      <Textarea
        value={text}
        rows={6}
        onChange={(event) => setText(event.target.value)}
        aria-label={t("The AI's answer")}
        placeholder={
          "CLASS | Sunday | 09:00 | 10:30 | Calculus I | Room 204\nEXAM | 2026-12-14 | 10:00 | Calculus I | Midterm"
        }
        dir="ltr"
        className="font-mono text-xs"
      />
      <p className="text-xs text-muted-foreground">
        {t(
          "Reading on the phone works best on a clear list; for a grid, the AI chat reads it better. Life OS doesn't send your screenshot anywhere.",
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!text.trim()}
          onClick={() => check()}
        >
          {t("Check the list")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setPreview(null);
          }}
        >
          {t("Cancel")}
        </Button>
      </div>

      {preview && (preview.slots.length || preview.exams.length) ? (
        <div className="space-y-3 border-t border-border pt-3">
          {preview.slots.length ? (
            <ul className="space-y-1.5" aria-label={t("Classes")}>
              {preview.slots.map((slot, index) => (
                <li
                  key={`${slot.course}-${slot.weekday}-${slot.starts}`}
                  className="flex items-center gap-2 rounded-lg bg-secondary/60 px-3 py-2 text-sm"
                >
                  <span className="w-20 shrink-0 text-muted-foreground">
                    {t(DAYS[slot.weekday]!)}
                  </span>
                  <span
                    dir="ltr"
                    className="shrink-0 tabular-nums"
                  >{`${slot.starts}–${slot.ends}`}</span>
                  <span className="min-w-0 flex-1 break-words">
                    {slot.course}
                    {slot.room ? (
                      <span className="text-muted-foreground"> · {slot.room}</span>
                    ) : null}
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    aria-label={`${t("Leave out")} ${slot.course}`}
                    onClick={() => dropSlot(index)}
                  >
                    <X className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
          {preview.exams.length ? (
            <ul className="space-y-1.5" aria-label={t("Exams")}>
              {preview.exams.map((exam, index) => (
                <li
                  key={`${exam.title}-${exam.dueAt}`}
                  className="flex items-center gap-2 rounded-lg bg-secondary/60 px-3 py-2 text-sm"
                >
                  <span className="shrink-0 text-muted-foreground">
                    {format(new Date(exam.dueAt), "d MMM, HH:mm")}
                  </span>
                  <span className="min-w-0 flex-1 break-words">{exam.title}</span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    aria-label={`${t("Leave out")} ${exam.title}`}
                    onClick={() => dropExam(index)}
                  >
                    <X className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
          {preview.skipped.length ? (
            <p className="text-xs text-muted-foreground">
              {`${preview.skipped.length} ${t("lines couldn't be read and were left out")}: ${preview.skipped.slice(0, 3).join(" / ")}`}
            </p>
          ) : null}
          <Button type="button" onClick={() => run.mutate(preview)} disabled={run.isPending}>
            {`${t("Add")} ${countLabel(preview)}`}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

/** Import a timetable from the .ics file a university portal exports. */
function IcsImport({ courses }: { courses: Course[] }) {
  const invalidate = useInvalidate();
  const input = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<ReturnType<typeof parseIcs> | null>(null);

  const run = useMutation({
    mutationFn: (result: ReturnType<typeof parseIcs>) => importSchedule(courses, result),
    onSuccess: () => {
      toast.success(t("Timetable imported."));
      setPreview(null);
      invalidate();
    },
    onError: (error) => toast.error(toError(error).message),
  });

  return (
    <section className="rounded-xl border border-dashed border-border p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <FileUp className="size-4" /> {t("Import from your university portal")}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {t(
          "Export your timetable as a calendar file (.ics) and choose it here. Repeating classes become timetable slots; exams become exam items.",
        )}
      </p>
      <input
        ref={input}
        type="file"
        accept=".ics,text/calendar"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          if (file.size > 2_000_000) {
            toast.error(t("That file is too big for a timetable."));
            return;
          }
          const result = parseIcs(await file.text());
          if (!result.slots.length && !result.exams.length)
            toast.error(t("No repeating classes or exams found in that file."));
          else setPreview(result);
        }}
      />
      {preview ? (
        <div className="mt-3 space-y-2 text-sm">
          <p>{`${t("Found")} ${countLabel(preview)}`}</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => run.mutate(preview)} disabled={run.isPending}>
              {t("Import")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPreview(null)}>
              {t("Cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="mt-3" onClick={() => input.current?.click()}>
          {t("Choose .ics file")}
        </Button>
      )}
    </section>
  );
}

function CoursesTab({ courses }: { courses: Course[] }) {
  const items = useQuery(studyItemsQuery());
  const invalidate = useInvalidate();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const onError = (error: unknown) => toast.error(toError(error).message);
  const add = useMutation({
    mutationFn: () =>
      addCourse({ name: name.trim(), code: code.trim() || null, teacher: null, color: null }),
    onSuccess: () => {
      setName("");
      setCode("");
      invalidate();
    },
    onError,
  });
  const remove = useMutation({ mutationFn: deleteCourse, onSuccess: invalidate, onError });

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) add.mutate();
        }}
      >
        <Input
          className="h-11 min-w-48 flex-1"
          placeholder="Course name"
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          className="h-11 w-28"
          placeholder="Code"
          maxLength={30}
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <Button type="submit" className="h-11" disabled={!name.trim() || add.isPending}>
          <Plus className="size-4" /> {t("Add")}
        </Button>
      </form>
      {courses.length ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {courses.map((course) => {
            const average = courseAverage(items.data ?? [], course.id);
            const open = (items.data ?? []).filter(
              (item) => item.course_id === course.id && !item.done,
            ).length;
            return (
              <li key={course.id} className="stat-card flex items-start justify-between gap-3 p-3">
                <span className="flex items-start gap-3">
                  <BookOpen className="mt-0.5 size-5 text-primary" />
                  <span>
                    <span className="block text-sm font-semibold">
                      {course.name}
                      {course.code ? (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {course.code}
                        </span>
                      ) : null}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {open} open
                      {average
                        ? ` · average ${average.percent}% from ${average.graded} graded`
                        : ""}
                    </span>
                  </span>
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Delete ${course.name}`}
                  onClick={() => remove.mutate(course.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <GraduationCap className="size-4" /> {t("No courses yet.")}
        </p>
      )}
    </div>
  );
}

/** "3 classes · 1 exam". */
function countLabel(result: { slots: unknown[]; exams: unknown[] }): string {
  const classes = result.slots.length;
  const exams = result.exams.length;
  return `${classes} ${t(classes === 1 ? "class" : "classes")} · ${exams} ${t(exams === 1 ? "exam" : "exams")}`;
}
