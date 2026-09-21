import { Target } from "lucide-react";

import type { Goal } from "@/data/goals";
import type { Count, GoalLinks } from "@/data/links";

/** A thin bar for "done of total"; nothing is drawn without a real total. */
export function CountBar({ count, label }: { count: Count; label: string }) {
  if (!count.total) return null;
  const pct = Math.round((count.done / count.total) * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">
          {count.done} of {count.total} {label}
        </span>
        <span className="tabular-nums text-muted-foreground">{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full origin-left rounded-full bg-primary transition-transform duration-500 ease-out"
          style={{ transform: `scaleX(${count.done / count.total})` }}
        />
      </div>
    </div>
  );
}

/** "Moves your goal: …" chips on a project. */
export function GoalChips({ goals }: { goals: Goal[] }) {
  if (!goals.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {goals.map((goal) => (
        <span
          key={goal.id}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary"
        >
          <Target className="size-3.5" aria-hidden="true" />
          Moves your goal: {goal.name}
        </span>
      ))}
    </div>
  );
}

/** What moves a goal forward: its projects, then the next linked tasks. */
export function GoalLinksList({ links }: { links: GoalLinks }) {
  if (!links.projects.length && !links.next.length) {
    return (
      <p className="text-xs text-muted-foreground">
        Link tasks to this goal (from a task's goal field) to see what moves it forward.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Moved forward by</p>
      <ul className="space-y-1.5">
        {links.projects.map(({ project, progress }) => (
          <li
            key={project.id}
            className="flex items-center justify-between gap-3 rounded-lg bg-secondary/60 px-3 py-2 text-sm"
          >
            <span className="min-w-0 truncate">{project.name}</span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {progress.done} of {progress.total} tasks
            </span>
          </li>
        ))}
        {links.next.slice(0, 3).map((task) => (
          <li
            key={task.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border px-3 py-2 text-sm"
          >
            <span className="min-w-0 truncate">{task.title}</span>
            <span className="shrink-0 text-xs text-muted-foreground">Next</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
