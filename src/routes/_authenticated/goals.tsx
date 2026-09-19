import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { FormDialog } from "@/components/app/FormDialog";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { GOAL_STATUSES } from "@/data/enums";
import {
  createGoal,
  deleteGoal,
  goalKeys,
  goalsQuery,
  updateGoal,
  type Goal,
  type GoalInput,
} from "@/data/goals";
import { tasksQuery } from "@/data/tasks";
import { usePreferences } from "@/hooks/usePreferences";
import { goalStatusLabel, goalStatusTone } from "@/lib/semantics";
import { QuickAddTaskButton } from "@/components/app/QuickAddTask";
import { SemanticBadge } from "@/components/app/SemanticBadge";

export const Route = createFileRoute("/_authenticated/goals")({
  head: () => ({
    meta: [
      { title: "Goals — Life OS" },
      { name: "description", content: "Set goals and track progress at your own pace." },
      { property: "og:title", content: "Goals — Life OS" },
      { property: "og:description", content: "Set goals and track progress at your own pace." },
    ],
  }),
  component: GoalsPage,
});

const emptyForm: GoalInput = {
  name: "",
  description: null,
  category: null,
  target_date: null,
  status: "not_started",
  progress: 0,
};

function GoalsPage() {
  const queryClient = useQueryClient();
  const goals = useQuery(goalsQuery());
  const tasks = useQuery(tasksQuery());
  const { fmtDate } = usePreferences();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [form, setForm] = useState<GoalInput>(emptyForm);
  const [toDelete, setToDelete] = useState<Goal | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: goalKeys.all });
  const onError = (e: unknown) =>
    toast.error(e instanceof Error ? e.message : "Something went wrong.");

  const save = useMutation({
    mutationFn: async () => (editing ? updateGoal(editing.id, form) : createGoal(form)),
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      toast.success(editing ? "Goal updated." : "Goal created.");
    },
    onError,
  });

  const setProgress = useMutation({
    mutationFn: ({ id, progress }: { id: string; progress: number }) =>
      updateGoal(id, { progress }),
    onSuccess: invalidate,
    onError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteGoal(id),
    onSuccess: () => {
      invalidate();
      setToDelete(null);
      toast.success("Goal deleted.");
    },
    onError,
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(goal: Goal) {
    setEditing(goal);
    setForm({
      name: goal.name,
      description: goal.description,
      category: goal.category,
      target_date: goal.target_date,
      status: goal.status,
      progress: goal.progress,
    });
    setDialogOpen(true);
  }

  return (
    <>
      <PageHeader
        title="Goals"
        description="Longer horizons, updated by hand when things move."
        actions={<Button onClick={openCreate}>New goal</Button>}
      />

      {goals.isLoading ? (
        <LoadingState />
      ) : goals.error ? (
        <ErrorState error={goals.error} onRetry={() => goals.refetch()} />
      ) : (goals.data ?? []).length === 0 ? (
        <EmptyState
          title="No goals yet"
          description="Name what you're working towards."
          action={<Button onClick={openCreate}>New goal</Button>}
        />
      ) : (
        <ul className="space-y-3">
          {(goals.data ?? []).map((goal) => (
            <li key={goal.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{goal.name}</p>
                  {goal.description ? (
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                      {goal.description}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <SemanticBadge tone={goalStatusTone(goal.status)}>
                      {goalStatusLabel(goal.status)}
                    </SemanticBadge>
                    {goal.category ? <SemanticBadge tone="neutral">{goal.category}</SemanticBadge> : null}
                    <span>Target {fmtDate(goal.target_date)}</span>
                  </div>
                  <div className="mt-4 max-w-md space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Progress</span>
                      <span className="tabular-nums">{goal.progress}%</span>
                    </div>
                    <Progress value={goal.progress} />
                    <Slider
                      value={[goal.progress]}
                      max={100}
                      step={5}
                      aria-label={`Progress for ${goal.name}`}
                      onValueChange={([v]) =>
                        setProgress.mutate({ id: goal.id, progress: v ?? 0 })
                      }
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(goal)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setToDelete(goal)}>
                    Delete
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? "Edit goal" : "New goal"}
        pending={save.isPending}
        onSubmit={() => save.mutate()}
      >
        <div className="space-y-2">
          <Label htmlFor="goal-name">Name</Label>
          <Input
            id="goal-name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="goal-description">Description</Label>
          <Textarea
            id="goal-description"
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.target.value || null })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="goal-category">Category</Label>
            <Input
              id="goal-category"
              value={form.category ?? ""}
              onChange={(e) => setForm({ ...form, category: e.target.value || null })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-target">Target date</Label>
            <Input
              id="goal-target"
              type="date"
              value={form.target_date ?? ""}
              onChange={(e) => setForm({ ...form, target_date: e.target.value || null })}
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => setForm({ ...form, status: v as Goal["status"] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GOAL_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-progress">Progress (%)</Label>
            <Input
              id="goal-progress"
              type="number"
              min={0}
              max={100}
              value={form.progress}
              onChange={(e) =>
                setForm({
                  ...form,
                  progress: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                })
              }
            />
          </div>
        </div>
      </FormDialog>

      <QuickAddTaskButton />

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete this goal?"
        description={(() => {
          const linked = (tasks.data ?? []).filter((task) => task.goal_id === toDelete?.id).length;
          return linked > 0
            ? `${linked} ${linked === 1 ? "task is" : "tasks are"} linked to this goal. Those tasks stay, but they will no longer be linked to a goal.`
            : "This cannot be undone.";
        })()}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </>
  );
}
