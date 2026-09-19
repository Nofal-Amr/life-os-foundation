import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/semantics";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "tone-neutral",
  info: "tone-info",
  positive: "tone-positive",
  warning: "tone-warning",
  danger: "tone-danger",
  quiet: "tone-quiet",
};

/**
 * Colour plus text. The label is always rendered, so meaning never depends on
 * colour alone.
 */
export function SemanticBadge({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        TONE_CLASS[tone],
        className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current opacity-80" />
      {children}
    </span>
  );
}

export function SemanticDot({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", TONE_CLASS[tone], "border-0 bg-transparent")}>
      <span aria-hidden="true" className="size-2 rounded-full bg-current" />
      <span className="text-foreground">{label}</span>
    </span>
  );
}
