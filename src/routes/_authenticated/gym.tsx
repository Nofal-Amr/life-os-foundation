import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Pencil, Play, Plus, Trash2, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { DatePicker } from "@/components/app/DatePicker";
import { ExerciseBrowser, ExerciseDetail } from "@/components/app/gym/ExerciseLibrary";
import { ExerciseThumb } from "@/components/app/gym/ExerciseMedia";
import { ImportRoutinesDialog, RoutineDialog } from "@/components/app/gym/RoutineDialogs";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/States";
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
import {
  EXERCISES,
  draftSet,
  exerciseHistory,
  exerciseSummary,
  heaviestSet,
  lastSession,
  loggedExercises,
  setLabel,
  type Workout,
  type WorkoutSet,
} from "@/data/gym";
import {
  deleteWorkout,
  gymKeys,
  logWorkout,
  routinesQuery,
  workoutSetsQuery,
  workoutsQuery,
  type NewSet,
} from "@/data/gymApi";
import { exerciseLibraryQuery, findExercise, type LibraryExercise } from "@/data/exerciseLibrary";
import {
  WEEKDAY_SHORT,
  plannedLabel,
  routineDraft,
  routinesFor,
  type DraftExercise,
  type Routine,
} from "@/data/gymRoutines";
import { isMissingTable } from "@/data/relationshipsApi";
import { usePreferences } from "@/hooks/usePreferences";
import { todayISO } from "@/lib/date";
import { t } from "@/lib/i18n";
import { toError } from "@/lib/supabase-helpers";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/gym")({
  head: () => ({
    meta: [
      { title: "Gym · Life OS" },
      { name: "description", content: "Workouts, sets, and what you lifted last time." },
    ],
  }),
  component: GymPage,
});

type GymTab = "today" | "plan" | "exercises";
const TABS: { value: GymTab; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "plan", label: "Plan" },
  { value: "exercises", label: "Exercises" },
];

/** What the log opens with: empty, or a routine's plan to change into what happened. */
type LogStart = { name: string; items: DraftExercise[]; routineId: string | null };

const emptyExercise = (): DraftExercise => ({ name: "", rows: [{ weight: "", reps: "" }] });

