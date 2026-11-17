import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { ErrorState, LoadingState } from "@/components/app/States";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  EQUIPMENT,
  MUSCLES,
  exerciseImageUrl,
  exerciseLibraryQuery,
  searchExercises,
  type LibraryExercise,
} from "@/data/exerciseLibrary";
import { t } from "@/lib/i18n";

const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Find an exercise by name, the muscle it works and the equipment (a
 * machine, cables, a barbell…). Tapping one shows how to do it; with
 * `onPick`, a button adds it to what you're building.
 */
export function ExerciseBrowser({
  onPick,
  pickLabel = "Add",
}: {
  onPick?: ((exercise: LibraryExercise) => void) | undefined;
  pickLabel?: string;
}) {
  const library = useQuery(exerciseLibraryQuery());
  const [text, setText] = useState("");
  const [muscle, setMuscle] = useState("");
  const [equipment, setEquipment] = useState("");
  const [open, setOpen] = useState<LibraryExercise | null>(null);
  const results = useMemo(
    () => (library.data ? searchExercises(library.data, { text, muscle, equipment }) : []),
    [library.data, text, muscle, equipment],
  );

  if (library.isLoading) return <LoadingState rows={4} />;
  if (library.error)
    return <ErrorState error={library.error} onRetry={() => void library.refetch()} />;

  const select = "h-10 min-w-0 flex-1 rounded-lg border border-border bg-card px-2 text-sm";
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          className="ps-9"
          value={text}
          placeholder={t("Search exercises")}
          aria-label={t("Search exercises")}
          onChange={(event) => setText(event.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <select
          className={select}
          value={muscle}
          aria-label={t("Muscle")}
          onChange={(event) => setMuscle(event.target.value)}
        >
          <option value="">{t("Any muscle")}</option>
          {MUSCLES.map((item) => (
            <option key={item} value={item}>
              {t(cap(item))}
            </option>
          ))}
        </select>
        <select
          className={select}
          value={equipment}
          aria-label={t("Equipment")}
          onChange={(event) => setEquipment(event.target.value)}
        >
          <option value="">{t("Any equipment")}</option>
          {EQUIPMENT.map((item) => (
            <option key={item} value={item}>
              {t(cap(item))}
            </option>
          ))}
        </select>
      </div>

      {results.length ? (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {results.map((item) => (
            <li key={item.id} className="flex items-center gap-2 px-3 py-2">
              <button
                type="button"
                className="min-w-0 flex-1 text-start"
                onClick={() => setOpen(item)}
              >
                <span className="block truncate text-sm font-medium">{item.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {[
                    item.primary.map((m) => t(cap(m))).join(", "),
                    t(cap(item.equipment ?? "other")),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </button>
              {onPick ? (
                <Button type="button" size="sm" variant="outline" onClick={() => onPick(item)}>
                  {t(pickLabel)}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t("No exercise matches. Try fewer words, or any muscle.")}
        </p>
      )}
      <p className="text-2xs text-muted-foreground">
        {t("Exercises and photos: free-exercise-db (public domain).")}
      </p>

      <ExerciseDetail
        exercise={open}
        onOpenChange={(value) => !value && setOpen(null)}
        onPick={
          onPick
            ? (item) => {
                onPick(item);
                setOpen(null);
              }
            : undefined
        }
        pickLabel={pickLabel}
      />
    </div>
  );
}

/** How to do one exercise: the start and end photos, the steps, the muscles. */
export function ExerciseDetail({
  exercise,
  onOpenChange,
  onPick,
  pickLabel = "Add",
}: {
  exercise: LibraryExercise | null;
  onOpenChange: (open: boolean) => void;
  onPick?: ((exercise: LibraryExercise) => void) | undefined;
  pickLabel?: string;
}) {
  return (
    <Dialog open={!!exercise} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {exercise ? (
          <>
            <DialogHeader>
              <DialogTitle>{exercise.name}</DialogTitle>
              <DialogDescription>
                {[
                  t(cap(exercise.equipment ?? "other")),
                  t(cap(exercise.level)),
                  t(cap(exercise.category)),
                ].join(" · ")}
              </DialogDescription>
            </DialogHeader>
            {exercise.images.length ? (
              <div className="grid grid-cols-2 gap-2">
                {exercise.images.slice(0, 2).map((path, index) => (
                  <figure key={path} className="space-y-1">
                    <img
                      src={exerciseImageUrl(path)}
                      alt={`${exercise.name}: ${t(index === 0 ? "start" : "end")}`}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="aspect-[4/3] w-full rounded-lg bg-secondary object-cover"
                    />
                    <figcaption className="text-center text-2xs text-muted-foreground">
                      {t(index === 0 ? "Start" : "End")}
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : null}
            <dl className="space-y-1 text-sm">
              <div className="flex gap-2">
                <dt className="text-muted-foreground">{t("Works")}:</dt>
                <dd>{exercise.primary.map((m) => t(cap(m))).join(", ")}</dd>
              </div>
              {exercise.secondary.length ? (
                <div className="flex gap-2">
                  <dt className="text-muted-foreground">{t("Also")}:</dt>
                  <dd>{exercise.secondary.map((m) => t(cap(m))).join(", ")}</dd>
                </div>
              ) : null}
            </dl>
            {exercise.steps.length ? (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">{t("How to do it")}</h3>
                <ol className="list-decimal space-y-2 ps-5 text-sm leading-relaxed" dir="ltr">
                  {exercise.steps.map((step, index) => (
                    <li key={index}>{step}</li>
                  ))}
                </ol>
              </section>
            ) : null}
            {onPick ? (
              <Button type="button" className="w-full" onClick={() => onPick(exercise)}>
                {t(pickLabel)}
              </Button>
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
