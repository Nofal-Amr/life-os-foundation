import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, Hourglass, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DatePicker } from "@/components/app/DatePicker";
import { ShrinkItDialog } from "@/components/app/ShrinkIt";
import { useTimer } from "@/components/app/Timer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePreferences } from "@/hooks/usePreferences";
import { stuckDetail, type StuckTask } from "@/data/stuck";
import { createStep, taskKeys, updateTask, type Task } from "@/data/tasks";
import { writeFocus } from "@/lib/focus";
import { t } from "@/lib/i18n";
import { toError } from "@/lib/supabase-helpers";
import { cn } from "@/lib/utils";

/**
 * What usually keeps a task stuck, each answered with one concrete move.
 * After How to ADHD's "Wall of Awful": the block is often a feeling about the
 * task, not the task itself, so the first question is what makes it hard.
 */
type Block = "unclear" | "boring" | "dread" | "waiting" | "energy" | "pointless";

const BLOCKS: { value: Block; label: string }[] = [
  { value: "unclear", label: "I don't know where to start" },
  { value: "dread", label: "I'm dreading it" },
  { value: "boring", label: "It's boring" },
  { value: "energy", label: "No energy for it now" },
  { value: "waiting", label: "I'm waiting on someone" },
  { value: "pointless", label: "It doesn't matter any more" },
];

/** Today: one task that's been waiting a while, with a way in. */
export function StuckCard({ item, onSnooze }: { item: StuckTask; onSnooze: () => void }) {
  const [open, setOpen] = useState(false);
  const { skin } = usePreferences();
  const rpg = skin === "rpg";
  return (
    <section className="min-w-0 rounded-xl border border-border bg-card p-4">
      <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Hourglass className="size-3.5" aria-hidden="true" />
        {rpg ? t("A boss has been waiting") : t("This one has been waiting")}
        <span className="tabular-nums">
          · {item.days} {t("days")} ·{" "}
          {item.reason === "postponed"
            ? `${t("Moved")} ${item.task.postponed_count ?? 0} ${t("times")}`
            : t(stuckDetail(item))}
        </span>
      </p>
      <p className="mt-1.5 text-base font-semibold text-foreground">{item.task.title}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("Tasks that wait get heavier to face. That's normal, not a flaw. Let's find a way in.")}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" onClick={() => setOpen(true)}>
          Help me start
        </Button>
        <Button type="button" variant="ghost" onClick={onSnooze}>
          Not today
        </Button>
      </div>
      <StuckHelperDialog task={item.task} open={open} onOpenChange={setOpen} />
    </section>
  );
}

