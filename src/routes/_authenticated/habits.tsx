import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { EntityIcon, EntityIdentityPicker } from "@/components/app/EntityIdentity";
import { FormDialog } from "@/components/app/FormDialog";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { HABIT_FREQUENCIES, labelOf } from "@/data/enums";
import {
  archiveHabit,
  createHabit,
  deleteHabit,
  habitKeys,
  habitLogsQuery,
  habitsQuery,
  logHabit,
  unlogHabit,
  updateHabit,
  type Habit,
  type HabitInput,
} from "@/data/habits";
import { todayISO } from "@/lib/date";
import { usePreferences } from "@/hooks/usePreferences";

export const Route = createFileRoute("/_authenticated/habits")({
  head: () => ({
    meta: [
      { title: "Habits · Life OS" },
      { name: "description", content: "Track daily and weekly habits at your own pace." },
      { property: "og:title", content: "Habits · Life OS" },
      {
        property: "og:description",
        content: "Track daily and weekly habits at your own pace.",
      },
    ],
  }),
  component: HabitsPage,
});

const emptyForm: HabitInput = {
  name: "",
  description: null,
  frequency: "daily",
  target: 1,
  active: true,
  icon: null,
  color: null,
};

function HabitsPage() {
  const queryClient = useQueryClient();
  const { fmtDate } = usePreferences();
  const habits = useQuery(habitsQuery());
  const logs = useQuery(habitLogsQuery());
  const today = todayISO();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);
  const [form, setForm] = useState<HabitInput>(emptyForm);
  const [toDelete, setToDelete] = useState<Habit | null>(null);

  const onError = (e: unknown) =>
    toast.error(e instanceof Error ? e.message : "Something went wrong.");

  const save = useMutation({
    mutationFn: async () => (editing ? updateHabit(editing.id, form) : createHabit(form)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: habitKeys.all });
      setDialogOpen(false);
      toast.success(editing ? "Habit updated." : "Habit created.");
    },
    onError,
  });

  const toggleLog = useMutation({
    mutationFn: ({ habitId, done }: { habitId: string; done: boolean }) =>
      done ? unlogHabit(habitId, today) : logHabit(habitId, today),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: habitKeys.logs }),
    onError,
  });

  const archive = useMutation({
    mutationFn: (id: string) => archiveHabit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: habitKeys.all });
      toast.success("Habit archived.");
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteHabit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: habitKeys.all });
      queryClient.invalidateQueries({ queryKey: habitKeys.logs });
      setToDelete(null);
      toast.success("Habit deleted.");
    },
    onError,
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(habit: Habit) {
    setEditing(habit);
    setForm({
      name: habit.name,
      description: habit.description,
      frequency: habit.frequency,
      target: habit.target,
      active: habit.active,
      icon: habit.icon,
      color: habit.color,
    });
    setDialogOpen(true);
  }

  const allLogs = logs.data ?? [];

  return (
    <>
      <PageHeader
        title="Habits"
        description="Small repeated actions, logged daily or weekly."
        actions={<Button onClick={openCreate}>New habit</Button>}
      />

      {habits.isLoading || logs.isLoading ? (
        <LoadingState />
      ) : habits.error || logs.error ? (
        <ErrorState
          error={habits.error ?? logs.error}
          onRetry={() => {
            habits.refetch();
            logs.refetch();
          }}
        />
      ) : (habits.data ?? []).length === 0 ? (
        <EmptyState
          title="No habits yet"
          description="A habit is a small thing you want to keep doing. Life OS records the days you did it, nothing more."
          action={<Button onClick={openCreate}>New habit</Button>}
        />
      ) : (
        <ul className="space-y-3">
          {(habits.data ?? []).map((habit) => {
            const habitLogs = allLogs.filter((l) => l.habit_id === habit.id);
            const done = habitLogs.some((l) => l.log_date === today);
            return (
              <li key={habit.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                   <div className="flex min-w-0 gap-3">
                     <EntityIcon icon={habit.icon} color={habit.color} />
                     <div className="min-w-0">
                    <p className="font-medium">
                      {habit.name}
                      {!habit.active ? (
                        <span className="ml-2 text-xs text-muted-foreground">Archived</span>
                      ) : null}
                    </p>
                    {habit.description ? (
                      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                        {habit.description}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary">
                        {labelOf(HABIT_FREQUENCIES, habit.frequency)}
                      </Badge>
                      <span>Target {habit.target}×</span>
                       <span>{habitLogs.length} {habitLogs.length === 1 ? "entry" : "entries"} logged</span>
                     </div>
                   </div>
                    {habitLogs.length > 0 ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Recent: {habitLogs.slice(0, 5).map((l) => fmtDate(l.log_date)).join(" · ")}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={done ? "outline" : "default"}
                      onClick={() => toggleLog.mutate({ habitId: habit.id, done })}
                    >
                      {done ? "Undo today" : "Log today"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(habit)}>
                      Edit
                    </Button>
                    {habit.active ? (
                      <Button size="sm" variant="ghost" onClick={() => archive.mutate(habit.id)}>
                        Archive
                      </Button>
                    ) : null}
                    <Button size="sm" variant="ghost" onClick={() => setToDelete(habit)}>
                      Delete
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? "Edit habit" : "New habit"}
        pending={save.isPending}
        onSubmit={() => save.mutate()}
      >
        <div className="space-y-2">
          <Label htmlFor="habit-name">Name</Label>
          <Input
            id="habit-name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <EntityIdentityPicker value={{ icon: form.icon, color: form.color }} onChange={(identity) => setForm({ ...form, ...identity })} />
        <div className="space-y-2">
          <Label htmlFor="habit-description">Description</Label>
          <Textarea
            id="habit-description"
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.target.value || null })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Frequency</Label>
            <Select
              value={form.frequency}
              onValueChange={(v) => setForm({ ...form, frequency: v as Habit["frequency"] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HABIT_FREQUENCIES.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="habit-target">Target per period</Label>
            <Input
              id="habit-target"
              type="number"
              min={1}
              value={form.target}
              onChange={(e) => setForm({ ...form, target: Number(e.target.value) || 1 })}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            id="habit-active"
            checked={form.active}
            onCheckedChange={(v) => setForm({ ...form, active: v })}
          />
          <Label htmlFor="habit-active">Active</Label>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete this habit?"
        description="Its logging history will be removed too."
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </>
  );
}
