import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { DatePicker } from "@/components/app/DatePicker";
import { EntityIcon, EntityIdentityPicker } from "@/components/app/EntityIdentity";
import { ListRow, RowList } from "@/components/app/ListRow";
import { FormDialog } from "@/components/app/FormDialog";
import { MoreOptions } from "@/components/app/MoreOptions";
import { projectExtrasSet } from "@/data/formExtras";
import { ProjectCover, ProjectCoverPicker } from "@/components/app/ProjectCover";
import { PlansDialog } from "@/components/app/PlansDialog";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/States";
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
import { PRIORITIES, PROJECT_STATUSES } from "@/data/enums";
import {
  archiveProject,
  createProject,
  deleteProject,
  projectKeys,
  projectsQuery,
  removeProjectCover,
  updateProject,
  uploadProjectCover,
  type Project,
  type ProjectInput,
} from "@/data/projects";
import { tasksQuery } from "@/data/tasks";
import { goalsQuery } from "@/data/goals";
import { projectGoals, projectProgress } from "@/data/links";
import { CountBar, GoalChips } from "@/components/app/LinkedProgress";
import { usePreferences } from "@/hooks/usePreferences";
import { useModules } from "@/hooks/useModules";
import { projectSpace, spaceProject, withProjectSpace, type CalendarSpace } from "@/data/spaces";
import { priorityLabel, priorityTone, projectStatusTone } from "@/lib/semantics";
import { SemanticBadge } from "@/components/app/SemanticBadge";
import { t } from "@/lib/i18n";

const emptyForm: ProjectInput = {
  name: "",
  description: null,
  status: "planning",
  priority: "medium",
  start_date: null,
  due_date: null,
  icon: null,
  color: null,
  image_url: null,
};

/**
 * Projects for one space: Life (the Projects page), or Work / Study (their
 * Projects tab). A project moved to Work or Study shows only there; the
 * spaces' own catch-all projects stay behind their Tasks tabs.
 */
