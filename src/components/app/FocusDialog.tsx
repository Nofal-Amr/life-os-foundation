import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useTimer } from "@/components/app/Timer";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { habitsQuery } from "@/data/habits";
import { FOCUS_PRESETS, writeFocus } from "@/lib/focus";
import { cn } from "@/lib/utils";

/**
 * Start a focus session: a length, what it's for, and optionally a habit
 * that gets ticked when it's done. The minutes are logged like any timer.
 */
export function FocusDialog({
  open,
  onOpenChange,
  task,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Focus on this task (its time is logged against it). */
  task?: { id: string; title: string } | null;
}) {
  const { start } = useTimer();
  const habits = useQuery(habitsQuery());
  const [minutes, setMinutes] = useState<number>(25);
  const [custom, setCustom] = useState("");
  const [label, setLabel] = useState("");
  const [habitId, setHabitId] = useState("none");

  useEffect(() => {
    if (!open) return;
    setMinutes(25);
    setCustom("");
    setLabel(task?.title ?? "");
    setHabitId("none");
  }, [open, task]);

  const length = custom ? Number(custom) : minutes;
  const ready = Number.isFinite(length) && length >= 1 && length <= 240;
  const activeHabits = (habits.data ?? []).filter((habit) => habit.active);

  const begin = () => {
    const habit = activeHabits.find((item) => item.id === habitId) ?? null;
    writeFocus({
      startedAt: Date.now(),
      minutes: length,
      habitId: habit?.id ?? null,
      habitName: habit?.name ?? null,
    });
    start.mutate({
      activity_id: null,
      task_id: task?.id ?? null,
      label: label.trim() || task?.title || "Focus",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Focus</DialogTitle>
          <DialogDescription>
            One thing, for a set time. You'll hear a soft chime when it's done.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (ready) begin();
          }}
        >
          <div className="space-y-2">
            <Label>How long</Label>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Minutes">
              {FOCUS_PRESETS.map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={!custom && minutes === value}
                  onClick={() => {
                    setMinutes(value);
                    setCustom("");
                  }}
                  className={cn(
                    "min-h-10 rounded-full border px-4 text-sm tabular-nums transition-colors",
                    !custom && minutes === value
                      ? "border-transparent bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:bg-accent",
                  )}
                >
                  {value} min
                </button>
              ))}
              <Input
                aria-label="Other length in minutes"
                inputMode="numeric"
                placeholder="Other"
                className="h-10 w-24 rounded-full tabular-nums"
                value={custom}
                onChange={(event) => setCustom(event.target.value.replace(/[^0-9]/g, ""))}
              />
            </div>
          </div>
          {!task ? (
            <div className="space-y-2">
              <Label htmlFor="focus-label">On what</Label>
              <Input
                id="focus-label"
                className="h-12"
                placeholder="e.g. Revise chapter 3"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
              />
            </div>
          ) : (
            <p className="text-sm">
              <span className="text-muted-foreground">On: </span>
              {task.title}
            </p>
          )}
          {activeHabits.length ? (
            <div className="space-y-2">
              <Label>Tick a habit when done</Label>
              <Select value={habitId} onValueChange={setHabitId}>
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No habit</SelectItem>
                  {activeHabits.map((habit) => (
                    <SelectItem key={habit.id} value={habit.id}>
                      {habit.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <Button type="submit" className="h-12 w-full" disabled={!ready || start.isPending}>
            Start {ready ? `${length} min` : ""}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
