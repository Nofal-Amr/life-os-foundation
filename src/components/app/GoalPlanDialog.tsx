import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addWeeks, format } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DatePicker } from "@/components/app/DatePicker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Goal } from "@/data/goals";
import { parseSteps, planGoal } from "@/data/goalPlan";
import { createTasks, taskKeys } from "@/data/tasks";
import { formatMinutes } from "@/data/time";
import { usePreferences } from "@/hooks/usePreferences";
import { t } from "@/lib/i18n";
import { toError } from "@/lib/supabase-helpers";

/**
 * Goal → weeks → days: list the steps, and they are spread in order over the
 * weeks until the goal's date, as tasks linked to the goal. When the typed
 * times need more hours a week than you set, it says so and when they would
 * end instead.
 */
export function GoalPlanDialog({
  goal,
  today,
  open,
  onOpenChange,
}: {
  goal: Goal | null;
  today: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { fmtDate } = usePreferences();
  const [text, setText] = useState("");
  const [until, setUntil] = useState("");
  const [hours, setHours] = useState("");

  useEffect(() => {
    if (!open) return;
    setText("");
    setHours("");
    const target = goal?.target_date && goal.target_date >= today ? goal.target_date : null;
    setUntil(target ?? format(addWeeks(new Date(`${today}T00:00:00`), 12), "yyyy-MM-dd"));
  }, [open, goal, today]);

  const steps = useMemo(() => parseSteps(text), [text]);
  const plan = useMemo(
    () =>
      until ? planGoal({ steps, from: today, until, hoursPerWeek: Number(hours) || null }) : null,
    [steps, today, until, hours],
  );

  const save = useMutation({
    mutationFn: async () => {
      if (!goal || !plan) return;
      await createTasks(
        plan.steps.map((step, index) => ({
          title: step.title,
          description: null,
          status: "todo" as const,
          priority: "medium" as const,
          start_date: step.start,
          due_date: step.due,
          project_id: goal.project_id ?? null,
          capability_id: null,
          goal_id: goal.id,
          estimated_minutes: step.minutes,
          estimate_unit: "minutes" as const,
          position: index,
        })),
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.all });
      toast.success(`${t("Added")} ${plan?.steps.length ?? 0} ${t("tasks to the goal")}`);
      onOpenChange(false);
    },
    onError: (error: unknown) => toast.error(toError(error).message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Plan the steps</DialogTitle>
          <DialogDescription>
            {goal
              ? `${goal.name} · ${t("One step per line, in order. A time at the end is its estimate, like “· 45m” or “1h 30m”.")}`
              : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea
            value={text}
            rows={6}
            aria-label={t("Steps")}
            placeholder={"Read chapter 1 · 45m\nPractice set · 1h 30m\nBook the exam"}
            onChange={(event) => setText(event.target.value)}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="plan-until">{t("Spread until")}</Label>
              <DatePicker id="plan-until" value={until} onChange={setUntil} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-hours">{t("Hours a week you have (optional)")}</Label>
              <Input
                id="plan-hours"
                type="number"
                inputMode="decimal"
                min={0}
                step={0.5}
                value={hours}
                onChange={(event) => setHours(event.target.value)}
              />
            </div>
          </div>

          {text.trim() && !plan ? (
            <p className="text-sm text-muted-foreground">
              {t("Choose a date from today on to spread the steps.")}
            </p>
          ) : null}

          {plan ? (
            <section className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {[
                  `${plan.steps.length} ${t("steps")}`,
                  `${plan.weeks.length} ${t(plan.weeks.length === 1 ? "week" : "weeks")}`,
                  plan.totalMinutes ? `${formatMinutes(plan.totalMinutes)} ${t("in all")}` : null,
                  plan.minutesPerWeek != null
                    ? `${t("about")} ${formatMinutes(plan.minutesPerWeek)} ${t("a week")}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {plan.untimed && plan.totalMinutes ? (
                <p className="text-xs text-muted-foreground">
                  {plan.untimed === 1
                    ? t("1 step has no time, so the totals leave it out.")
                    : `${plan.untimed} ${t("steps have no time, so the totals leave them out.")}`}
                </p>
              ) : null}
              {plan.fits === false && plan.endAtBudget ? (
                <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                  <p>
                    {`${t("At")} ${hours} ${t("h a week, these steps would end around")} ${fmtDate(plan.endAtBudget)}.`}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => setUntil(plan.endAtBudget!)}
                  >
                    {`${t("Spread until")} ${fmtDate(plan.endAtBudget)}`}
                  </Button>
                </div>
              ) : null}
              <ol className="max-h-64 space-y-2 overflow-y-auto">
                {plan.weeks.map((week, index) =>
                  week.steps ? (
                    <li key={week.start} className="text-sm">
                      <p className="font-medium">
                        {`${fmtDate(week.start)} – ${fmtDate(week.end)}`}
                        <span className="font-normal text-muted-foreground">
                          {week.minutes ? ` · ${formatMinutes(week.minutes)}` : ""}
                        </span>
                      </p>
                      <ul className="ms-4 list-disc text-muted-foreground">
                        {plan.steps
                          .filter((step) => step.week === index)
                          .map((step, at) => (
                            <li key={`${step.title}-${at}`}>
                              {step.title}
                              {step.minutes ? ` · ${formatMinutes(step.minutes)}` : ""}
                            </li>
                          ))}
                      </ul>
                    </li>
                  ) : null,
                )}
              </ol>
            </section>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" disabled={!plan || save.isPending} onClick={() => save.mutate()}>
            {plan ? `${t("Add")} ${plan.steps.length} ${t("tasks")}` : t("Add tasks")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
