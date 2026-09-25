import { Link } from "@tanstack/react-router";
import { Check, FolderKanban, Wallet } from "lucide-react";

import { PriorityBadge } from "@/components/app/PriorityBadge";
import {
  FOCUS_GROUP_LABELS,
  PRIORITY_STYLE,
  relativeDay,
  type FocusGroup,
  type Priority,
} from "@/data/focus";

export type FocusRow =
  | {
      kind: "task";
      id: string;
      /** The id the Done button completes (a step, or the task itself). */
      doneId: string;
      title: string;
      /** The task a step belongs to. */
      parentTitle?: string | null;
      due: string | null;
      /** "HH:mm", when the task has a time. */
      dueTime?: string | null;
      group: FocusGroup;
      project?: { name: string; color: string | null } | null;
      priority?: Priority | null;
      estimate?: string | null;
    }
  | {
      kind: "bill";
      id: string;
      title: string;
      due: string;
      group: FocusGroup;
      amount: string;
    };

const GROUP_ORDER: FocusGroup[] = ["earlier", "today", "soon"];

/**
 * The rest of today after the one next action: grouped by when, each task one
 * tap to tick off, with its project and due day in words. Bills due soon sit
 * alongside with their amount.
 */
export function TodayFocus({
  rows,
  today,
  onDone,
  pendingId,
}: {
  rows: FocusRow[];
  today: string;
  onDone: (id: string) => void;
  pendingId?: string | null;
}) {
  if (!rows.length) return null;
  return (
    <div className="space-y-4">
      {GROUP_ORDER.map((group) => {
        // Soonest first; rows without a date keep their order at the end.
        const list = rows
          .filter((row) => row.group === group)
          .map((row, index) => ({ row, index }))
          .sort(
            (a, b) => (a.row.due ?? "9999").localeCompare(b.row.due ?? "9999") || a.index - b.index,
          )
          .map(({ row }) => row);
        if (!list.length) return null;
        return (
          <section key={group} aria-label={FOCUS_GROUP_LABELS[group]}>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">
              {FOCUS_GROUP_LABELS[group]}
            </h3>
            <ul className="space-y-2">
              {list.map((row) => (
                <li
                  key={`${row.kind}-${row.id}`}
                  className="relative flex min-w-0 items-start gap-3 overflow-hidden rounded-xl border border-border bg-card py-3 pr-3 pl-4"
                >
                  {row.kind === "task" && row.priority ? (
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-2 left-0 w-1 rounded-r-full"
                      style={{ background: PRIORITY_STYLE[row.priority].color }}
                    />
                  ) : null}
                  {row.kind === "task" ? (
                    <button
                      type="button"
                      aria-label={`Done: ${row.title}`}
                      disabled={pendingId === row.doneId}
                      onClick={() => onDone(row.doneId)}
                      className="group mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2 border-border transition-[border-color,background-color,scale] duration-150 hover:border-primary active:scale-90 disabled:opacity-50"
                    >
                      <Check
                        className="size-3.5 text-primary opacity-0 transition-opacity group-hover:opacity-100"
                        aria-hidden="true"
                      />
                    </button>
                  ) : (
                    <span className="mt-0.5 grid size-6 shrink-0 place-items-center text-muted-foreground">
                      <Wallet className="size-4" aria-hidden="true" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    {row.kind === "task" && row.parentTitle ? (
                      <p className="truncate text-xs text-muted-foreground">{row.parentTitle}</p>
                    ) : null}
                    <Link
                      to={row.kind === "task" ? "/tasks" : "/finance/recurring"}
                      {...(row.kind === "task" ? { hash: row.id } : {})}
                      className="block break-words text-sm font-medium text-foreground hover:underline"
                    >
                      {row.kind === "bill" ? `Pay ${row.title}` : row.title}
                    </Link>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      {row.due ? (
                        <span className="rounded-md bg-muted px-1.5 py-0.5 tabular-nums">
                          {relativeDay(row.due, today)}
                          {row.kind === "task" && row.dueTime ? ` · ${row.dueTime}` : ""}
                        </span>
                      ) : null}
                      {row.kind === "task" && row.project ? (
                        <span className="inline-flex max-w-[12rem] items-center gap-1 rounded-md bg-muted px-1.5 py-0.5">
                          <FolderKanban
                            className="size-3 shrink-0"
                            style={row.project.color ? { color: row.project.color } : undefined}
                            aria-hidden="true"
                          />
                          <span className="truncate">{row.project.name}</span>
                        </span>
                      ) : null}
                      {row.kind === "task" && row.estimate ? <span>{row.estimate}</span> : null}
                      {row.kind === "bill" ? (
                        <span className="rounded-md bg-muted px-1.5 py-0.5 tabular-nums text-foreground">
                          {row.amount}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {row.kind === "task" ? <PriorityBadge priority={row.priority} /> : null}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
