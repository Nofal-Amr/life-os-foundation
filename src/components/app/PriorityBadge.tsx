import { PRIORITY_STYLE, type Priority } from "@/data/focus";
import { cn } from "@/lib/utils";

/** A priority's colour and its word together; low priority shows nothing. */
export function PriorityBadge({
  priority,
  className,
}: {
  priority: Priority | "low" | null | undefined;
  className?: string;
}) {
  if (!priority || priority === "low") return null;
  const style = PRIORITY_STYLE[priority];
  return (
    <span
      className={cn(
        "shrink-0 rounded-md px-1.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide",
        className,
      )}
      style={{
        color: style.color,
        background: `color-mix(in oklch, ${style.color} 14%, transparent)`,
      }}
    >
      {style.label}
    </span>
  );
}
