import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { PRIORITIES, PROJECT_STATUSES, labelOf } from "@/data/enums";
import {
  archiveProject,
  createProject,
  deleteProject,
  projectKeys,
  projectsQuery,
  updateProject,
  type Project,
  type ProjectInput,
} from "@/data/projects";
import { formatDate } from "@/lib/date";

export const Route = createFileRoute("/_authenticated/projects")({
  head: () => ({
    meta: [
      { title: "Projects — Life OS" },
      { name: "description", content: "Plan and track your personal projects." },
      { property: "og:title", content: "Projects — Life OS" },
      { property: "og:description", content: "Plan and track your personal projects." },
    ],
  }),
  component: ProjectsPage,
});

const emptyForm: ProjectInput = {
  name: "",
  description: null,
  status: "planning",
  priority: "medium",
  start_date: null,
  due_date: null,
};

function ProjectsPage() {
  const queryClient = useQueryClient();
  const projects = useQuery(projectsQuery());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [form, setForm] = useState<ProjectInput>(emptyForm);
  const [toDelete, setToDelete] = useState<Project | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: projectKeys.all });
  const onError = (e: unknown) =>
    toast.error(e instanceof Error ? e.message : "Something went wrong.");

  const save = useMutation({
    mutationFn: async () =>
      editing ? updateProject(editing.id, form) : createProject(form),
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      toast.success(editing ? "Project updated." : "Project created.");
    },
    onError,
  });

  const archive = useMutation({
    mutationFn: (id: string) => archiveProject(id),
    onSuccess: () => {
      invalidate();
      toast.success("Project archived.");
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: () => {
      invalidate();
      setToDelete(null);
      toast.success("Project deleted.");
    },
    onError,
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(project: Project) {
    setEditing(project);
    setForm({
      name: project.name,
      description: project.description,
      status: project.status,
      priority: project.priority,
      start_date: project.start_date,
      due_date: project.due_date,
    });
    setDialogOpen(true);
  }

  return (
    <>
      <PageHeader
        title="Projects"
        description="Everything you're moving forward, grouped by status."
        actions={<Button onClick={openCreate}>New project</Button>}
      />

      {projects.isLoading ? (
        <LoadingState />
      ) : projects.error ? (
        <ErrorState error={projects.error} onRetry={() => projects.refetch()} />
      ) : (projects.data ?? []).length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Create your first project to start organising your work."
          action={<Button onClick={openCreate}>New project</Button>}
        />
      ) : (
        <div className="space-y-8">
          {PROJECT_STATUSES.map(({ value, label }) => {
            const group = (projects.data ?? []).filter((p) => p.status === value);
            if (group.length === 0) return null;
            return (
              <section key={value}>
                <h2 className="mb-3 text-sm font-medium text-foreground">{label}</h2>
                <ul className="space-y-3">
                  {group.map((project) => (
                    <li
                      key={project.id}
                      className="rounded-xl border border-border bg-card p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{project.name}</p>
                          {project.description ? (
                            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                              {project.description}
                            </p>
                          ) : null}
                          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="secondary">
                              {labelOf(PRIORITIES, project.priority)}
                            </Badge>
                            <span>Start {formatDate(project.start_date)}</span>
                            <span>Due {formatDate(project.due_date)}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(project)}>
                            Edit
                          </Button>
                          {project.status !== "archived" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => archive.mutate(project.id)}
                            >
                              Archive
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setToDelete(project)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? "Edit project" : "New project"}
        pending={save.isPending}
        onSubmit={() => save.mutate()}
      >
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.target.value || null })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => setForm({ ...form, status: v as Project["status"] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_STATUSES.map((s) => (
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
              onValueChange={(v) => setForm({ ...form, priority: v as Project["priority"] })}
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
            <Label htmlFor="start">Start date</Label>
            <Input
              id="start"
              type="date"
              value={form.start_date ?? ""}
              onChange={(e) => setForm({ ...form, start_date: e.target.value || null })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="due">Due date</Label>
            <Input
              id="due"
              type="date"
              value={form.due_date ?? ""}
              onChange={(e) => setForm({ ...form, due_date: e.target.value || null })}
            />
          </div>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete this project?"
        description="Its tasks will stay, but they'll no longer be linked to a project."
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </>
  );
}
