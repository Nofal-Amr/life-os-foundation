import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useLocation } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { FormDialog } from "@/components/app/FormDialog";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/States";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { capabilitiesQuery, capabilityKeys, createCapability } from "@/data/capabilities";
import { PRIORITIES, TASK_STATUSES, labelOf } from "@/data/enums";
import { createEvidence, evidenceKeys } from "@/data/evidence";
import { goalsQuery } from "@/data/goals";
import { createProject, projectKeys, projectsQuery } from "@/data/projects";
import {
  completeTask,
  createTask,
  deleteTask,
  filterTasks,
  reopenTask,
  taskKeys,
  tasksQuery,
  updateTask,
  type Task,
  type TaskFilter,
  type TaskInput,
} from "@/data/tasks";
import { formatDate } from "@/lib/date";


export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks — Life OS" },
      { name: "description", content: "Capture, filter and complete your tasks." },
      { property: "og:title", content: "Tasks — Life OS" },
      { property: "og:description", content: "Capture, filter and complete your tasks." },
    ],
  }),
  component: TasksPage,
});

const FILTERS: { value: TaskFilter; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "overdue", label: "Overdue" },
  { value: "inbox", label: "Inbox" },
  { value: "completed", label: "Completed" },
  { value: "all", label: "All" },
];

const emptyForm: TaskInput = {
  title: "",
  description: null,
  status: "inbox",
  priority: "medium",
  due_date: null,
  project_id: null,
  capability_id: null,
  goal_id: null,
};

const NO_PROJECT = "none";
const NONE = "none";
const NEW_PROJECT = "new-project";
const NEW_CAPABILITY = "new-capability";

