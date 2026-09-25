import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { addDays, addHours, format, isToday, isTomorrow } from "date-fns";
import { Bell, Repeat } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { PageHeader } from "@/components/app/PageHeader";
import { ReminderDialog } from "@/components/app/ReminderDialog";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/States";
import { Button } from "@/components/ui/button";
import {
  REPEAT_OPTIONS,
  deleteReminder,
  updateReminder,
  upcomingTimes,
  userReminderKeys,
  userRemindersQuery,
  type UserReminder,
} from "@/data/userReminders";
import { usePreferences } from "@/hooks/usePreferences";
import { toError } from "@/lib/supabase-helpers";

export const Route = createFileRoute("/_authenticated/reminders")({
  head: () => ({
    meta: [
      { title: "Reminders · Life OS" },
      { name: "description", content: "Reminders for anything that isn't a task." },
    ],
  }),
  component: RemindersPage,
});

function RemindersPage() {
  const queryClient = useQueryClient();
  const reminders = useQuery(userRemindersQuery());
  const { fmtTime } = usePreferences();
  const [dialog, setDialog] = useState<{ open: boolean; editing: UserReminder | null }>({
    open: false,
    editing: null,
  });
  const [toDelete, setToDelete] = useState<UserReminder | null>(null);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: userReminderKeys.all });
  const patch = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateReminder>[1] }) =>
      updateReminder(id, input),
    onSuccess: refresh,
    onError: (error) => toast.error(toError(error).message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteReminder(id),
    onSuccess: () => {
      refresh();
      setToDelete(null);
      toast.success("Reminder deleted.");
    },
    onError: (error) => toast.error(toError(error).message),
  });

  const now = new Date();
  const withNext = (reminders.data ?? []).map((reminder) => ({
    reminder,
    next: upcomingTimes(reminder, now, 1)[0] ?? null,
  }));
  const upcoming = withNext
    .filter((item) => item.next)
    .sort((a, b) => a.next!.getTime() - b.next!.getTime());
  const earlier = withNext.filter((item) => !item.next);

  const when = (date: Date) =>
    `${isToday(date) ? "Today" : isTomorrow(date) ? "Tomorrow" : format(date, "EEE d MMM")} · ${fmtTime(date)}`;

  return (
    <>
      <PageHeader
        title="Reminders"
        description="For anything that isn't a task. The Android app rings at the time."
        actions={
          <Button onClick={() => setDialog({ open: true, editing: null })}>New reminder</Button>
        }
      />

      {reminders.isLoading ? (
        <LoadingState rows={3} />
      ) : reminders.error ? (
        <ErrorState error={reminders.error} onRetry={() => reminders.refetch()} />
      ) : !withNext.length ? (
        <EmptyState
          title="No reminders yet"
          description="Set one for a call, a bill, the bins on Thursday. Repeating ones keep a single entry."
          action={
            <Button onClick={() => setDialog({ open: true, editing: null })}>New reminder</Button>
          }
        />
      ) : (
        <div className="space-y-8">
          <section className="space-y-3">
            <h2 className="section-title">Coming up</h2>
            {upcoming.length ? (
              <ul className="space-y-2">
                {upcoming.map(({ reminder, next }) => {
                  const repeats = reminder.repeat !== "none";
                  return (
                    <li key={reminder.id} className="rounded-xl border border-border bg-card p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 gap-3">
                          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                            {repeats ? <Repeat className="size-4" /> : <Bell className="size-4" />}
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium">{reminder.title}</p>
                            <p className="mt-0.5 text-sm tabular-nums text-muted-foreground">
                              {when(next!)}
                              {repeats
                                ? ` · ${REPEAT_OPTIONS.find((o) => o.value === reminder.repeat)?.label}`
                                : ""}
                            </p>
                            {reminder.note ? (
                              <p className="mt-1 text-sm text-muted-foreground">{reminder.note}</p>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              patch.mutate({
                                id: reminder.id,
                                // For a repeat, done means done for this time only.
                                input: { done_at: (repeats ? next! : new Date()).toISOString() },
                              })
                            }
                          >
                            {repeats ? "Skip this one" : "Done"}
                          </Button>
                          {!repeats ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                patch.mutate({
                                  id: reminder.id,
                                  input: { remind_at: addHours(new Date(), 1).toISOString() },
                                })
                              }
                            >
                              In an hour
                            </Button>
                          ) : null}
                          {!repeats ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                patch.mutate({
                                  id: reminder.id,
                                  input: { remind_at: addDays(next!, 1).toISOString() },
                                })
                              }
                            >
                              Tomorrow
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDialog({ open: true, editing: reminder })}
                          >
                            Edit
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setToDelete(reminder)}>
                            Delete
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nothing coming up.</p>
            )}
          </section>

          {earlier.length ? (
            <section className="space-y-3">
              <h2 className="section-title">Done or past</h2>
              <ul className="divide-y divide-border rounded-xl border border-border">
                {earlier.map(({ reminder }) => (
                  <li
                    key={reminder.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                  >
                    <span className="min-w-0 truncate text-muted-foreground">
                      {reminder.title} · {format(new Date(reminder.remind_at), "d MMM")}
                    </span>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDialog({ open: true, editing: reminder })}
                      >
                        Set again
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setToDelete(reminder)}>
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}

      <ReminderDialog
        open={dialog.open}
        editing={dialog.editing}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
      />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete this reminder?"
        description="It won't ring again."
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </>
  );
}
