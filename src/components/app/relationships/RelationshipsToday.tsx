import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Cake, Check, MoreHorizontal, Phone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { todaysNudges, type Nudge } from "@/data/relationships";
import { isNudgeSnoozed, logInteraction, snoozeNudge } from "@/data/relationshipsApi";
import { createTask, taskKeys } from "@/data/tasks";
import { useModules } from "@/hooks/useModules";
import { todayISO } from "@/lib/date";
import { toError } from "@/lib/supabase-helpers";

import { useRelationships } from "./useRelationships";
import { t } from "@/lib/i18n";

/**
 * Today's people: a birthday coming up, or a check-in whose rhythm has come
 * round. Three at most, one row each, worded as facts. Nothing when the area is
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
            ? `Congratulate ${t(nudge.person.name)}`
            : `Call ${t(nudge.person.name)}`,
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

  // Three at most, so People never outweighs the rest of Today.
  const shown = nudges.slice(0, 3);
  const more = nudges.length - shown.length;

  return (
    <section className={className} aria-labelledby="today-people">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 id="today-people" className="section-title">
          {t("People")}
        </h2>
        <Link to="/relationships" className="text-xs text-muted-foreground hover:text-foreground">
          {more > 0 ? `${more} more` : "See everyone"}
        </Link>
      </div>
      <ul className="divide-y divide-border/60 rounded-xl border border-border bg-card">
        {shown.map((nudge) => (
          <li key={nudge.key} className="flex min-h-14 items-center gap-3 py-2 pl-3 pr-1">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
              {nudge.kind === "birthday" ? (
                <Cake className="size-4" aria-hidden="true" />
              ) : (
                <Phone className="size-4" aria-hidden="true" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{t(nudge.title)}</p>
              <p className="truncate text-xs text-muted-foreground">{nudge.detail}</p>
            </div>
            {nudge.kind === "checkin" ? (
              <Button
                size="sm"
                variant="ghost"
                className="shrink-0"
                disabled={log.isPending}
                onClick={() => log.mutate(nudge.person.id)}
              >
                <Check className="size-4" aria-hidden="true" />
                {t("Called")}
              </Button>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-11 shrink-0"
                  aria-label={`More for ${t(nudge.person.name)}`}
                >
                  <MoreHorizontal className="size-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled={task.isPending} onSelect={() => task.mutate(nudge)}>
                  Make a task for today
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    snoozeNudge(nudge.key, today);
                    setTick((value) => value + 1);
                  }}
                >
                  Not now
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        ))}
      </ul>
    </section>
  );
}