export function ProjectsView({ space }: { space: CalendarSpace }) {
  const queryClient = useQueryClient();
  const projects = useQuery(projectsQuery());
  const tasks = useQuery(tasksQuery());
  const goals = useQuery(goalsQuery());
  const { fmtDate } = usePreferences();
  const { enabled, setModules } = useModules();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [form, setForm] = useState<ProjectInput>(emptyForm);
  const [toDelete, setToDelete] = useState<Project | null>(null);
  const [plansOpen, setPlansOpen] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [removeCover, setRemoveCover] = useState(false);

  const all = projects.data ?? [];
  const homes = new Set(
    [spaceProject(all, "work")?.id, spaceProject(all, "study")?.id].filter(Boolean),
  );
  const inSpace = (target: CalendarSpace) =>
    all.filter(
      (project) => !homes.has(project.id) && projectSpace(enabled, project, all) === target,
    );
  const list = inSpace(space);
  const spaceName = space === "work" ? "Work" : space === "study" ? "Study" : "Life";

  const invalidate = () => queryClient.invalidateQueries({ queryKey: projectKeys.all });
  const onError = (e: unknown) =>
    toast.error(e instanceof Error ? e.message : "Something went wrong.");

  const save = useMutation({
    mutationFn: async () => {
      const project = editing ? await updateProject(editing.id, form) : await createProject(form);
      if (coverFile) await uploadProjectCover(project.id, coverFile, editing?.image_url);
      else if (removeCover && editing?.image_url)
        await removeProjectCover(project.id, editing.image_url);
      return project;
    },
    onSuccess: (project) => {
      // A project started in Work or Study belongs there.
      if (!editing && space !== "life") {
        setModules(withProjectSpace(enabled, project.id, space));
      }
      invalidate();
      setDialogOpen(false);
      setCoverFile(null);
      setRemoveCover(false);
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

  /** Move a project, with its tasks and subtasks, to Work, Study or back to Life. */
  function moveActions(project: Project) {
    // The spaces' own projects stay where they are.
    if (
      spaceProject(all, "work")?.id === project.id ||
      spaceProject(all, "study")?.id === project.id
    )
      return [];
    const here = projectSpace(enabled, project, all);
    const targets: { space: CalendarSpace; label: string }[] = [
      { space: "work", label: "Move to Work" },
      { space: "study", label: "Move to Study" },
      { space: "life", label: "Move back to Life" },
    ];
    return targets
      .filter((target) => target.space !== here)
      .map((target) => ({
        label: target.label,
        onSelect: () => {
          setModules(withProjectSpace(enabled, project.id, target.space));
          toast.success(`${project.name} · ${t(target.label)}`);
        },
      }));
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setCoverFile(null);
    setRemoveCover(false);
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
      icon: project.icon,
      color: project.color,
      image_url: project.image_url,
    });
    setCoverFile(null);
    setRemoveCover(false);
    setDialogOpen(true);
  }

  const elsewhere = (["work", "study"] as const)
    .map((target) => ({ target, count: inSpace(target).length }))
    .filter((item) => item.count > 0);

  return (
    <>
      {space === "life" ? (
        <>
          <PlansDialog open={plansOpen} onOpenChange={setPlansOpen} />
          <PageHeader
            title="Projects"
            description="Everything you're moving forward, grouped by status."
            actions={
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setPlansOpen(true)}>
                  From a plan
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/import-plan">{t("Import a plan")}</Link>
                </Button>
                <Button onClick={openCreate}>{t("New project")}</Button>
              </div>
            }
          />
          {elsewhere.length ? (
            <p className="-mt-2 mb-4 text-sm text-muted-foreground">
              {elsewhere.map((item, index) => (
                <span key={item.target}>
                  {index > 0 ? " · " : ""}
                  <Link
                    to={item.target === "work" ? "/work" : "/study"}
                    search={{ tab: "projects" }}
                    className="underline-offset-4 hover:underline"
                  >
                    {`${t(item.target === "work" ? "In Work" : "In Study")}: ${item.count} ${t(item.count === 1 ? "project" : "projects")}`}
                  </Link>
                </span>
              ))}
            </p>
          ) : null}
        </>
      ) : (
        <div className="mb-4 flex justify-end">
          <Button onClick={openCreate}>{t("New project")}</Button>
        </div>
      )}

      {projects.isLoading ? (
        <LoadingState />
      ) : projects.error ? (
        <ErrorState error={projects.error} onRetry={() => projects.refetch()} />
      ) : list.length === 0 ? (
        space === "life" ? (
          <EmptyState
            title="No projects yet"
            description="A project holds the tasks that belong together, so related work stays in one place."
            action={<Button onClick={openCreate}>{t("New project")}</Button>}
          />
        ) : (
          <EmptyState
            title={`${t("No projects in")} ${t(spaceName)}`}
            description="Start one here, or move one in from Projects with its ⋯ menu."
          />
        )
      ) : (
        <div className="space-y-8">
          {PROJECT_STATUSES.map(({ value, label }) => {
            const group = list.filter((p) => p.status === value);
            if (group.length === 0) return null;
            return (
              <section key={value}>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                  <SemanticBadge tone={projectStatusTone(value)}>{label}</SemanticBadge>
                </h2>
                <RowList>
                  {group.map((project) => (
                    <ListRow
                      key={project.id}
                      muted={project.status === "archived"}
                      header={
                        <ProjectCover
                          path={project.image_url}
                          name={project.name}
                          icon={project.icon}
                          color={project.color}
                        />
                      }
                      leading={
                        <span className="flex size-11 items-center justify-center">
                          <EntityIcon icon={project.icon} color={project.color} />
                        </span>
                      }
                      title={<span className="truncate">{project.name}</span>}
                      openLabel={`Open ${project.name}`}
                      onOpen={() => openEdit(project)}
                      meta={
                        <>
                          {project.priority !== "low" && project.priority !== "medium" ? (
                            <SemanticBadge tone={priorityTone(project.priority)}>
                              {priorityLabel(project.priority)} priority
                            </SemanticBadge>
                          ) : null}
                          {project.due_date ? (
                            <span>
                              {t("Due")} {fmtDate(project.due_date)}
                            </span>
                          ) : null}
                          {project.description ? (
                            <span className="line-clamp-1 max-w-xl">{t(project.description)}</span>
                          ) : null}
                        </>
                      }
                      actions={[
                        ...moveActions(project),
                        ...(project.status !== "archived"
                          ? [{ label: "Archive", onSelect: () => archive.mutate(project.id) }]
                          : []),
                        {
                          label: "Delete",
                          destructive: true,
                          onSelect: () => setToDelete(project),
                        },
                      ]}
                    >
                      <div className="max-w-md space-y-3 pl-0 sm:pl-14">
                        <CountBar
                          count={projectProgress(tasks.data ?? [], project.id)}
                          label="tasks"
                        />
                        <GoalChips
                          goals={projectGoals(tasks.data ?? [], goals.data ?? [], project.id)}
                        />
                      </div>
                    </ListRow>
                  ))}
                </RowList>
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
          <Label htmlFor="name">{t("Name")}</Label>
          <Input
            id="name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <MoreOptions
          defaultOpen={Boolean(editing) && (projectExtrasSet(form) > 0 || Boolean(coverFile))}
          setCount={projectExtrasSet(form) + (coverFile ? 1 : 0)}
        >
          <ProjectCoverPicker
            file={coverFile}
            currentPath={editing?.image_url ?? null}
            removeCurrent={removeCover}
            onFileChange={(file) => {
              setCoverFile(file);
              if (file) setRemoveCover(false);
            }}
            onRemoveCurrent={() => setRemoveCover(true)}
          />
          <EntityIdentityPicker
            value={{ icon: form.icon, color: form.color }}
            onChange={(identity) => setForm({ ...form, ...identity })}
          />
          <div className="space-y-2">
            <Label htmlFor="description">{t("Description")}</Label>
            <Textarea
              id="description"
              value={form.description ?? ""}
              onChange={(e) => setForm({ ...form, description: e.target.value || null })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("Status")}</Label>
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
                      {t(s.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("Priority")}</Label>
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
                      {t(p.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="start">{t("Start date")}</Label>
              <DatePicker
                id="start"
                value={form.start_date}
                onChange={(value) => setForm({ ...form, start_date: value || null })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due">{t("Due date")}</Label>
              <DatePicker
                id="due"
                value={form.due_date}
                onChange={(value) => setForm({ ...form, due_date: value || null })}
              />
            </div>
          </div>
        </MoreOptions>
      </FormDialog>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete this project?"
        description={(() => {
          const linked = (tasks.data ?? []).filter(
            (task) => task.project_id === toDelete?.id,
          ).length;
          return linked > 0
            ? `${linked} ${linked === 1 ? "task is" : "tasks are"} in this project. Those tasks stay, but they will no longer be linked to a project.`
            : "Its tasks will stay, but they'll no longer be linked to a project.";
        })()}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </>
  );
}
