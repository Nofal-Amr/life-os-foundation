import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { DateTimePicker } from "@/components/app/DatePicker";
import { FormDialog } from "@/components/app/FormDialog";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createEvent,
  deleteEvent,
  eventKeys,
  eventsQuery,
  updateEvent,
  type CalendarEvent,
  type EventInput,
} from "@/data/events";
import { isoToLocalInput, localInputToISO } from "@/lib/date";
import { usePreferences } from "@/hooks/usePreferences";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar — Life OS" },
      { name: "description", content: "A simple month view of your own events." },
      { property: "og:title", content: "Calendar — Life OS" },
      { property: "og:description", content: "A simple month view of your own events." },
    ],
  }),
  component: CalendarPage,
});

type FormState = { title: string; description: string | null; start: string; end: string };

const emptyForm: FormState = { title: "", description: null, start: "", end: "" };

function CalendarPage() {
  const queryClient = useQueryClient();
  const { fmtDateTime } = usePreferences();
  const events = useQuery(eventsQuery());
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<Date>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [toDelete, setToDelete] = useState<CalendarEvent | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: eventKeys.all });
  const onError = (e: unknown) =>
    toast.error(e instanceof Error ? e.message : "Something went wrong.");

  const save = useMutation({
    mutationFn: async () => {
      const payload: EventInput = {
        title: form.title,
        description: form.description,
        start_at: localInputToISO(form.start),
        end_at: form.end ? localInputToISO(form.end) : null,
      };
      return editing ? updateEvent(editing.id, payload) : createEvent(payload);
    },
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      toast.success(editing ? "Event updated." : "Event created.");
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteEvent(id),
    onSuccess: () => {
      invalidate();
      setToDelete(null);
      toast.success("Event deleted.");
    },
    onError,
  });

  function openCreate(day: Date) {
    setEditing(null);
    const start = new Date(day);
    start.setHours(9, 0, 0, 0);
    setForm({ ...emptyForm, start: isoToLocalInput(start.toISOString()) });
    setDialogOpen(true);
  }

  function openEdit(event: CalendarEvent) {
    setEditing(event);
    setForm({
      title: event.title,
      description: event.description,
      start: isoToLocalInput(event.start_at),
      end: isoToLocalInput(event.end_at),
    });
    setDialogOpen(true);
  }

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });

  const all = events.data ?? [];
  const eventsOn = (day: Date) => all.filter((e) => isSameDay(new Date(e.start_at), day));
  const selectedEvents = eventsOn(selected);

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Your own events, nothing synced from elsewhere."
        actions={<Button onClick={() => openCreate(selected)}>New event</Button>}
      />

      {events.isLoading ? (
        <LoadingState rows={4} />
      ) : events.error ? (
        <ErrorState error={events.error} onRetry={() => events.refetch()} />
      ) : (
        <div className="space-y-8">
          <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Previous month"
                onClick={() => setMonth(subMonths(month, 1))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <p className="text-sm font-medium">{format(month, "MMMM yyyy")}</p>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Next month"
                onClick={() => setMonth(addMonths(month, 1))}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] uppercase tracking-wide text-muted-foreground">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((day) => {
                const dayEvents = eventsOn(day);
                const isSelected = isSameDay(day, selected);
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => setSelected(day)}
                    className={`flex min-h-16 flex-col items-start rounded-lg border p-1.5 text-left text-xs transition-colors ${
                      isSelected
                        ? "border-primary bg-accent"
                        : "border-transparent hover:bg-accent/60"
                    } ${isSameMonth(day, month) ? "" : "opacity-40"}`}
                  >
                    <span className="tabular-nums">{format(day, "d")}</span>
                    {dayEvents.slice(0, 2).map((e) => (
                      <span key={e.id} className="mt-1 w-full truncate text-primary">
                        {e.title}
                      </span>
                    ))}
                    {dayEvents.length > 2 ? (
                      <span className="mt-0.5 text-muted-foreground">
                        +{dayEvents.length - 2}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <section>
            <h2 className="mb-3 text-sm font-medium">{format(selected, "EEEE, d MMMM yyyy")}</h2>
            {selectedEvents.length === 0 ? (
              <EmptyState
                title="No events on this day"
                action={<Button onClick={() => openCreate(selected)}>New event</Button>}
              />
            ) : (
              <ul className="space-y-3">
                {selectedEvents.map((event) => (
                  <li key={event.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{event.title}</p>
                        {event.description ? (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {event.description}
                          </p>
                        ) : null}
                        <p className="mt-2 text-xs text-muted-foreground">
                          {fmtDateTime(event.start_at)}
                          {event.end_at ? ` → ${fmtDateTime(event.end_at)}` : ""}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(event)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setToDelete(event)}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? "Edit event" : "New event"}
        pending={save.isPending}
        onSubmit={() => save.mutate()}
      >
        <div className="space-y-2">
          <Label htmlFor="event-title">Title</Label>
          <Input
            id="event-title"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="event-description">Description</Label>
          <Textarea
            id="event-description"
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.target.value || null })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="event-start">Starts</Label>
             <DateTimePicker id="event-start" required value={form.start} onChange={(value) => setForm({ ...form, start: value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="event-end">Ends</Label>
             <DateTimePicker id="event-end" value={form.end} onChange={(value) => setForm({ ...form, end: value })} />
          </div>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete this event?"
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </>
  );
}