/** "What makes it hard?" and then one thing to do about it. */
export function StuckHelperDialog({
  task,
  existingSteps,
  open,
  onOpenChange,
}: {
  task: Task | null;
  /** Steps it already has, so naming a step says "just add the next one". */
  existingSteps?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { start } = useTimer();
  const [block, setBlock] = useState<Block | null>(null);
  const [shrinking, setShrinking] = useState(false);
  const [day, setDay] = useState<string | null>(null);

  const close = () => {
    setBlock(null);
    setDay(null);
    onOpenChange(false);
  };

  const sprint = (minutes: number) => {
    if (!task) return;
    writeFocus({ startedAt: Date.now(), minutes });
    start.mutate({ activity_id: null, task_id: task.id, label: task.title });
    toast.success(`${minutes} ${t("minutes on it. Stopping after that is fine.")}`);
    close();
  };

  const change = useMutation({
    mutationFn: async (patch: { status?: Task["status"]; due_date?: string; step?: string }) => {
      if (!task) return;
      if (patch.step) {
        await createStep({
          parent_task_id: task.id,
          title: patch.step,
          estimated_minutes: 5,
          position: 0,
          project_id: task.project_id,
        });
      }
      const { step: _step, ...rest } = patch;
      if (Object.keys(rest).length) await updateTask(task.id, rest, task);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.all });
      toast.success(t("Saved"));
      close();
    },
    onError: (error: unknown) => toast.error(toError(error).message),
  });

  return (
    <>
      <Dialog
        open={open && !shrinking}
        onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{block ? "Here's a way in" : "What makes it hard?"}</DialogTitle>
            <DialogDescription>{task ? `“${task.title}”` : ""}</DialogDescription>
          </DialogHeader>

          {!block ? (
            <div className="grid gap-2">
              {BLOCKS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant="outline"
                  className="h-auto min-h-12 justify-start whitespace-normal py-3 text-start"
                  onClick={() => setBlock(option.value)}
                >
                  {option.label}
                </Button>
              ))}
              <p className="pt-1 text-xs text-muted-foreground">
                {t("Pick the closest one. There's no wrong answer.")}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <Way block={block} />

              {block === "unclear" ? (
                <Button type="button" className="h-12 w-full" onClick={() => setShrinking(true)}>
                  Name the first tiny step
                </Button>
              ) : null}

              {block === "dread" ? (
                <div className="grid gap-2">
                  <Button type="button" className="h-12 w-full" onClick={() => sprint(5)}>
                    Start for 5 minutes
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShrinking(true)}>
                    Name the first tiny step
                  </Button>
                </div>
              ) : null}

              {block === "boring" ? (
                <div className="grid gap-2">
                  <Button type="button" className="h-12 w-full" onClick={() => sprint(10)}>
                    Start a 10-minute sprint
                  </Button>
                  <Button type="button" variant="outline" asChild>
                    <Link to="/together" onClick={close}>
                      <Users className="size-4" /> {t("Do it alongside someone")}
                    </Link>
                  </Button>
                </div>
              ) : null}

              {block === "energy" ? (
                <div className="space-y-2">
                  <DatePicker
                    value={day}
                    onChange={setDay}
                    placeholder={t("Pick a day with more energy")}
                  />
                  <Button
                    type="button"
                    className="h-12 w-full"
                    disabled={!day || change.isPending}
                    onClick={() => day && change.mutate({ due_date: day })}
                  >
                    <CalendarDays className="size-4" /> {t("Give it that day")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => sprint(5)}
                  >
                    Or just 5 minutes now
                  </Button>
                </div>
              ) : null}

              {block === "waiting" ? (
                <div className="grid gap-2">
                  <Button
                    type="button"
                    className="h-12 w-full"
                    disabled={change.isPending}
                    onClick={() => change.mutate({ step: t("Send one message to move it on") })}
                  >
                    Add “send one message” as the next step
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={change.isPending}
                    onClick={() => change.mutate({ status: "waiting" })}
                  >
                    Mark it as waiting
                  </Button>
                </div>
              ) : null}

              {block === "pointless" ? (
                <Button
                  type="button"
                  className="h-12 w-full"
                  disabled={change.isPending}
                  onClick={() => change.mutate({ status: "cancelled" })}
                >
                  Let it go
                </Button>
              ) : null}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn("text-muted-foreground")}
                onClick={() => setBlock(null)}
              >
                <ArrowLeft className="size-4 rtl:rotate-180" /> {t("Something else")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <ShrinkItDialog
        task={task}
        {...(existingSteps != null ? { existingSteps } : {})}
        open={shrinking}
        onOpenChange={(next) => {
          setShrinking(next);
          if (!next) close();
        }}
      />
    </>
  );
}

/** A line or two for each block, in the app's own words. */
function Way({ block }: { block: Block }) {
  const text: Record<Block, string> = {
    unclear:
      "When the start is fuzzy, the whole task feels impossible. Make the first step so small it's almost silly: open the file, find the email.",
    dread:
      "The longer a task waits, the higher the wall around it gets. You don't have to climb it all today: start for five minutes, and stopping after that still counts.",
    boring:
      "A bored brain needs something to make it interesting: a short sprint against the clock, music on, or someone working beside you (body doubling).",
    energy:
      "Some tasks need a better day. Give it a real day instead of “later”, or do five easy minutes now so it's started.",
    waiting: "If it's stuck on someone else, the next step is one message, not the whole task.",
    pointless:
      "Plans change. Letting a task go is a decision too, and it frees the space it was taking.",
  };
  return <p className="text-sm text-muted-foreground">{t(text[block])}</p>;
}
