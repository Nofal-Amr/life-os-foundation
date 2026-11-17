import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ExerciseBrowser, ExerciseDetail } from "@/components/app/gym/ExerciseLibrary";
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
import { exerciseLibraryQuery, findExercise, type LibraryExercise } from "@/data/exerciseLibrary";
import { deleteRoutine, gymKeys, saveRoutine, saveRoutines } from "@/data/gymApi";
import {
  WEEKDAY_SHORT,
  parseRoutinesMarkdown,
  plannedLabel,
  type PlannedExercise,
  type Routine,
  type RoutineInput,
} from "@/data/gymRoutines";
import { t } from "@/lib/i18n";
import { toError } from "@/lib/supabase-helpers";
import { cn } from "@/lib/utils";

type Row = { exercise: string; sets: string; reps: string; weight: string };

const toRow = (item: PlannedExercise): Row => ({
  exercise: item.exercise,
  sets: String(item.sets),
  reps: item.reps != null ? String(item.reps) : item.seconds != null ? `${item.seconds}s` : "",
  weight: item.weight != null ? String(item.weight) : "",
});

function fromRow(row: Row): PlannedExercise | null {
  const exercise = row.exercise.trim().slice(0, 80);
  if (!exercise) return null;
  const positive = (text: string) => {
    const value = Number(text.replace(",", ".").replace(/s$/i, "").trim());
    return text.trim() && Number.isFinite(value) && value >= 0 ? value : null;
  };
  const timed = /s$/i.test(row.reps.trim());
  const amount = positive(row.reps);
  return {
    exercise,
    sets: Math.max(1, Math.min(20, Math.round(positive(row.sets) ?? 1))),
    reps: timed || amount == null ? null : Math.round(amount),
    seconds: timed && amount != null ? Math.round(amount) : null,
    weight: positive(row.weight),
  };
}

/** Make or change a routine: its name, its days, and each exercise's plan. */
export function RoutineDialog({
  open,
  onOpenChange,
  routine,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Change this one; without it, a new routine. */
  routine: Routine | null;
}) {
  const queryClient = useQueryClient();
  const library = useQuery({ ...exerciseLibraryQuery(), enabled: open });
  const [name, setName] = useState(routine?.name ?? "");
  const [days, setDays] = useState<number[]>(routine?.weekdays ?? []);
  const [rows, setRows] = useState<Row[]>(
    routine?.exercises.map(toRow) ?? [{ exercise: "", sets: "3", reps: "10", weight: "" }],
  );
  const [note, setNote] = useState(routine?.note ?? "");
  const [finding, setFinding] = useState(false);
  const [howTo, setHowTo] = useState<LibraryExercise | null>(null);

  const exercises = rows.map(fromRow).filter((item): item is PlannedExercise => !!item);
  const input: RoutineInput = {
    name: name.trim().slice(0, 80),
    weekdays: days,
    exercises,
    note: note.trim().slice(0, 2000) || null,
  };
  const done = (message: string) => {
    void queryClient.invalidateQueries({ queryKey: gymKeys.routines });
    toast.success(t(message));
    onOpenChange(false);
  };
  const save = useMutation({
    mutationFn: () => saveRoutine(input, routine?.id),
    onSuccess: () => done("Routine saved."),
    onError: (error: unknown) => toast.error(toError(error).message),
  });
  const remove = useMutation({
    mutationFn: () => deleteRoutine(routine!.id),
    onSuccess: () => done("Routine deleted."),
    onError: (error: unknown) => toast.error(toError(error).message),
  });
  const update = (index: number, patch: Partial<Row>) =>
    setRows((current) => current.map((row, at) => (at === index ? { ...row, ...patch } : row)));
  const add = (exercise: string) =>
    setRows((current) => [
      ...current.filter((row) => row.exercise.trim()),
      { exercise, sets: "3", reps: "10", weight: "" },
    ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t(routine ? "Change routine" : "New routine")}</DialogTitle>
          <DialogDescription>
            {t("What you plan to do. On its days, Gym offers to start it and fills in the log.")}
          </DialogDescription>
        </DialogHeader>

        {finding ? (
          <div className="space-y-3">
            <ExerciseBrowser
              onPick={(item) => {
                add(item.name);
                setFinding(false);
              }}
            />
            <Button type="button" variant="ghost" onClick={() => setFinding(false)}>
              {t("Back to the routine")}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="routine-name">{t("Name")}</Label>
              <Input
                id="routine-name"
                value={name}
                maxLength={80}
                placeholder={t("Push day")}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium">{t("Days")}</legend>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAY_SHORT.map((label, day) => {
                  const on = days.includes(day);
                  return (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setDays((current) =>
                          on
                            ? current.filter((item) => item !== day)
                            : [...current, day].sort((a, b) => a - b),
                        )
                      }
                      className={cn(
                        "h-9 min-w-11 rounded-lg border px-2 text-sm",
                        on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card",
                      )}
                    >
                      {t(label)}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="space-y-2">
              <p className="text-sm font-medium">{t("Exercises")}</p>
              <p className="text-xs text-muted-foreground">
                {t("Reps can be a time, like 45s. Leave the weight empty to use last time's.")}
              </p>
              {rows.map((row, index) => {
                const known = findExercise(library.data, row.exercise);
                return (
                  <div key={index} className="space-y-2 rounded-lg bg-secondary p-2.5">
                    <div className="flex items-center gap-1.5">
                      <Input
                        value={row.exercise}
                        maxLength={80}
                        aria-label={`${t("Exercise")} ${index + 1}`}
                        placeholder={t("Exercise")}
                        onChange={(event) => update(index, { exercise: event.target.value })}
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
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={t("Remove exercise")}
                        onClick={() =>
                          setRows((current) => current.filter((_, at) => at !== index))
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm">
                      <Input
                        inputMode="numeric"
                        className="h-9 w-16"
                        value={row.sets}
                        aria-label={t("Sets")}
                        onChange={(event) => update(index, { sets: event.target.value })}
                      />
                      <span className="text-muted-foreground">{t("sets")} ×</span>
                      <Input
                        className="h-9 w-20"
                        value={row.reps}
                        aria-label={t("Reps")}
                        placeholder={t("reps")}
                        onChange={(event) => update(index, { reps: event.target.value })}
                      />
                      <Input
                        inputMode="decimal"
                        className="h-9 w-20"
                        value={row.weight}
                        aria-label={t("Weight")}
                        placeholder="kg"
                        onChange={(event) => update(index, { weight: event.target.value })}
                      />
                    </div>
                  </div>
                );
              })}
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setFinding(true)}>
                  <BookOpen className="size-4" /> {t("Find in the library")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setRows((current) => [
                      ...current,
                      { exercise: "", sets: "3", reps: "10", weight: "" },
                    ])
                  }
                >
                  <Plus className="size-4" /> {t("Type one in")}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="routine-note">{t("Note (optional)")}</Label>
              <Textarea
                id="routine-note"
                rows={2}
                maxLength={2000}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
          </div>
        )}

        {!finding ? (
          <DialogFooter className="gap-2 sm:justify-between">
            {routine ? (
              <Button
                type="button"
                variant="ghost"
                disabled={remove.isPending}
                onClick={() => remove.mutate()}
              >
                <Trash2 className="size-4" /> {t("Delete")}
              </Button>
            ) : (
              <span />
            )}
            <Button
              type="button"
              disabled={!input.name || !exercises.length || save.isPending}
              onClick={() => save.mutate()}
            >
              {t("Save routine")}
            </Button>
          </DialogFooter>
        ) : null}

        <ExerciseDetail exercise={howTo} onOpenChange={(value) => !value && setHowTo(null)} />
      </DialogContent>
    </Dialog>
  );
}

