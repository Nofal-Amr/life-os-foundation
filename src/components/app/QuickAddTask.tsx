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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createTask, splitTaskLines, taskKeys } from "@/data/tasks";

/**
 * One-step task capture: a title is the only thing required, and a list can go
 * in at once — one task per line, so ten things don't need ten trips.
 */
export function QuickAddTaskDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const titles = splitTaskLines(text);

  const add = useMutation({
    mutationFn: async (values: string[]) => {
      for (const value of values) {
        await createTask({
          title: value,
          description: null,
          status: "inbox",
          priority: "medium",
          due_date: null,
          project_id: null,
          capability_id: null,
          goal_id: null,
        });
      }
      return values.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      setText("");
      onOpenChange(false);
      toast.success(count === 1 ? "Task added." : `${count} tasks added.`);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Something went wrong."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Quick add task</DialogTitle>
          <DialogDescription>
            Just a title. Put each task on its own line to add several at once.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (titles.length) add.mutate(titles);
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="quick-task-title">What needs doing?</Label>
            <Textarea
              id="quick-task-title"
              autoFocus
              rows={3}
              className="min-h-24 text-base"
              value={text}
              placeholder={"e.g. Book the dentist\nPay the electricity bill"}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                // Enter adds; Shift+Enter starts the next task on a new line.
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  if (titles.length) add.mutate(titles);
                }
              }}
            />
            {titles.length > 1 ? (
              <p className="text-xs text-muted-foreground">
                {titles.length} tasks, one per line. They go to your inbox.
              </p>
            ) : null}
          </div>
          <Button type="submit" className="h-12 w-full" disabled={!titles.length || add.isPending}>
            {add.isPending
              ? "Adding…"
              : titles.length > 1
                ? `Add ${titles.length} tasks`
                : "Add task"}
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
          "fixed bottom-24 right-[max(1.25rem,env(safe-area-inset-right))] z-40 size-14 rounded-full shadow-lg md:bottom-8 md:right-8"
        }
        onClick={() => setOpen(true)}
      >
        <Plus className="size-6" />
      </Button>
      <QuickAddTaskDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
