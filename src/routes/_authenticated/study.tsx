import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { BookOpen, CalendarClock, FileUp, GraduationCap, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { DatePicker } from "@/components/app/DatePicker";
import { PageHeader } from "@/components/app/PageHeader";
import { ErrorState, LoadingState } from "@/components/app/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  type StudyKind,
} from "@/data/study";
import { usePreferences } from "@/hooks/usePreferences";
import { todayISO } from "@/lib/date";
import { toError } from "@/lib/supabase-helpers";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/study")({
  head: () => ({ meta: [{ title: "Study · Life OS" }] }),
  component: StudyPage,
});

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function StudyPage() {
  const courses = useQuery(coursesQuery());
  const sessions = useQuery(classSessionsQuery());
  const items = useQuery(studyItemsQuery());
  const [tab, setTab] = useState<"due" | "week" | "courses">("due");

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
            <CalendarClock className="size-4" /> Today's classes
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
            <p className="text-sm text-muted-foreground">No classes today.</p>
          )}
        </section>

        <div className="flex gap-1 rounded-lg bg-secondary p-1" role="tablist" aria-label="Study">
          {(
            [
              { value: "due", label: "Due" },
              { value: "week", label: "Timetable" },
              { value: "courses", label: "Courses" },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={tab === option.value}
              onClick={() => setTab(option.value)}
              className={cn(
                "min-h-10 flex-1 rounded-md text-sm font-medium",
                tab === option.value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        {tab === "due" ? <DueTab courses={list} /> : null}
        {tab === "week" ? <TimetableTab courses={list} /> : null}
        {tab === "courses" ? <CoursesTab courses={list} /> : null}
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
        {allowNone ? <SelectItem value="none">No course</SelectItem> : null}
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
          <Label htmlFor="study-title">What's due</Label>
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
          <Label>Kind</Label>
          <Select value={kind} onValueChange={(value) => setKind(value as StudyKind)}>
            <SelectTrigger className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STUDY_KINDS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Course</Label>
          <CourseSelect courses={courses} value={course} onChange={setCourse} allowNone />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="study-date">Due</Label>
          <DatePicker id="study-date" value={date} onChange={(value) => value && setDate(value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="study-time">Time</Label>
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
          <Plus className="size-4" /> Add
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
          Nothing due. Add assignments and exams above.
        </p>
      )}

      {done.length ? (
        <section className="space-y-2">
          <p className="text-sm font-semibold">Done</p>
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
            <Label>Course</Label>
            <CourseSelect courses={courses} value={course} onChange={setCourse} />
          </div>
          <div className="space-y-1.5">
            <Label>Day</Label>
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
            <Label htmlFor="class-start">From</Label>
            <Input
              id="class-start"
              type="time"
              className="h-11"
              value={starts}
              onChange={(e) => setStarts(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="class-end">To</Label>
            <Input
              id="class-end"
              type="time"
              className="h-11"
              value={ends}
              onChange={(e) => setEnds(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="class-room">Room</Label>
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
            <Plus className="size-4" /> Add class
          </Button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">
          Add a course first (Courses tab), or import your timetable.
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

/** Import a timetable from the .ics file a university portal exports. */
function IcsImport({ courses }: { courses: Course[] }) {
  const invalidate = useInvalidate();
  const input = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<ReturnType<typeof parseIcs> | null>(null);

  const run = useMutation({
    mutationFn: async (result: ReturnType<typeof parseIcs>) => {
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
          course_id: null,
          due_at: exam.dueAt,
          weight: null,
          note: null,
        });
      }
    },
    onSuccess: () => {
      toast.success("Timetable imported.");
      setPreview(null);
      invalidate();
    },
    onError: (error) => toast.error(toError(error).message),
  });

  return (
    <section className="rounded-xl border border-dashed border-border p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <FileUp className="size-4" /> Import from your university portal
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Export your timetable as a calendar file (.ics) and choose it here. Repeating classes become
        timetable slots; exams become exam items.
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
            toast.error("That file is too big for a timetable.");
            return;
          }
          const result = parseIcs(await file.text());
          if (!result.slots.length && !result.exams.length)
            toast.error("No repeating classes or exams found in that file.");
          else setPreview(result);
        }}
      />
      {preview ? (
        <div className="mt-3 space-y-2 text-sm">
          <p>
            Found {preview.slots.length} weekly {preview.slots.length === 1 ? "class" : "classes"}{" "}
            and {preview.exams.length} {preview.exams.length === 1 ? "exam" : "exams"}.
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => run.mutate(preview)} disabled={run.isPending}>
              Import
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPreview(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="mt-3" onClick={() => input.current?.click()}>
          Choose .ics file
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
          <Plus className="size-4" /> Add
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
          <GraduationCap className="size-4" /> No courses yet.
        </p>
      )}
    </div>
  );
}
