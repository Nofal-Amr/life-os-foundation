import { Check, MoreHorizontal } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * One row pattern for every list (Tasks, Projects, Habits, Transactions,
 * Recurring, Accounts, Categories):
 *
 *   [primary]  Title                          [trailing]  …
 *              meta line
 *
 * - Tapping the row opens it (`onOpen`). The whole card is the target, but
 *   the open button stays a real <button>, so it works by keyboard too.
 * - At most one primary action, on the left (`leading`): a circle, Log, or
 *   just the item's icon when there is nothing to do with it.
 * - Everything else is in "…". Delete-style actions sit last, apart, and are
 *   never shown on the row itself.
 * - Every control is at least 44 px on phones.
 */

export type RowAction = {
  label: string;
  onSelect: () => void;
  /** Delete, discard: listed last, apart, in the warning colour. */
  destructive?: boolean;
  disabled?: boolean;
};

export function ListRow({
  title,
  meta,
  leading,
  trailing,
  onOpen,
  openLabel,
  actions = [],
  muted = false,
  children,
  header,
  className,
  id,
}: {
  title: ReactNode;
  /** One quiet line (or a few chips) under the title. Not interactive. */
  meta?: ReactNode;
  /** The row's one primary action, or its icon. */
  leading?: ReactNode;
  /** A figure on the right, like an amount or balance. */
  trailing?: ReactNode;
  onOpen?: () => void;
  /** Screen-reader name for opening the row, e.g. "Edit Buy printer ink". */
  openLabel?: string;
  actions?: RowAction[];
  /** Done, archived or paused: the title is quieter. */
  muted?: boolean;
  /** Interactive extras under the row (steps, pockets, a hint with a link). */
  children?: ReactNode;
  /** Full-width content above the row, such as a project cover. */
  header?: ReactNode;
  className?: string;
  id?: string;
}) {
  const plainTitle = typeof title === "string" ? title : (openLabel ?? "this item");
  const regular = actions.filter((action) => !action.destructive);
  const destructive = actions.filter((action) => action.destructive);

  return (
    <li
      id={id}
      data-row=""
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-card transition-colors duration-150",
        onOpen && "hover:bg-accent/40",
        className,
      )}
    >
      {header}
      <div className="flex items-start gap-2 p-2 sm:gap-3 sm:p-3">
        {leading ? (
          <div className="relative z-10 flex min-h-11 shrink-0 items-center">{leading}</div>
        ) : null}
        <div className="min-w-0 flex-1 py-2.5">
          {onOpen ? (
            <button
              type="button"
              onClick={onOpen}
              aria-label={openLabel}
              className={cn(
                "block w-full min-w-0 text-left outline-none",
                // The whole card opens the row; other controls sit above this layer.
                "after:absolute after:inset-0 after:rounded-xl after:content-['']",
                "focus-visible:after:ring-2 focus-visible:after:ring-ring",
              )}
            >
              <RowTitle muted={muted}>{title}</RowTitle>
            </button>
          ) : (
            <RowTitle muted={muted}>{title}</RowTitle>
          )}
          {meta ? (
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              {meta}
            </div>
          ) : null}
        </div>
        {trailing ? (
          <div className="flex min-h-11 shrink-0 items-center text-right tabular-nums last:pr-2">
            {trailing}
          </div>
        ) : null}
        {actions.length ? (
          <div className="relative z-10 flex min-h-11 shrink-0 items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11 text-muted-foreground"
                  aria-label={`More for ${plainTitle}`}
                >
                  <MoreHorizontal className="size-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                {regular.map((action) => (
                  <DropdownMenuItem
                    key={action.label}
                    disabled={action.disabled ?? false}
                    className="min-h-11"
                    onSelect={action.onSelect}
                  >
                    {action.label}
                  </DropdownMenuItem>
                ))}
                {regular.length && destructive.length ? <DropdownMenuSeparator /> : null}
                {destructive.map((action) => (
                  <DropdownMenuItem
                    key={action.label}
                    disabled={action.disabled ?? false}
                    className="min-h-11 text-destructive focus:text-destructive"
                    onSelect={action.onSelect}
                  >
                    {action.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
      </div>
      {children ? <div className="relative z-10 px-3 pb-3 sm:px-4">{children}</div> : null}
    </li>
  );
}

function RowTitle({ muted, children }: { muted: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-2 font-medium leading-snug",
        muted && "text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

/** The list around rows: same spacing everywhere. */
export function RowList({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cn("space-y-2", className)}>{children}</ul>;
}

/**
 * The circle: complete a task, log a habit for today. 44 px to tap, 24 px to
 * see. `done` fills it.
 */
export function RowCheck({
  done,
  onToggle,
  label,
  disabled,
  color,
}: {
  done: boolean;
  onToggle: () => void;
  /** What tapping does, e.g. "Complete Buy printer ink". */
  label: string;
  disabled?: boolean;
  /** The item's own colour (a habit's), when it has one. */
  color?: string | null;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={done}
      disabled={disabled}
      onClick={onToggle}
      className="group/check flex size-11 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
    >
      <span
        className={cn(
          "flex size-6 items-center justify-center rounded-full border-2 transition-[background-color,border-color,transform] duration-150 ease-out group-active/check:scale-90",
          done
            ? "border-transparent bg-primary text-primary-foreground"
            : "border-muted-foreground/50 group-hover/check:border-primary",
        )}
        style={
          color && done ? { backgroundColor: color } : color ? { borderColor: color } : undefined
        }
      >
        {done ? <Check className="size-3.5" strokeWidth={3} /> : null}
      </span>
    </button>
  );
}
