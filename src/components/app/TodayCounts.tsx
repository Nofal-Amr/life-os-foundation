import { Link } from "@tanstack/react-router";
import { CalendarClock, FolderKanban, History, Inbox, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type TodayCountsInput = {
  inbox: number;
  dueToday: number;
  fromEarlier: number;
  activeProjects: number;
};

type Tile = {
  key: keyof TodayCountsInput;
  label: string;
  icon: LucideIcon;
  color: string;
  to: "/tasks" | "/projects";
};

/** Each tile wears its own identity colour; the word says what it counts. */
const TILES: Tile[] = [
  // Tasks added quickly, with no day or project yet (status "inbox").
  { key: "inbox", label: "Unsorted", icon: Inbox, color: "var(--entity-amber)", to: "/tasks" },
  {
    key: "dueToday",
    label: "Due today",
    icon: CalendarClock,
    color: "var(--entity-green)",
    to: "/tasks",
  },
  {
    key: "fromEarlier",
    label: "From earlier",
    icon: History,
    color: "var(--entity-coral)",
    to: "/tasks",
  },
  {
    key: "activeProjects",
    label: "Active projects",
    icon: FolderKanban,
    color: "var(--entity-blue)",
    to: "/projects",
  },
];

/** Four counts at a glance under the greeting, each a way in. */
export function TodayCounts({
  counts,
  className,
}: {
  counts: TodayCountsInput;
  className?: string;
}) {
  return (
    <ul className={cn("grid grid-cols-2 gap-2 sm:grid-cols-4", className)}>
      {TILES.map(({ key, label, icon: Icon, color, to }) => (
        <li key={key}>
          <Link
            to={to}
            className="flex min-h-16 items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 transition-colors hover:bg-accent"
          >
            <span
              aria-hidden="true"
              className="grid size-9 shrink-0 place-items-center rounded-lg"
              style={{ color, background: `color-mix(in oklch, ${color} 15%, transparent)` }}
            >
              <Icon className="size-[18px]" />
            </span>
            <span className="min-w-0">
              <span className="block text-lg font-semibold leading-tight tabular-nums">
                {counts[key]}
              </span>
              <span className="block truncate text-xs text-muted-foreground">{label}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
