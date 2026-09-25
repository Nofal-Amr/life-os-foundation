import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addHours, format } from "date-fns";
import { useEffect, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  REPEAT_OPTIONS,
  createReminder,
  updateReminder,
  userReminderKeys,
  type ReminderRepeat,
  type UserReminder,
} from "@/data/userReminders";
import { isAndroidApp } from "@/lib/native";
import { toError } from "@/lib/supabase-helpers";
import { cn } from "@/lib/utils";

/** The next whole hour, as a sensible default. */
function nextHour() {
  const at = addHours(new Date(), 1);
  at.setMinutes(0, 0, 0);
  return at;
}

/** Add or edit a reminder: what, when, and whether it repeats. */
export function ReminderDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: UserReminder | null;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [repeat, setRepeat] = useState<ReminderRepeat>("none");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    const at = editing ? new Date(editing.remind_at) : nextHour();
    setTitle(editing?.title ?? "");
    setDate(format(at, "yyyy-MM-dd"));
    setTime(format(at, "HH:mm"));
    setRepeat((editing?.repeat as ReminderRepeat) ?? "none");
    setNote(editing?.note ?? "");
  }, [open, editing]);

  const save = useMutation({
    mutationFn: () => {
      const remind_at = new Date(`${date}T${time || "09:00"}`).toISOString();
      const input = { title: title.trim(), note: note.trim() || null, remind_at, repeat };
      return editing
        ? updateReminder(editing.id, { ...input, done_at: null })
        : createReminder(input);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userReminderKeys.all });
      toast.success(editing ? "Reminder updated." : "Reminder set.", {
        description: isAndroidApp()
          ? "Your phone will ring for it."
          : "The Android app rings for it; here it shows on Today.",
      });
      onOpenChange(false);
    },
    onError: (error) => toast.error(toError(error).message),
  });

  const ready = title.trim().length > 0 && !!date;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit reminder" : "Remind me"}</DialogTitle>
          <DialogDescription>
            For anything that isn't a task. It rings at the time.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (ready) save.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="reminder-title">What</Label>
            <Input
              id="reminder-title"
              autoFocus
              className="h-12 text-base"
              value={title}
              placeholder="e.g. Call the bank"
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-3">
            <div className="space-y-2">
              <Label htmlFor="reminder-date">Day</Label>
              <Input
                id="reminder-date"
                type="date"
                className="h-12"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reminder-time">Time</Label>
              <Input
                id="reminder-time"
                type="time"
                className="h-12 tabular-nums"
                value={time}
                onChange={(event) => setTime(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Repeat</Label>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Repeat">
              {REPEAT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={repeat === option.value}
                  onClick={() => setRepeat(option.value)}
                  className={cn(
                    "min-h-9 rounded-full border px-3 text-sm transition-colors",
                    repeat === option.value
                      ? "border-transparent bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:bg-accent",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reminder-note">Note</Label>
            <Textarea
              id="reminder-note"
              rows={2}
              value={note}
              placeholder="Optional"
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          <Button type="submit" className="h-12 w-full" disabled={!ready || save.isPending}>
            {save.isPending ? "Saving…" : editing ? "Save" : "Set reminder"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
