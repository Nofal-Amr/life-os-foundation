import { useQuery } from "@tanstack/react-query";
import { Dumbbell, Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";

import {
  exerciseImageUrl,
  exerciseLibraryQuery,
  findExercise,
  type LibraryExercise,
} from "@/data/exerciseLibrary";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const FRAME_MS = 900;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The movement as a short loop: the start and end positions in turn, like a
 * GIF. With reduced motion (or paused) it rests on the start position, and
 * both frames stay visible below.
 */
export function ExerciseMotion({ exercise }: { exercise: LibraryExercise }) {
  const frames = exercise.images.slice(0, 2);
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!playing || frames.length < 2) return;
    const timer = window.setInterval(() => setFrame((value) => (value + 1) % 2), FRAME_MS);
    return () => window.clearInterval(timer);
  }, [playing, frames.length]);

  if (!frames.length) return null;
  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-xl bg-secondary">
        {frames.map((path, index) => (
          <img
            key={path}
            src={exerciseImageUrl(path)}
            alt={index === 0 ? `${exercise.name}: ${t("how to do it")}` : ""}
            aria-hidden={index === 0 ? undefined : true}
            referrerPolicy="no-referrer"
            className={cn(
              "aspect-[4/3] w-full object-cover transition-opacity duration-300",
              index > 0 && "absolute inset-0",
              (playing ? frame : 0) === index ? "opacity-100" : "opacity-0",
            )}
          />
        ))}
        {frames.length > 1 ? (
          <button
            type="button"
            onClick={() => setPlaying((value) => !value)}
            aria-label={playing ? t("Pause") : t("Play")}
            className="absolute bottom-2 end-2 grid size-9 place-items-center rounded-full bg-background/85 text-foreground shadow-sm backdrop-blur"
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
        ) : null}
      </div>
      {frames.length > 1 ? (
        <div className="grid grid-cols-2 gap-2">
          {frames.map((path, index) => (
            <button
              key={path}
              type="button"
              onClick={() => {
                setPlaying(false);
                setFrame(index);
              }}
              className="space-y-1 text-center"
            >
              <img
                src={exerciseImageUrl(path)}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                className={cn(
                  "aspect-[4/3] w-full rounded-lg bg-secondary object-cover",
                  !playing && frame === index && "ring-2 ring-primary",
                )}
              />
              <span className="text-2xs text-muted-foreground">
                {t(index === 0 ? "Start" : "End")}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * A small photo of an exercise by name, from the exercise library; a plain
 * dumbbell when the name isn't in the library. With `onOpen` it's a button
 * that opens the how-to.
 */
export function ExerciseThumb({
  name,
  onOpen,
  className,
}: {
  name: string;
  onOpen?: ((exercise: LibraryExercise) => void) | undefined;
  className?: string;
}) {
  const library = useQuery(exerciseLibraryQuery());
  const exercise = findExercise(library.data, name);
  const image = exercise?.images[0];
  const box = cn(
    "grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-muted",
    className,
  );
  const content = image ? (
    <img
      src={exerciseImageUrl(image)}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      className="size-full object-cover"
    />
  ) : (
    <Dumbbell className="size-4 text-muted-foreground" aria-hidden="true" />
  );
  if (exercise && onOpen)
    return (
      <button
        type="button"
        className={box}
        aria-label={`${t("How to do it")}: ${exercise.name}`}
        onClick={() => onOpen(exercise)}
      >
        {content}
      </button>
    );
  return (
    <span className={box} aria-hidden="true">
      {content}
    </span>
  );
}
