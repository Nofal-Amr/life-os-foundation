import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { EntityIcon } from "@/components/app/EntityIdentity";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PLANS, planTasks, startPlan, type Plan } from "@/data/plans";
import { projectKeys } from "@/data/projects";
import { taskKeys } from "@/data/tasks";
import { toError } from "@/lib/supabase-helpers";
import { cn } from "@/lib/utils";

/**
 * Pick a ready-made plan: it becomes a project with its tasks spread over
 * the days from today. Everything can be changed afterwards.
 */
export function PlansDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [picked, setPicked] = useState<Plan | null>(null);

  const start = useMutation({
    mutationFn: (plan: Plan) => startPlan(plan),
    onSuccess: ({ tasks }, plan) => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.all });
      void queryClient.invalidateQueries({ queryKey: taskKeys.all });
      toast.success(`"${plan.name}" started: ${tasks} tasks from today.`);
      setPicked(null);
      onOpenChange(false);
    },
    onError: (error) => toast.error(toError(error).message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setPicked(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Start from a plan</DialogTitle>
          <DialogDescription>
            A project with its tasks spread over the days from today. Move, change or delete any of
            them after.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2">
          {PLANS.map((plan) => {
            const isPicked = picked?.id === plan.id;
            const tasks = isPicked ? planTasks(plan, new Date()) : [];
            return (
              <li key={plan.id}>
                <button
                  type="button"
                  onClick={() => setPicked(isPicked ? null : plan)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                    isPicked ? "border-primary bg-primary/10" : "border-border hover:bg-accent",
                  )}
                >
                  <EntityIcon icon={plan.icon} color={null} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{plan.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {plan.summary} {plan.steps.length} tasks over {plan.days} days.
                    </span>
                  </span>
                </button>
                {isPicked ? (
                  <div className="mt-2 space-y-2 rounded-xl bg-secondary/60 p-3">
                    <ul className="max-h-40 space-y-0.5 overflow-y-auto text-xs text-muted-foreground">
                      {tasks.slice(0, 12).map((task, index) => (
                        <li key={`${task.due}-${index}`}>
                          {task.due.slice(5)} · {task.title}
                        </li>
                      ))}
                      {tasks.length > 12 ? <li>…and {tasks.length - 12} more</li> : null}
                    </ul>
                    <Button
                      className="h-11 w-full"
                      disabled={start.isPending}
                      onClick={() => start.mutate(plan)}
                    >
                      {start.isPending ? "Starting…" : "Start this plan"}
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