const EXAMPLE = `# Push day
Days: Sun, Wed
- Bench press: 3x8 @ 60kg
- Incline dumbbell press: 3x10 @ 20
- Plank: 3x45s

# Legs
Days: Tue
- Squat: 5x5 @ 80
- Leg press: 4x12`;

/** Routines from a Markdown file or pasted text; shown before anything is saved. */
export function ImportRoutinesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const routines = parseRoutinesMarkdown(text);
  const save = useMutation({
    mutationFn: () => saveRoutines(routines),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: gymKeys.routines });
      toast.success(`${routines.length} ${t("routines added.")}`);
      setText("");
      onOpenChange(false);
    },
    onError: (error: unknown) => toast.error(toError(error).message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("Import routines")}</DialogTitle>
          <DialogDescription>
            {t(
              "A Markdown file (.md) or pasted text: a heading per routine, a Days line, then one exercise per line.",
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            type="file"
            accept=".md,.markdown,.txt,text/markdown,text/plain"
            aria-label={t("Choose a file")}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (file) setText((await file.text()).slice(0, 100_000));
            }}
          />
          <Textarea
            rows={8}
            value={text}
            placeholder={EXAMPLE}
            aria-label={t("Routines as text")}
            className="font-mono text-xs"
            onChange={(event) => setText(event.target.value)}
          />
          {routines.length ? (
            <ul className="space-y-2 text-sm">
              {routines.map((routine, index) => (
                <li key={index} className="rounded-lg bg-secondary p-2.5">
                  <p className="font-medium">
                    {routine.name}
                    {routine.weekdays.length ? (
                      <span className="font-normal text-muted-foreground">
                        {" · "}
                        {routine.weekdays.map((day) => t(WEEKDAY_SHORT[day]!)).join(", ")}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {routine.exercises
                      .map((item) => `${item.exercise} ${plannedLabel(item)}`)
                      .join(" · ")}
                  </p>
                </li>
              ))}
            </ul>
          ) : text.trim() ? (
            <p className="text-sm text-muted-foreground">
              {t("No routines found yet. Start each with a # heading and list its exercises.")}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            disabled={!routines.length || save.isPending}
            onClick={() => save.mutate()}
          >
            {routines.length
              ? `${t("Add")} ${routines.length} ${t("routines")}`
              : t("Add routines")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
