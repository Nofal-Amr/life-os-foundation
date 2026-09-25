import { dayDots } from "@/data/habits";
import { cn } from "@/lib/utils";

/**
 * The last two weeks of a habit as a row of dots: filled where it was
 * logged, an empty ring otherwise. The count beside it is plain: logged
 * days out of the days shown.
 */
export function HabitDots({
  logs,
  today,
  color,
  days = 14,
  className,
}: {
  logs: { log_date: string }[];
  today: string;
  color?: string | null;
  days?: number;
  className?: string;
}) {
  const dots = dayDots(logs, today, days);
  const logged = dots.filter((dot) => dot.logged).length;
  const tint = color ?? "var(--color-primary)";
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <ol className="flex items-center gap-1" aria-label={`Last ${days} days`}>
        {dots.map((dot) => (
          <li
            key={dot.date}
            title={`${dot.date}${dot.logged ? " · logged" : ""}`}
            className={cn(
              "size-2.5 rounded-full border transition-colors",
              dot.date === today && "outline-1 outline-offset-2 outline-border outline",
            )}
            style={
              dot.logged
                ? { background: tint, borderColor: tint }
                : { borderColor: "var(--color-border)" }
            }
          >
            <span className="sr-only">
              {dot.date}: {dot.logged ? "logged" : "not logged"}
            </span>
          </li>
        ))}
      </ol>
      <span className="text-xs tabular-nums text-muted-foreground">
        {logged} of {days} days
      </span>
    </div>
  );
}
