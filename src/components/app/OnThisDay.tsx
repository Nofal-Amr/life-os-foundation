import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { differenceInCalendarDays, format, parseISO } from "date-fns";

import { notesQuery } from "@/data/notes";
import {
  ENERGY_LABELS,
  MOOD_LABELS,
  onThisDayReviewsQuery,
  reviewsQuery,
  sameDayPreviousYears,
  type DailyReview,
} from "@/data/reviews";
import { todayISO } from "@/lib/date";
import { cn } from "@/lib/utils";

/** A review with something written in it, not only a mood tap. */
export function isWrittenReview(review: DailyReview): boolean {
  return [review.wins, review.challenges, review.gratitude, review.tomorrow_focus].some(
    (text) => !!text?.trim(),
  );
}

/**
 * What you wrote on this date in earlier years: diary pages and daily
 * reviews. Shows nothing at all until there is something to show.
 */
export function OnThisDay({ className }: { className?: string }) {
  const today = todayISO();
  const reviews = useQuery(onThisDayReviewsQuery(today));
  const notes = useQuery(notesQuery());
  const days = new Set(sameDayPreviousYears(today));

  const diary = (notes.data ?? []).filter((note) => {
    if (!(note.tags ?? []).includes("Diary")) return false;
    const match = /(\d{1,2} \w+ \d{4})$/.exec(note.title ?? "");
    if (!match) return false;
    const parsed = new Date(match[1]!);
    return !Number.isNaN(parsed.getTime()) && days.has(format(parsed, "yyyy-MM-dd"));
  });
  const past = (reviews.data ?? []).filter((review) => isWrittenReview(review) || review.mood);

  if (!diary.length && !past.length) return null;

  return (
    <section className={cn("stat-card p-5", className)} aria-label="On this day">
      <h2 className="section-title">On this day</h2>
      <ul className="mt-3 space-y-3">
        {past.map((review) => (
          <li key={review.id} className="text-sm">
            <p className="text-xs text-muted-foreground">
              {format(parseISO(review.review_date), "yyyy")}
              {review.mood ? ` · ${MOOD_LABELS[review.mood - 1]}` : ""}
              {review.energy ? ` · ${ENERGY_LABELS[review.energy - 1]} energy` : ""}
            </p>
            {review.wins?.trim() ? <p className="mt-0.5 line-clamp-2">{review.wins}</p> : null}
          </li>
        ))}
        {diary.map((note) => (
          <li key={note.id} className="text-sm">
            <Link to="/notes" search={{ open: note.id }} className="block hover:underline">
              <p className="text-xs text-muted-foreground">Diary · {note.title}</p>
              <p className="mt-0.5 line-clamp-2">{note.body}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "Last review 5 days ago" as a quiet line; nothing when it's recent or never happened. */
export function ReflectionNudge({ className }: { className?: string }) {
  const reviews = useQuery(reviewsQuery());
  const last = (reviews.data ?? []).find(isWrittenReview);
  if (!last) return null;
  const days = differenceInCalendarDays(new Date(), parseISO(last.review_date));
  if (days < 2) return null;
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      Last daily review {days} days ago.{" "}
      <Link to="/review" className="font-medium text-foreground underline underline-offset-2">
        Write today's
      </Link>
    </p>
  );
}
