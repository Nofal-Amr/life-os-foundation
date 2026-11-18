import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { addDays, parseISO } from "date-fns";
import { format } from "@/lib/dates";
import {
  CalendarDays,
  Check,
  FolderInput,
  Lightbulb,
  Plus,
  StickyNote,
  Trash2,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { DatePicker } from "@/components/app/DatePicker";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/States";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createNote, deleteNote, noteKeys, notesQuery, type Note } from "@/data/notes";
import { createProject, projectKeys, projectsQuery, type Project } from "@/data/projects";
import {
  SPACES,
  spaceNotes,
  projectSpace,
  spaceProject,
  spaceProjectIds,
  spaceTags,
  withProjectSpace,
  type SpaceKey,
  type SpaceTab,
} from "@/data/spaces";
import { studyItemsQuery } from "@/data/study";
import {
  completeTask,
  createTask,
  deleteTask,
  isOpen,
  reopenTask,
  taskKeys,
  tasksQuery,
  type Task,
} from "@/data/tasks";
import { useModules } from "@/hooks/useModules";
import { usePreferences } from "@/hooks/usePreferences";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** A row of tabs that scrolls sideways on a phone instead of squeezing. */
export function TabRow<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div
      className="-mx-1 mb-5 overflow-x-auto px-1 [scrollbar-width:none]"
      role="tablist"
      aria-label={t(label)}
    >
      <div className="inline-flex min-w-full gap-1 rounded-xl bg-secondary p-1">
        {tabs.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "min-h-10 flex-1 whitespace-nowrap rounded-lg px-3.5 text-sm font-medium transition-colors",
              value === option.value
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(option.label)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SpaceTabContent({ space, tab }: { space: SpaceKey; tab: SpaceTab }) {
  if (tab === "tasks") return <SpaceTasks space={space} />;
  if (tab === "notes") return <SpaceNotes space={space} kind="notes" />;
  if (tab === "ideas") return <SpaceNotes space={space} kind="ideas" />;
  return <SpaceCalendar space={space} />;
}

const onError = (error: unknown) =>
  toast.error(error instanceof Error ? error.message : t("Something went wrong."));

/* ---------- Tasks ---------- */

function SpaceTasks({ space }: { space: SpaceKey }) {
  const queryClient = useQueryClient();
  const projects = useQuery(projectsQuery());
  const tasks = useQuery(tasksQuery());
  const { fmtShortDate } = usePreferences();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [bringing, setBringing] = useState(false);
  const { enabled, setModules } = useModules();

  const project = spaceProject(projects.data ?? [], space);
  const movedIn = (projects.data ?? []).filter(
    (item) =>
      item.id !== project?.id && spaceProjectIds(projects.data ?? [], enabled, space).has(item.id),
  );
  const tasksOf = (projectId: string) =>
    (tasks.data ?? []).filter((task) => task.project_id === projectId && !task.parent_task_id);
  const subtaskCount = (taskId: string) =>
    (tasks.data ?? []).filter((task) => task.parent_task_id === taskId).length;
  const mine = (tasks.data ?? []).filter(
    (task) => project && task.project_id === project.id && !task.parent_task_id,
  );
  const open = mine
    .filter(isOpen)
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
  const done = mine.filter((task) => !isOpen(task));

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: taskKeys.all });
    void queryClient.invalidateQueries({ queryKey: projectKeys.all });
  };

  const add = useMutation({
    mutationFn: async () => {
      const home: Project =
        project ??
        (await createProject({
          name: t(SPACES[space].name),
          description: SPACES[space].description,
          status: "active",
          priority: "medium",
          start_date: null,
          due_date: null,
          icon: SPACES[space].icon,
          color: SPACES[space].color,
        }));
      return createTask({
        title: title.trim(),
        description: null,
        status: "todo",
        priority: "medium",
        due_date: due,
        project_id: home.id,
        capability_id: null,
        goal_id: null,
      });
    },
    onSuccess: () => {
      setTitle("");
      setDue(null);
      refresh();
    },
    onError,
  });
  const toggle = useMutation({
    mutationFn: (task: Task) => (isOpen(task) ? completeTask(task.id) : reopenTask(task.id)),
    onSuccess: refresh,
    onError,
  });
  const remove = useMutation({
    mutationFn: (task: Task) => deleteTask(task.id),
    onSuccess: refresh,
    onError,
  });

  if (projects.isLoading || tasks.isLoading) return <LoadingState rows={3} />;
  const error = projects.error ?? tasks.error;
  if (error) return <ErrorState error={error} onRetry={() => void tasks.refetch()} />;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    add.mutate();
  };

  const row = (task: Task) => (
    <li
      key={task.id}
      className="flex min-h-12 items-center gap-3 rounded-xl border border-border bg-card px-3 py-2"
    >
      <button
        type="button"
        onClick={() => toggle.mutate(task)}
        aria-label={isOpen(task) ? t("Mark done") : t("Mark not done")}
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-full border transition-colors",
          isOpen(task) ? "border-border" : "border-primary bg-primary text-primary-foreground",
        )}
      >
        {isOpen(task) ? null : <Check className="size-3.5" />}
      </button>
      <div className="min-w-0 flex-1">
        <p
          className={cn("truncate text-sm", !isOpen(task) && "text-muted-foreground line-through")}
        >
          {task.title}
        </p>
        {task.due_date || subtaskCount(task.id) ? (
          <p className="text-xs text-muted-foreground">
            {[
              task.due_date ? fmtShortDate(task.due_date) : null,
              subtaskCount(task.id) ? `${subtaskCount(task.id)} ${t("subtasks")}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
      </div>
      <Button
        size="icon"
        variant="ghost"
        aria-label={t("Delete")}
        onClick={() => remove.mutate(task)}
      >
        <Trash2 className="size-4" />
      </Button>
    </li>
  );

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t(space === "work" ? "A work task" : "A study task")}
          aria-label={t("New task")}
          className="h-11 flex-1"
        />
        <DatePicker value={due} onChange={setDue} placeholder="No date" className="sm:w-44" />
        <Button type="submit" className="h-11" disabled={!title.trim() || add.isPending}>
          <Plus className="size-4" /> {t("Add")}
        </Button>
      </form>

      {open.length ? (
        <ul className="space-y-2">{open.map(row)}</ul>
      ) : movedIn.length ? null : (
        <EmptyState
          title={space === "work" ? "No work tasks yet" : "No study tasks yet"}
          description="Type one above. They also show in Tasks and on the calendar when they have a date."
        />
      )}

      {done.length ? (
        <div>
          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setShowDone((value) => !value)}
          >
            {`${showDone ? t("Hide done") : t("Show done")} (${done.length})`}
          </button>
          {showDone ? <ul className="mt-2 space-y-2">{done.map(row)}</ul> : null}
        </div>
      ) : null}

      {movedIn.map((item) => {
        const list = tasksOf(item.id);
        const openOnes = list.filter(isOpen);
        return (
          <section key={item.id} className="space-y-2 pt-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="min-w-0 truncate text-sm font-semibold">
                {item.name}
                <span className="ms-2 font-normal text-muted-foreground">
                  {`${openOnes.length} ${t("open")} · ${list.length - openOnes.length} ${t("done")}`}
                </span>
              </h3>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setModules(withProjectSpace(enabled, item.id, "life"));
                  toast.success(`${item.name} · ${t("moved back to Life")}`);
                }}
              >
                {t("Move back to Life")}
              </Button>
            </div>
            {openOnes.length ? (
              <ul className="space-y-2">{openOnes.map(row)}</ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t("Nothing open in this project.")}</p>
            )}
          </section>
        );
      })}

      <Button type="button" variant="outline" onClick={() => setBringing(true)}>
        <FolderInput className="size-4" /> {t("Bring in a project")}
      </Button>
      <BringProjectDialog
        open={bringing}
        onOpenChange={setBringing}
        space={space}
        projects={projects.data ?? []}
        tasks={tasks.data ?? []}
        enabled={enabled}
        onPick={(item) => {
          setModules(withProjectSpace(enabled, item.id, space));
          setBringing(false);
          toast.success(
            `${item.name} · ${t(space === "work" ? "moved to Work" : "moved to Study")}`,
          );
        }}
      />
    </div>
  );
}

/** Pick one of your other projects to move here, with all its tasks and subtasks. */
function BringProjectDialog({
  open,
  onOpenChange,
  space,
  projects,
  tasks,
  enabled,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  space: SpaceKey;
  projects: Project[];
  tasks: Task[];
  enabled: readonly string[];
  onPick: (project: Project) => void;
}) {
  const choices = projects.filter(
    (item) => item.status !== "archived" && projectSpace(enabled, item, projects) !== space,
  );
  const where = (item: Project) => projectSpace(enabled, item, projects);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t(space === "work" ? "Bring a project into Work" : "Bring a project into Study")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "Its tasks and subtasks come with it. Nothing is copied or deleted, and you can move it back any time.",
            )}
          </DialogDescription>
        </DialogHeader>
        {choices.length ? (
          <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
            {choices
              .filter(
                (item) =>
                  spaceProject(projects, "work")?.id !== item.id &&
                  spaceProject(projects, "study")?.id !== item.id,
              )
              .map((item) => {
                const count = tasks.filter((task) => task.project_id === item.id).length;
                const from = where(item);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onPick(item)}
                      className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2 text-start hover:bg-accent"
                    >
                      <span className="min-w-0 truncate text-sm font-medium">{item.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {`${count} ${t("tasks")}`}
                        {from !== "life" ? ` · ${t(from === "work" ? "in Work" : "in Study")}` : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("No other projects to bring in.")}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Notes and ideas ---------- */

function SpaceNotes({ space, kind }: { space: SpaceKey; kind: "notes" | "ideas" }) {
  const queryClient = useQueryClient();
  const notes = useQuery(notesQuery());
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const { fmtShortDate } = usePreferences();

  const list = spaceNotes(notes.data ?? [], space, kind);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: noteKeys.all });

  const add = useMutation({
    mutationFn: () =>
      createNote({
        title: title.trim(),
        body: body.trim() || null,
        tags: spaceTags(space, kind),
      }),
    onSuccess: () => {
      setTitle("");
      setBody("");
      refresh();
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: (note: Note) => deleteNote(note.id),
    onSuccess: refresh,
    onError,
  });

  if (notes.isLoading) return <LoadingState rows={3} />;
  if (notes.error) return <ErrorState error={notes.error} onRetry={() => void notes.refetch()} />;

  const ideas = kind === "ideas";
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() && !body.trim()) return;
    add.mutate();
  };
  const Icon = ideas ? Lightbulb : StickyNote;

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="space-y-2 rounded-xl border border-border bg-card p-3">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t(ideas ? "An idea, in a line" : "Title")}
          aria-label={t(ideas ? "New idea" : "Note title")}
          className="h-11"
        />
        {ideas ? null : (
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={t("Write it down")}
            aria-label={t("Note")}
            rows={3}
          />
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={(!title.trim() && !body.trim()) || add.isPending}>
            <Plus className="size-4" /> {t(ideas ? "Add idea" : "Add note")}
          </Button>
        </div>
      </form>

      {list.length ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {list.map((note) => (
            <li key={note.id} className="group rounded-xl border border-border bg-card p-3">
              <div className="flex items-start gap-2">
                <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <Link
                  to="/notes"
                  search={{ open: note.id }}
                  className="min-w-0 flex-1 rounded-sm focus-visible:outline-2"
                >
                  <p className="text-sm font-medium [overflow-wrap:anywhere]">
                    {note.title || t("Untitled")}
                  </p>
                  {note.body ? (
                    <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-muted-foreground">
                      {note.body}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {fmtShortDate(note.updated_at.slice(0, 10))}
                  </p>
                </Link>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={t("Delete")}
                  onClick={() => remove.mutate(note)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title={ideas ? "No ideas yet" : "No notes yet"}
          description={
            ideas
              ? "Catch an idea in one line before it goes. You can grow it into a note or a task later."
              : "Notes here are also in Notes, tagged so they stay together."
          }
        />
      )}
    </div>
  );
}

/* ---------- Calendar ---------- */

type Dated = { id: string; date: string; title: string; detail: string; done: boolean };

function SpaceCalendar({ space }: { space: SpaceKey }) {
  const projects = useQuery(projectsQuery());
  const tasks = useQuery(tasksQuery());
  const items = useQuery({ ...studyItemsQuery(), enabled: space === "study" });
  const { fmtLongDate } = usePreferences();
  const { enabled } = useModules();

  if (projects.isLoading || tasks.isLoading) return <LoadingState rows={3} />;
  const ids = spaceProjectIds(projects.data ?? [], enabled, space);
  const today = format(new Date(), "yyyy-MM-dd");
  const until = format(addDays(new Date(), 60), "yyyy-MM-dd");

  const list: Dated[] = [];
  for (const task of tasks.data ?? []) {
    if (!task.project_id || !ids.has(task.project_id) || !task.due_date || task.parent_task_id)
      continue;
    list.push({
      id: `task-${task.id}`,
      date: task.due_date,
      title: task.title,
      detail: t("Task"),
      done: !isOpen(task),
    });
  }
  if (space === "study") {
    for (const item of items.data ?? []) {
      if (!item.due_at) continue;
      list.push({
        id: `study-${item.id}`,
        date: format(new Date(item.due_at), "yyyy-MM-dd"),
        title: item.title,
        detail: t(item.kind.charAt(0).toUpperCase() + item.kind.slice(1)),
        done: item.done,
      });
    }
  }
  const upcoming = list
    .filter((item) => item.date >= today && item.date <= until)
    .sort((a, b) => a.date.localeCompare(b.date));
  const days = [...new Set(upcoming.map((item) => item.date))];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{t("The next 60 days")}</p>
        <Button asChild variant="outline" size="sm">
          <Link to="/calendar">
            <CalendarDays className="size-4" /> {t("Open the full calendar")}
          </Link>
        </Button>
      </div>
      {days.length ? (
        <ol className="space-y-4">
          {days.map((day) => (
            <li key={day}>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                {day === today ? t("Today") : fmtLongDate(parseISO(day))}
              </p>
              <ul className="space-y-1.5">
                {upcoming
                  .filter((item) => item.date === day)
                  .map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                    >
                      <span
                        className={cn(
                          "min-w-0 truncate",
                          item.done && "line-through text-muted-foreground",
                        )}
                      >
                        {item.title}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">{item.detail}</span>
                    </li>
                  ))}
              </ul>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          title="Nothing dated in the next 60 days"
          description={
            space === "study"
              ? "Tasks with a date and assignments or exams with a due date show here."
              : "Tasks with a date show here."
          }
        />
      )}
    </div>
  );
}
