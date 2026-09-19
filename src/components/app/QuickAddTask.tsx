import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
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
import { createTask, taskKeys } from "@/data/tasks";

/** One-step task capture: a title is the only thing required. */
export function QuickAddTaskDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");

  const add = useMutation({
    mutationFn: (value: string) =>
      createTask({
        title: value,
        description: null,
        status: "inbox",
        priority: "medium",
        due_date: null,
        project_id: null,
        capability_id: null,
        goal_id: null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      setTitle("");
      onOpenChange(false);
      toast.success("Task added.");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Something went wrong."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Quick add task</DialogTitle>
          <DialogDescription>Just a title. You can fill in the rest later.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (title.trim()) add.mutate(title.trim());
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="quick-task-title">What needs doing?</Label>
            <Input
              id="quick-task-title"
              autoFocus
              className="h-12 text-base"
              value={title}
              placeholder="e.g. Book the dentist"
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <Button type="submit" className="h-12 w-full" disabled={!title.trim() || add.isPending}>
            {add.isPending ? "Adding…" : "Add task"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Persistent floating quick-add control. */
export function QuickAddTaskButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        aria-label="Quick add task"
        title="Quick add task"
        className={
          className ??
          "fixed bottom-24 right-5 z-40 size-14 rounded-full shadow-lg md:bottom-8 md:right-8"
        }
        onClick={() => setOpen(true)}
      >
        <Plus className="size-6" />
      </Button>
      <QuickAddTaskDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
