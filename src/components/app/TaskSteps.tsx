import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Check, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  completeTask,
  createStep,
  deleteTask,
  reopenTask,
  reorderSteps,
  stepProgress,
  stepsOf,
  taskKeys,
  tasksQuery,
  updateTask,
  type Task,
} from "@/data/tasks";

export function stepsLine(done: number, total: number) {
  return `${done} of ${total} ${total === 1 ? "step" : "steps"} done`;
}

export function minutesLabel(minutes: number | null | undefined) {
  return minutes ? `· ${minutes} min` : "";
}

/** One level deep: steps never get their own steps. */
export function TaskStepsEditor({ parent }: { parent: Task }) {
  const queryClient = useQueryClient();
  const tasks = useQuery(tasksQuery());
  const steps = stepsOf(tasks.data ?? [], parent.id);
  const progress = stepProgress(steps);

  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState("");
  const [toDelete, setToDelete] = useState<Task | null>(null);
  const [askComplete, setAskComplete] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: taskKeys.all });
  const onError = (error: unknown) =>
    toast.error(error instanceof Error ? error.message : "Something went wrong.");

  const add = useMutation({
    mutationFn: () => {
      const parsed = Number.parseInt(minutes, 10);
      return createStep({
        parent_task_id: parent.id,
        title: title.trim(),
        estimated_minutes: Number.isFinite(parsed) && parsed > 0 ? parsed : null,
        position: steps.length,
        project_id: parent.project_id,
      });
    },
    onSuccess: () => {
      invalidate();
      setTitle("");
      setMinutes("");
    },
    onError,
  });

  const rename = useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) =>
      updateTask(id, { title: value }),
    onSuccess: invalidate,
    onError,
  });

  const toggle = useMutation({
    mutationFn: ({ step, completed }: { step: Task; completed: boolean }) =>
      completed ? reopenTask(step.id) : completeTask(step.id),
    onSuccess: (_data, variables) => {
      invalidate();
      const remaining = steps.filter(
        (step) => step.id !== variables.step.id && step.status !== "completed",
      ).length;
      if (!variables.completed && remaining === 0 && parent.status !== "completed") {
        setAskComplete(true);
      }
    },
    onError,
  });

  const move = useMutation({
    mutationFn: ({ index, delta }: { index: number; delta: number }) => {
      const next = [...steps];
      const target = index + delta;
      if (target < 0 || target >= next.length) return Promise.resolve();
      [next[index], next[target]] = [next[target], next[index]];
      return reorderSteps(next);
    },
    onSuccess: invalidate,
    onError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: () => {
      invalidate();
      setToDelete(null);
    },
    onError,
  });

  const completeParent = useMutation({
    mutationFn: () => completeTask(parent.id),
    onSuccess: () => {
      invalidate();
      setAskComplete(false);
      toast.success("Task completed.");
    },
    onError,
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label>Steps</Label>
        {steps.length ? (
          <span className="text-xs text-muted-foreground">
            {stepsLine(progress.done, progress.total)}
          </span>
        ) : null}
      </div>

      {steps.length ? (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {steps.map((step, index) => {
            const completed = step.status === "completed";
            return (
              <li key={step.id} className="flex min-w-0 items-center gap-2 p-2">
                <Button
                  type="button"
                  size="icon"
                  variant={completed ? "secondary" : "outline"}
                  aria-pressed={completed}
                  aria-label={completed ? `Reopen ${step.title}` : `Complete ${step.title}`}
                  className="size-9 shrink-0"
                  onClick={() => toggle.mutate({ step, completed })}
                >
                  <Check className="size-4" />
                </Button>
                <Input
                  aria-label="Step title"
                  defaultValue={step.title}
                  className={`h-9 min-w-0 flex-1 border-0 bg-transparent shadow-none focus-visible:bg-background ${completed ? "text-muted-foreground line-through" : ""}`}
                  onBlur={(event) => {
                    const value = event.target.value.trim();
                    if (value && value !== step.title) rename.mutate({ id: step.id, value });
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                  }}
                />
                {step.estimated_minutes ? (
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {minutesLabel(step.estimated_minutes)}
                  </span>
                ) : null}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Move step up"
                  className="size-9 shrink-0"
                  disabled={index === 0}
                  onClick={() => move.mutate({ index, delta: -1 })}
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Move step down"
                  className="size-9 shrink-0"
                  disabled={index === steps.length - 1}
                  onClick={() => move.mutate({ index, delta: 1 })}
                >
                  <ArrowDown className="size-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Delete step"
                  className="size-9 shrink-0"
                  onClick={() => setToDelete(step)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No steps yet. Add one when it helps.</p>
      )}

      <div className="flex gap-2">
        <Input
          aria-label="New step title"
          placeholder="Add a step and press Enter"
          value={title}
          className="h-10 min-w-0 flex-1"
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (title.trim()) add.mutate();
            }
          }}
        />
        <Input
          aria-label="Step minutes"
          type="number"
          min={1}
          inputMode="numeric"
          placeholder="min"
          value={minutes}
          className="h-10 w-20 shrink-0"
          onChange={(event) => setMinutes(event.target.value)}
        />
        <Button
          type="button"
          className="h-10 shrink-0"
          disabled={!title.trim() || add.isPending}
          onClick={() => add.mutate()}
        >
          Add
        </Button>
      </div>

      <ConfirmDialog
        open={askComplete}
        onOpenChange={setAskComplete}
        title="Every step is done"
        description="Do you want to mark the task itself complete? It stays open if you don’t."
        confirmLabel="Mark task complete"
        onConfirm={() => completeParent.mutate()}
      />

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete this step?"
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </div>
  );
}