function GymPage() {
  const workouts = useQuery(workoutsQuery());
  const sets = useQuery({ ...workoutSetsQuery(), enabled: workouts.isSuccess });
  const queryClient = useQueryClient();
  const { fmtDate } = usePreferences();
  const routines = useQuery(routinesQuery());
  const [tab, setTab] = useState<GymTab>("today");
  const [logging, setLogging] = useState<LogStart | null>(null);
  const [editing, setEditing] = useState<Routine | "new" | null>(null);
  const [importing, setImporting] = useState(false);
  const [toDelete, setToDelete] = useState<Workout | null>(null);
  const [focus, setFocus] = useState<string>("");
  const [howTo, setHowTo] = useState<LibraryExercise | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => deleteWorkout(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: gymKeys.all });
      setToDelete(null);
      toast.success(t("Workout deleted."));
    },
    onError: (error: unknown) => toast.error(toError(error).message),
  });

  const error = workouts.error ?? sets.error;
  const header = (
    <PageHeader
      title="Gym"
      description="Workouts, sets, and what you lifted last time."
      actions={
        isMissingTable(error) ? null : (
          <Button onClick={() => setLogging(blankLog())}>{t("Log a workout")}</Button>
        )
      }
    />
  );

  if (workouts.isLoading || (workouts.isSuccess && sets.isLoading))
    return (
      <>
        {header}
        <LoadingState rows={4} />
      </>
    );
  if (isMissingTable(error))
    return (
      <>
        {header}
        <EmptyState
          title="Gym needs a one-time database update"
          description="The workout tables haven't been added to this database yet. Gym appears here as soon as they are."
        />
      </>
    );
  if (error)
    return (
      <>
        {header}
        <ErrorState
          error={error}
          onRetry={() => void queryClient.invalidateQueries({ queryKey: gymKeys.all })}
        />
      </>
    );

  const allWorkouts = workouts.data ?? [];
  const allSets = sets.data ?? [];
  const allRoutines = routines.data ?? [];
  const exercises = loggedExercises(allWorkouts, allSets);
  const chosen = focus || exercises[0] || "";
  const today = todayISO();
  const todays = routinesFor(allRoutines, new Date().getDay());
  const doneToday = new Set(
    allWorkouts
      .filter((workout) => workout.performed_on === today && workout.routine_id)
      .map((workout) => workout.routine_id),
  );
  const start = (routine: Routine) =>
    setLogging({
      name: routine.name,
      routineId: routine.id,
      items: routineDraft(routine, (exercise) =>
        lastSession(exercise, allWorkouts, allSets, today),
      ),
    });

  return (
    <>
      {header}
      <div className="mb-5 flex gap-1 rounded-xl bg-secondary p-1" role="tablist">
        {TABS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={tab === option.value}
            onClick={() => setTab(option.value)}
            className={cn(
              "flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              tab === option.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            {t(option.label)}
          </button>
        ))}
      </div>

      {tab === "plan" ? (
        <PlanTab
          routines={allRoutines}
          onNew={() => setEditing("new")}
          onEdit={setEditing}
          onImport={() => setImporting(true)}
          onStart={start}
          onHowTo={setHowTo}
        />
      ) : tab === "exercises" ? (
        <ExerciseBrowser />
      ) : (
        <div className="space-y-6">
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">{t("Today's plan")}</h2>
            {todays.length ? (
              <ul className="space-y-2">
                {todays.map((routine) => (
                  <li
                    key={routine.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{routine.name}</p>
                      <div className="mt-2 flex gap-1.5 overflow-hidden">
                        {routine.exercises.slice(0, 6).map((item, index) => (
                          <ExerciseThumb
                            key={`${item.exercise}-${index}`}
                            name={item.exercise}
                            onOpen={setHowTo}
                            className="size-9"
                          />
                        ))}
                      </div>
                      <p className="mt-1.5 truncate text-xs text-muted-foreground">
                        {routine.exercises.map((item) => item.exercise).join(" · ")}
                      </p>
                    </div>
                    {doneToday.has(routine.id) ? (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {t("Logged today")}
                      </span>
                    ) : (
                      <Button type="button" className="shrink-0" onClick={() => start(routine)}>
                        <Play className="size-4" /> {t("Start")}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("Nothing planned for today.")}{" "}
                <button
                  type="button"
                  className="text-primary underline-offset-2 hover:underline"
                  onClick={() => setTab("plan")}
                >
                  {t(allRoutines.length ? "See your plan" : "Plan your week")}
                </button>
              </p>
            )}
          </section>
          {allWorkouts.length === 0 ? (
            <EmptyState
              title="No workouts yet"
              description="Log one after the gym: each exercise, then its sets. Next time, what you did last is shown beside it."
              action={<Button onClick={() => setLogging(blankLog())}>{t("Log a workout")}</Button>}
            />
          ) : (
            <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
              <section className="space-y-3">
                <h2 className="text-sm font-semibold">{t("Workouts")}</h2>
                <ul className="space-y-3">
                  {allWorkouts.map((workout) => {
                    const summary = exerciseSummary(
                      allSets.filter((set) => set.workout_id === workout.id),
                    );
                    return (
                      <li key={workout.id} className="rounded-xl border border-border bg-card p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium">
                              {workout.name ?? fmtDate(workout.performed_on)}
                            </p>
                            {workout.name ? (
                              <p className="text-xs text-muted-foreground">
                                {fmtDate(workout.performed_on)}
                              </p>
                            ) : null}
                          </div>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label={t("Delete workout")}
                            onClick={() => setToDelete(workout)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                        <ul className="mt-2 space-y-1 text-sm">
                          {summary.map((item) => (
                            <li key={item.exercise}>
                              <button
                                type="button"
                                className="text-start hover:underline"
                                onClick={() => setFocus(item.exercise)}
                              >
                                <span className="font-medium">{item.exercise}</span>
                              </button>
                              <span className="text-muted-foreground"> · {item.text}</span>
                            </li>
                          ))}
                        </ul>
                        {workout.note ? (
                          <p className="mt-2 text-xs text-muted-foreground">{workout.note}</p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>

              {chosen ? (
                <ExerciseProgress
                  exercise={chosen}
                  exercises={exercises}
                  onPick={setFocus}
                  workouts={allWorkouts}
                  sets={allSets}
                />
              ) : null}
            </div>
          )}
        </div>
      )}

      {logging ? (
        <LogWorkoutDialog
          open
          start={logging}
          onOpenChange={(open) => !open && setLogging(null)}
          workouts={allWorkouts}
          sets={allSets}
          known={exercises}
        />
      ) : null}
      {editing ? (
        <RoutineDialog
          open
          routine={editing === "new" ? null : editing}
          onOpenChange={(open) => !open && setEditing(null)}
        />
      ) : null}
      <ImportRoutinesDialog open={importing} onOpenChange={setImporting} />
      <ExerciseDetail exercise={howTo} onOpenChange={(value) => !value && setHowTo(null)} />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={t("Delete this workout?")}
        description={t("Its sets are deleted with it.")}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </>
  );
}

const blankLog = (): LogStart => ({ name: "", items: [emptyExercise()], routineId: null });

/** The plan side: your routines and their days. */
function PlanTab({
  routines,
  onNew,
  onEdit,
  onImport,
  onStart,
  onHowTo: setHowTo,
}: {
  routines: Routine[];
  onNew: () => void;
  onEdit: (routine: Routine) => void;
  onImport: () => void;
  onStart: (routine: Routine) => void;
  onHowTo: (exercise: LibraryExercise) => void;
}) {
  const actions = (
    <div className="flex flex-wrap gap-2">
      <Button type="button" onClick={onNew}>
        <Plus className="size-4" /> {t("New routine")}
      </Button>
      <Button type="button" variant="outline" onClick={onImport}>
        <Upload className="size-4" /> {t("Import from a file")}
      </Button>
    </div>
  );
  if (!routines.length)
    return (
      <EmptyState
        title="No routines yet"
        description="A routine is a workout you plan, like Push day on Sunday and Wednesday. On its days Gym offers to start it, already filled in."
        action={actions}
      />
    );
  return (
    <div className="space-y-4">
      {actions}
      <ul className="space-y-3">
        {routines.map((routine) => (
          <li key={routine.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">{routine.name}</p>
                <p className="text-xs text-muted-foreground">
                  {routine.weekdays.length
                    ? routine.weekdays.map((day) => t(WEEKDAY_SHORT[day]!)).join(", ")
                    : t("Any day")}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`${t("Start")} ${routine.name}`}
                  onClick={() => onStart(routine)}
                >
                  <Play className="size-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`${t("Change")} ${routine.name}`}
                  onClick={() => onEdit(routine)}
                >
                  <Pencil className="size-4" />
                </Button>
              </div>
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              {routine.exercises.map((item, index) => (
                <li key={index} className="flex min-w-0 items-center gap-3">
                  <ExerciseThumb name={item.exercise} onOpen={setHowTo} />
                  <span className="min-w-0">
                    <span className="font-medium">{item.exercise}</span>
                    <span className="block text-xs text-muted-foreground">
                      {plannedLabel(item)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            {routine.note ? (
              <p className="mt-2 text-xs text-muted-foreground">{routine.note}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One exercise over time: the heaviest set, and every session's sets. */
function ExerciseProgress({
  exercise,
  exercises,
  onPick,
  workouts,
  sets,
}: {
  exercise: string;
  exercises: string[];
  onPick: (name: string) => void;
  workouts: Workout[];
  sets: WorkoutSet[];
}) {
  const { fmtDate } = usePreferences();
  const history = exerciseHistory(exercise, workouts, sets);
  const best = heaviestSet(history, "kg") ?? heaviestSet(history, "lb");
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t("Progress")}</h2>
        <select
          className="h-10 max-w-[60%] rounded-lg border border-border bg-card px-2 text-sm"
          value={exercise}
          aria-label={t("Exercise")}
          onChange={(event) => onPick(event.target.value)}
        >
          {exercises.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
      {best ? (
        <p className="text-sm">
          {`${t("Heaviest")}: ${setLabel(best.set)} · ${fmtDate(best.day)}`}
        </p>
      ) : null}
      <ol className="space-y-1 text-sm">
        {history.map((session) => (
          <li key={session.workoutId} className="flex flex-wrap gap-x-2">
            <span className="tabular-nums text-muted-foreground">{fmtDate(session.day)}</span>
            <span>{session.sets.map(setLabel).join(", ")}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function LogWorkoutDialog({
  open,
  start,
  onOpenChange,
  workouts,
  sets,
  known,
}: {
  open: boolean;
  start: LogStart;
  onOpenChange: (open: boolean) => void;
  workouts: Workout[];
  sets: WorkoutSet[];
  known: string[];
}) {
  const queryClient = useQueryClient();
  const { fmtDate } = usePreferences();
  const [day, setDay] = useState(todayISO());
  const [name, setName] = useState(start.name);
  const [unit, setUnit] = useState<"kg" | "lb">("kg");
  const [items, setItems] = useState<DraftExercise[]>(start.items);
  const library = useQuery({ ...exerciseLibraryQuery(), enabled: open });
  const [howTo, setHowTo] = useState<LibraryExercise | null>(null);

  const suggestions = useMemo(() => {
    const seen = new Set(known.map((item) => item.toLowerCase()));
    return [...known, ...EXERCISES.filter((item) => !seen.has(item.toLowerCase()))];
  }, [known]);

  const toSave: NewSet[] = [];
  for (const item of items) {
    const exercise = item.name.trim();
    if (!exercise) continue;
    for (const row of item.rows) {
      const set = draftSet(row);
      if (set) toSave.push({ exercise, position: toSave.length, unit, ...set });
    }
  }

  const save = useMutation({
    mutationFn: () =>
      logWorkout(
        {
          performed_on: day,
          name: name.trim() || null,
          note: null,
          routine_id: start.routineId,
        },
        toSave,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: gymKeys.all });
      toast.success(t("Workout saved."));
      onOpenChange(false);
    },
    onError: (error: unknown) => toast.error(toError(error).message),
  });

  const update = (index: number, next: DraftExercise) =>
    setItems((current) => current.map((item, at) => (at === index ? next : item)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Log a workout</DialogTitle>
          <DialogDescription>
            {t(
              start.routineId
                ? "Your plan is filled in. Change it to what you actually did; blank rows are skipped."
                : "Each exercise, then its sets. Blank rows are skipped.",
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="gym-day">{t("Day")}</Label>
              <DatePicker id="gym-day" value={day} onChange={setDay} disableFuture />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gym-name">{t("Name (optional)")}</Label>
              <Input
                id="gym-name"
                value={name}
                maxLength={80}
                placeholder={t("Push day")}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gym-unit">{t("Unit")}</Label>
              <select
                id="gym-unit"
                className="h-10 rounded-lg border border-border bg-card px-2 text-sm"
                value={unit}
                onChange={(event) => setUnit(event.target.value === "lb" ? "lb" : "kg")}
              >
                <option value="kg">kg</option>
                <option value="lb">lb</option>
              </select>
            </div>
          </div>

          <datalist id="gym-exercises">
            {suggestions.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>

          {items.map((item, index) => {
            const last = item.name.trim() ? lastSession(item.name, workouts, sets, day) : null;
            const known = findExercise(library.data, item.name);
            return (
              <section key={index} className="space-y-2 rounded-lg bg-secondary p-3">
                <div className="flex items-center gap-2">
                  <Input
                    list="gym-exercises"
                    value={item.name}
                    maxLength={80}
                    aria-label={`${t("Exercise")} ${index + 1}`}
                    placeholder={t("Exercise")}
                    onChange={(event) => update(index, { ...item, name: event.target.value })}
                  />
                  {known ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`${t("How to do it")}: ${known.name}`}
                      onClick={() => setHowTo(known)}
                    >
                      <BookOpen className="size-4" />
                    </Button>
                  ) : null}
                  {items.length > 1 ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={t("Remove exercise")}
                      onClick={() => setItems((current) => current.filter((_, at) => at !== index))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>
                {last ? (
                  <p className="text-xs text-muted-foreground">
                    {`${t("Last time")} (${fmtDate(last.day)}): ${last.sets.map(setLabel).join(", ")}`}
                  </p>
                ) : null}
                {item.rows.map((row, rowIndex) => (
                  <div key={rowIndex} className="flex items-center gap-2">
                    <span className="w-6 text-xs tabular-nums text-muted-foreground">
                      {rowIndex + 1}
                    </span>
                    <Input
                      inputMode="decimal"
                      className="h-10 w-24"
                      value={row.weight}
                      aria-label={`${t("Weight")} ${rowIndex + 1}`}
                      placeholder={unit}
                      onChange={(event) =>
                        update(index, {
                          ...item,
                          rows: item.rows.map((each, at) =>
                            at === rowIndex ? { ...each, weight: event.target.value } : each,
                          ),
                        })
                      }
                    />
                    <span className="text-sm text-muted-foreground">×</span>
                    <Input
                      inputMode="numeric"
                      className="h-10 w-20"
                      value={row.reps}
                      aria-label={`${t("Reps")} ${rowIndex + 1}`}
                      placeholder={t("reps")}
                      onChange={(event) =>
                        update(index, {
                          ...item,
                          rows: item.rows.map((each, at) =>
                            at === rowIndex ? { ...each, reps: event.target.value } : each,
                          ),
                        })
                      }
                    />
                    {item.rows.length > 1 ? (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`${t("Remove set")} ${rowIndex + 1}`}
                        onClick={() =>
                          update(index, {
                            ...item,
                            rows: item.rows.filter((_, at) => at !== rowIndex),
                          })
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    // A new set starts as a copy of the one before, as most sets repeat.
                    update(index, {
                      ...item,
                      rows: [...item.rows, { ...(item.rows.at(-1) ?? { weight: "", reps: "" }) }],
                    })
                  }
                >
                  <Plus className="size-4" /> {t("Set")}
                </Button>
              </section>
            );
          })}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setItems((current) => [...current, emptyExercise()])}
          >
            <Plus className="size-4" /> {t("Exercise")}
          </Button>
        </div>

        <DialogFooter>
          <Button
            type="button"
            disabled={!toSave.length || save.isPending}
            onClick={() => save.mutate()}
          >
            {toSave.length ? `${t("Save")} (${toSave.length} ${t("sets")})` : t("Save")}
          </Button>
        </DialogFooter>
        <ExerciseDetail exercise={howTo} onOpenChange={(value) => !value && setHowTo(null)} />
      </DialogContent>
    </Dialog>
  );
}
