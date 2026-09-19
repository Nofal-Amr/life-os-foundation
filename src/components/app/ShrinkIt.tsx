import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Scissors } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createStep, taskKeys, type Task } from "@/data/tasks";

/** UI scaffolding to get past a blank field — never stored as data. */
const STARTERS = [
  "Open the file",
  "Write one sentence",
  "Find the phone number",
  "Gather what I need",
  "Send one message",
];

export function ShrinkItDialog({
  task,
  existingSteps,
  open,
  onOpenChange,
}: {
  task: Task | null;
  existingSteps?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState("5");

  const add = useMutation({
    mutationFn: async () => {
      if (!task) return;
      const parsed = Number.parseInt(minutes, 10);
      return createStep({
        parent_task_id: task.id,
        title: title.trim(),
        estimated_minutes: Number.isFinite(parsed) && parsed > 0 ? parsed : null,
        position: 0,
        project_id: task.project_id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      setTitle("");
      setMinutes("5");
      onOpenChange(false);
      toast.success("First step added.");
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Something went wrong."),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setTitle("");
          setMinutes("5");
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>What’s the smallest first step?</DialogTitle>
          <DialogDescription>
            {task ? `For “${task.title}”. ` : ""}
            {existingSteps
              ? `${existingSteps} ${existingSteps === 1 ? "step is" : "steps are"} already saved. Just add the next one.`
              : "One small step is enough. You can add more later."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (title.trim()) add.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="shrink-step">First step</Label>
            <Input
              id="shrink-step"
              autoFocus
              className="h-12 text-base"
              value={title}
              placeholder="e.g. Open the file"
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {STARTERS.map((starter) => (
              <Button
                key={starter}
                type="button"
                size="sm"
                variant="outline"
                className="h-9"
                onClick={() => setTitle(starter)}
              >
                {starter}
              </Button>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="shrink-minutes">Minutes (optional)</Label>
            <Input
              id="shrink-minutes"
              type="number"
              min={1}
              inputMode="numeric"
              className="h-12 w-28 text-base"
              value={minutes}
              onChange={(event) => setMinutes(event.target.value)}
            />
          </div>
          <Button type="submit" className="h-12 w-full" disabled={!title.trim() || add.isPending}>
            {add.isPending ? "Adding…" : "Add this step"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Shared one-tap action used on task rows, task detail and Today. */
export function ShrinkItButton({
  onClick,
  className,
  size = "sm",
}: {
  onClick: () => void;
  className?: string;
  size?: "sm" | "default";
}) {
  return (
    <Button type="button" variant="outline" size={size} className={className} onClick={onClick}>
      <Scissors className="size-4" />
      This feels hard
    </Button>
  );
}
