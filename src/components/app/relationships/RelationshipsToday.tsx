import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Cake, Phone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { todaysNudges, type Nudge } from "@/data/relationships";
import { isNudgeSnoozed, logInteraction, snoozeNudge } from "@/data/relationshipsApi";
import { createTask, taskKeys } from "@/data/tasks";
import { useModules } from "@/hooks/useModules";
import { todayISO } from "@/lib/date";
import { toError } from "@/lib/supabase-helpers";

import { useRelationships } from "./useRelationships";

/**
 * Today's people: a birthday coming up, or a check-in whose rhythm has come
 * round. At most three check-ins, worded as facts. Nothing when the area is
 * off or there's nothing to show.
 */
export function RelationshipsToday({ className }: { className?: string }) {
  const { isEnabled } = useModules();
  const on = isEnabled("relationships");
  const data = useRelationships(on);
  const today = todayISO();
  const [, setTick] = useState(0);
  const queryClient = useQueryClient();

  const log = useMutation({
    mutationFn: (person_id: string) =>
      logInteraction({ person_id, kind: "call", occurred_on: today }),
    onSuccess: () => void data.refresh(),
    onError: (error) => toast.error(toError(error).message),
  });
  const task = useMutation({
    mutationFn: (nudge: Nudge) =>
      createTask({
        title:
          nudge.kind === "birthday"
            ? `Congratulate ${nudge.person.name}`
            : `Call ${nudge.person.name}`,
        description: null,
        due_date: today,
        status: "todo",
        priority: "medium",
        project_id: null,
        capability_id: null,
        goal_id: null,
      }),
    onSuccess: (_, nudge) => {
      snoozeNudge(nudge.key, today);
      setTick((value) => value + 1);
      void queryClient.invalidateQueries({ queryKey: taskKeys.all });
      toast.success("Added to today's tasks.");
    },
    onError: (error) => toast.error(toError(error).message),
  });

  if (!on || data.isLoading || data.needsSetup || data.error) return null;
  const nudges = todaysNudges({
    people: data.people,
    interactions: data.interactions,
    rules: data.rules,
    today,
    snoozed: (key) => isNudgeSnoozed(key, today),
  });
  if (!nudges.length) return null;

  return (
    <section className={className} aria-labelledby="today-people">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 id="today-people" className="section-title">
          People
        </h2>
        <Link to="/relationships" className="text-xs text-muted-foreground hover:text-foreground">
          See everyone
        </Link>
      </div>
      <ul className="space-y-2">
        {nudges.map((nudge) => (
          <li key={nudge.key} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-start gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                {nudge.kind === "birthday" ? (
                  <Cake className="size-4" aria-hidden="true" />
                ) : (
                  <Phone className="size-4" aria-hidden="true" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{nudge.title}</p>
                <p className="text-sm text-muted-foreground">{nudge.detail}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {nudge.kind === "checkin" ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={log.isPending}
                      onClick={() => log.mutate(nudge.person.id)}
                    >
                      Logged a call
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={task.isPending}
                    onClick={() => task.mutate(nudge)}
                  >
                    Make a task
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      snoozeNudge(nudge.key, today);
                      setTick((value) => value + 1);
                    }}
                  >
                    Not now
                  </Button>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