function TasksPage() {
  const taskHash = useLocation({ select: (location) => location.hash });
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  const tasks = useQuery(tasksQuery());
  const projects = useQuery(projectsQuery());
  const capabilities = useQuery(capabilitiesQuery());
  const goals = useQuery(goalsQuery());
  const [filter, setFilter] = useState<TaskFilter>("today");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState<TaskInput>(emptyForm);
  const [toDelete, setToDelete] = useState<Task | null>(null);
  const [evidenceTask, setEvidenceTask] = useState<Task | null>(null);
  const [evidenceCapability, setEvidenceCapability] = useState<string | null>(null);
  const [evidenceNote, setEvidenceNote] = useState("");
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [showNewCapability, setShowNewCapability] = useState(false);
  const [newCapabilityName, setNewCapabilityName] = useState("");
  const loggedRef = useRef<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: taskKeys.all });
  const onError = (e: unknown) =>
    toast.error(e instanceof Error ? e.message : "Something went wrong.");

  const save = useMutation({
    mutationFn: async () => (editing ? updateTask(editing.id, form) : createTask(form)),
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      toast.success(editing ? "Task updated." : "Task created.");
    },
    onError,
  });

  const addProject = useMutation({
    mutationFn: () =>
      createProject({
        name: newProjectName.trim(),
        description: null,
        status: "planning",
        priority: "medium",
        start_date: null,
        due_date: null,
      }),
    onSuccess: (project) => {
      if (!project) return;
      queryClient.setQueryData(projectKeys.all, (current: typeof projects.data) => [
        project,
        ...(current ?? []).filter((item) => item.id !== project.id),
      ]);
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
      setForm((current) => ({ ...current, project_id: project.id }));
      setNewProjectName("");
      setShowNewProject(false);
      toast.success("Project created and selected.");
    },
    onError,
  });

  const addCapability = useMutation({
    mutationFn: () => createCapability({ name: newCapabilityName.trim(), description: null }),
    onSuccess: (capability) => {
      if (!capability) return;
      queryClient.setQueryData(capabilityKeys.all, (current: typeof capabilities.data) => [
        capability,
        ...(current ?? []).filter((item) => item.id !== capability.id),
      ]);
      queryClient.invalidateQueries({ queryKey: capabilityKeys.all });
      setForm((current) => ({ ...current, capability_id: capability.id }));
      setNewCapabilityName("");
      setShowNewCapability(false);
      toast.success("Capability created and selected.");
    },
    onError,
  });

  /** Append-only evidence row for a completed task. Never blocks completion. */
  function logEvidence(task: Task, capability_id: string | null, note: string | null) {
    if (loggedRef.current === task.id) return;
    loggedRef.current = task.id;
    createEvidence({
      task_id: task.id,
      capability_id,
      project_id: task.project_id,
      goal_id: task.goal_id,
      note,
    })
      .then(() => queryClient.invalidateQueries({ queryKey: evidenceKeys.all }))
      .catch(onError);
  }

  const toggle = useMutation({
    mutationFn: ({ task, completed }: { task: Task; completed: boolean }) =>
      completed ? reopenTask(task.id) : completeTask(task.id),
    onSuccess: (_data, variables) => {
      invalidate();
      if (!variables.completed) {
        loggedRef.current = null;
        setEvidenceCapability(variables.task.capability_id);
        setEvidenceNote("");
        setEvidenceTask(variables.task);
      }
    },
    onError,
  });

  function closeEvidence(confirmed: boolean) {
    const task = evidenceTask;
    if (task) {
      logEvidence(
        task,
        confirmed ? evidenceCapability : task.capability_id,
        confirmed ? evidenceNote.trim() || null : null,
      );
    }
    setEvidenceTask(null);
  }

  const remove = useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: () => {
      invalidate();
      setToDelete(null);
      toast.success("Task deleted.");
    },
    onError,
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setShowNewProject(false);
    setShowNewCapability(false);
    setDialogOpen(true);
  }

  function openEdit(task: Task) {
    setEditing(task);
    setForm({
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      due_date: task.due_date,
      project_id: task.project_id,
      capability_id: task.capability_id,
      goal_id: task.goal_id,
    });
    setShowNewProject(false);
    setShowNewCapability(false);
    setDialogOpen(true);
  }

  useEffect(() => {
    if (!taskHash || !tasks.data) return;
    const selectedTask = tasks.data.find((task) => task.id === taskHash);
    if (selectedTask) openEdit(selectedTask);
    navigate({ hash: "", replace: true });
  }, [navigate, taskHash, tasks.data]);


  const visible = filterTasks(tasks.data ?? [], filter);
  const projectName = (id: string | null) =>
    (projects.data ?? []).find((p) => p.id === id)?.name;

  return (
    <>
      <PageHeader
        title="Tasks"
        description="One list, filtered by when it matters."
        actions={<Button onClick={openCreate}>New task</Button>}
      />

      <Tabs value={filter} onValueChange={(v) => setFilter(v as TaskFilter)} className="mb-6">
        <TabsList className="flex-wrap">
          {FILTERS.map((f) => (
            <TabsTrigger key={f.value} value={f.value}>
              {f.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {tasks.isLoading ? (
        <LoadingState />
      ) : tasks.error ? (
        <ErrorState error={tasks.error} onRetry={() => tasks.refetch()} />
      ) : visible.length === 0 ? (
        <EmptyState
          title="Nothing here"
          description="No tasks match this filter yet."
          action={<Button onClick={openCreate}>New task</Button>}
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((task) => {
            const completed = task.status === "completed";
            return (
              <li key={task.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className={`font-medium ${completed ? "text-muted-foreground line-through" : ""}`}>
                      {task.title}
                    </p>
                    {task.description ? (
                      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                        {task.description}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary">{labelOf(TASK_STATUSES, task.status)}</Badge>
                      <Badge variant="outline">{labelOf(PRIORITIES, task.priority)}</Badge>
                      <span>Due {formatDate(task.due_date)}</span>
                      {task.project_id ? <span>{projectName(task.project_id)}</span> : null}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggle.mutate({ task, completed })}
                    >
                      {completed ? "Reopen" : "Complete"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(task)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setToDelete(task)}>
                      Delete
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? "Edit task" : "New task"}
        pending={save.isPending}
        onSubmit={() => save.mutate()}
      >
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="task-description">Description</Label>
          <Textarea
            id="task-description"
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.target.value || null })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => setForm({ ...form, status: v as Task["status"] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select
              value={form.priority}
              onValueChange={(v) => setForm({ ...form, priority: v as Task["priority"] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-due">Due date</Label>
            <Input
              id="task-due"
              type="date"
              value={form.due_date ?? ""}
              onChange={(e) => setForm({ ...form, due_date: e.target.value || null })}
            />
          </div>
          <div className="space-y-2">
            <Label>Project</Label>
            <Select
              value={form.project_id ?? NO_PROJECT}
              onValueChange={(v) => {
                if (v === NEW_PROJECT) {
                  setShowNewProject(true);
                  return;
                }
                setShowNewProject(false);
                setForm({ ...form, project_id: v === NO_PROJECT ? null : v });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="No project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NEW_PROJECT}>+ New project</SelectItem>
                <SelectItem value={NO_PROJECT}>No project</SelectItem>
                {(projects.data ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {showNewProject ? (
              <div className="flex gap-2">
                <Input
                  aria-label="New project name"
                  placeholder="Project name"
                  value={newProjectName}
                  onChange={(event) => setNewProjectName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      if (newProjectName.trim()) addProject.mutate();
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={!newProjectName.trim() || addProject.isPending}
                  onClick={() => addProject.mutate()}
                >
                  Add
                </Button>
              </div>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label>Capability (optional)</Label>
            <Select
              value={form.capability_id ?? NONE}
              onValueChange={(v) => {
                if (v === NEW_CAPABILITY) {
                  setShowNewCapability(true);
                  return;
                }
                setShowNewCapability(false);
                setForm({ ...form, capability_id: v === NONE ? null : v });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="No capability" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NEW_CAPABILITY}>+ New capability</SelectItem>
                <SelectItem value={NONE}>No capability</SelectItem>
                {(capabilities.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {showNewCapability ? (
              <div className="flex gap-2">
                <Input
                  aria-label="New capability name"
                  placeholder="Capability name"
                  value={newCapabilityName}
                  onChange={(event) => setNewCapabilityName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      if (newCapabilityName.trim()) addCapability.mutate();
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={!newCapabilityName.trim() || addCapability.isPending}
                  onClick={() => addCapability.mutate()}
                >
                  Add
                </Button>
              </div>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label>Goal (optional)</Label>
            <Select
              value={form.goal_id ?? NONE}
              onValueChange={(v) => setForm({ ...form, goal_id: v === NONE ? null : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="No goal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No goal</SelectItem>
                {(goals.data ?? []).map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </FormDialog>

      <FormDialog
        open={!!evidenceTask}
        onOpenChange={(open) => !open && closeEvidence(false)}
        title="What did this build? (optional)"
        description="Link this completed task to a capability. You can skip this."
        submitLabel="Save evidence"
        onSubmit={() => closeEvidence(true)}
      >
        <div className="space-y-2">
          <Label>Capability</Label>
          <Select
            value={evidenceCapability ?? NONE}
            onValueChange={(v) => setEvidenceCapability(v === NONE ? null : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="No capability" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>No capability</SelectItem>
              {(capabilities.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="evidence-note">Note</Label>
          <Textarea
            id="evidence-note"
            value={evidenceNote}
            onChange={(e) => setEvidenceNote(e.target.value)}
          />
        </div>
      </FormDialog>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete this task?"
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />

    </>
  );
}
