import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Minus, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createStep, estimateLabel, taskKeys, type Task } from "@/data/tasks";
import { splitPlan } from "@/data/week";
import { differenceInCalendarDays } from "date-fns";

/**
 * Splits a task due later into dated parts (steps), one per day from `from`
 * to the due date. The estimate is shared evenly between the parts.
 */
export function SplitAcrossDaysDialog({
  task,
  from,
  open,
  onOpenChange,
}: {
  task: Task | null;
  from: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const days = task?.due_date
    ? Math.max(1, differenceInCalendarDays(parseISO(task.due_date), parseISO(from)) + 1)
    : 1;
  const [parts, setParts] = useState(2);

  useEffect(() => {
    if (open) setParts(Math.min(days, Math.max(2, Math.min(3, days))));
  }, [open, days]);

  const plan = useMemo(
    () =>
      task?.due_date
        ? splitPlan({ from, due: task.due_date, parts, estimatedMinutes: task.estimated_minutes })
        : [],
    [task, from, parts],
  );

  const save = useMutation({
    mutationFn: async () => {
      if (!task) return;
      // Sequential, so parts keep their order.
      for (const [index, part] of plan.entries()) {
        await createStep({
          parent_task_id: task.id,
          title: `${task.title} · part ${index + 1} of ${plan.length}`,
          due_date: part.date,
          estimated_minutes: part.minutes,
          position: index,
          project_id: task.project_id,
        });
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.all });
      toast.success(`Split into ${plan.length} parts.`);
      onOpenChange(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Couldn't split it."),
  });

  if (!task) return null;
  const estimate = estimateLabel(task);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Split across days</DialogTitle>
          <DialogDescription>
            {task.title}
            {estimate ? ` · ${estimate}` : ""} is due{" "}
            {task.due_date ? format(parseISO(task.due_date), "EEEE d MMM") : "later"}. Spread it
            over the days before, as parts you can tick off one at a time.
          </DialogDescription>
        </DialogHeader>

        {days < 2 ? (
          <p className="text-sm text-muted-foreground">
            It's due today, so there are no earlier days to spread it over.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-xl bg-secondary px-4 py-3">
              <span className="text-sm font-medium">Parts</span>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  aria-label="Fewer parts"
                  disabled={parts <= 2}
                  onClick={() => setParts((n) => n - 1)}
                >
                  <Minus className="size-4" />
                </Button>
                <span className="w-6 text-center text-lg font-semibold tabular-nums">
                  {plan.length}
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  aria-label="More parts"
                  disabled={parts >= days}
                  onClick={() => setParts((n) => n + 1)}
                >
                  <Plus className="size-4" />
                </Button>
              </div>
            </div>
            <ol className="space-y-1.5">
              {plan.map((part, index) => (
                <li
                  key={part.date}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <span>
                    Part {index + 1}
                    <span className="ml-2 text-muted-foreground">
                      {format(parseISO(part.date), "EEE d MMM")}
                    </span>
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {part.minutes == null
                      ? "no estimate"
                      : part.minutes >= 60
                        ? `${Math.round((part.minutes / 60) * 10) / 10} h`
                        : `${part.minutes} min`}
                  </span>
                </li>
              ))}
            </ol>
          </>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={days < 2 || save.isPending} onClick={() => save.mutate()}>
            Split into {plan.length}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
