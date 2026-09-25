import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  Apple,
  CalendarDays,
  CheckSquare,
  FolderKanban,
  Gauge,
  Repeat,
  Search,
  StickyNote,
  Target,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { eventsQuery } from "@/data/events";
import { financeCategoriesQuery, transactionsQuery } from "@/data/finance";
import { foodsQuery } from "@/data/food";
import { goalsQuery } from "@/data/goals";
import { habitsQuery } from "@/data/habits";
import { notesQuery } from "@/data/notes";
import { projectsQuery } from "@/data/projects";
import { resourcesQuery } from "@/data/resources";
import { searchItems, type SearchItem, type SearchKind } from "@/data/search";
import { tasksQuery } from "@/data/tasks";
import { usePreferences } from "@/hooks/usePreferences";

const KINDS: Record<SearchKind, { label: string; icon: LucideIcon; to: string }> = {
  task: { label: "Tasks", icon: CheckSquare, to: "/tasks" },
  project: { label: "Projects", icon: FolderKanban, to: "/projects" },
  goal: { label: "Goals", icon: Target, to: "/goals" },
  note: { label: "Notes", icon: StickyNote, to: "/notes" },
  habit: { label: "Habits", icon: Repeat, to: "/habits" },
  spending: { label: "Money", icon: Wallet, to: "/finance/transactions" },
  food: { label: "Food", icon: Apple, to: "/food" },
  resource: { label: "Home and bills", icon: Gauge, to: "/resources" },
  event: { label: "Calendar", icon: CalendarDays, to: "/calendar" },
};

const PAGES = [
  { label: "Today", to: "/dashboard" },
  { label: "Week", to: "/week" },
  { label: "Time", to: "/time" },
  { label: "Tasks", to: "/tasks" },
  { label: "Projects", to: "/projects" },
  { label: "Goals", to: "/goals" },
  { label: "Habits", to: "/habits" },
  { label: "Money", to: "/finance" },
  { label: "Accounts", to: "/finance/accounts" },
  { label: "Transactions", to: "/finance/transactions" },
  { label: "Home and bills", to: "/resources" },
  { label: "Health", to: "/health" },
  { label: "Food", to: "/food" },
  { label: "Spirit", to: "/spirit" },
  { label: "Notes", to: "/notes" },
  { label: "Calendar", to: "/calendar" },
  { label: "Reminders", to: "/reminders" },
  { label: "Daily review", to: "/review" },
  { label: "Settings", to: "/settings" },
] as const;

/** Opens with Ctrl/Cmd+K anywhere, or from a search button. */
export function useSearchShortcut(open: () => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        open();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
}

/**
 * One box that finds anything you've logged: tasks, projects, goals, notes,
 * habits, spending, foods, resources and calendar events, plus every page.
 * It reads the same cached data the pages use, so it works offline.
 */
export function UniversalSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const { fmtMoney, fmtDate } = usePreferences();
  const enabled = open;
  const tasks = useQuery({ ...tasksQuery(), enabled });
  const projects = useQuery({ ...projectsQuery(), enabled });
  const goals = useQuery({ ...goalsQuery(), enabled });
  const notes = useQuery({ ...notesQuery(), enabled });
  const habits = useQuery({ ...habitsQuery(), enabled });
  const transactions = useQuery({ ...transactionsQuery(), enabled });
  const categories = useQuery({ ...financeCategoriesQuery(), enabled });
  const foods = useQuery({ ...foodsQuery(), enabled });
  const resources = useQuery({ ...resourcesQuery(), enabled });
  const events = useQuery({ ...eventsQuery(), enabled });

  const items = useMemo<SearchItem[]>(() => {
    const categoryName = new Map((categories.data ?? []).map((row) => [row.id, row.name]));
    return [
      ...(tasks.data ?? []).map((task) => ({
        kind: "task" as const,
        id: task.id,
        title: task.title,
        body: task.description,
        detail:
          task.status === "completed"
            ? "Done"
            : task.due_date
              ? `Due ${fmtDate(task.due_date)}`
              : undefined,
      })),
      ...(projects.data ?? []).map((project) => ({
        kind: "project" as const,
        id: project.id,
        title: project.name,
        body: project.description,
      })),
      ...(goals.data ?? []).map((goal) => ({
        kind: "goal" as const,
        id: goal.id,
        title: goal.name,
        body: goal.description,
      })),
      ...(notes.data ?? []).map((note) => ({
        kind: "note" as const,
        id: note.id,
        title: note.title || (note.body ?? "").split("\n")[0]?.slice(0, 80) || "Untitled note",
        body: note.body,
      })),
      ...(habits.data ?? []).map((habit) => ({
        kind: "habit" as const,
        id: habit.id,
        title: habit.name,
        body: habit.description,
      })),
      ...(transactions.data ?? [])
        .filter((row) => row.description || row.category_id)
        .map((row) => ({
          kind: "spending" as const,
          id: row.id,
          title:
            row.description ||
            (row.category_id ? categoryName.get(row.category_id) : undefined) ||
            "Transaction",
          body: row.category_id ? categoryName.get(row.category_id) : null,
          detail: `${row.kind === "income" ? "+" : ""}${fmtMoney(Number(row.amount))} · ${fmtDate(row.date)}`,
        })),
      ...(foods.data ?? []).map((food) => ({
        kind: "food" as const,
        id: food.id,
        title: food.name,
        detail: `${Math.round(Number(food.calories))} kcal`,
      })),
      ...(resources.data ?? []).map((resource) => ({
        kind: "resource" as const,
        id: resource.id,
        title: resource.name,
      })),
      ...(events.data ?? []).map((event) => ({
        kind: "event" as const,
        id: event.id,
        title: event.title,
        detail: fmtDate(event.start_at.slice(0, 10)),
      })),
    ];
  }, [
    tasks.data,
    projects.data,
    goals.data,
    notes.data,
    habits.data,
    transactions.data,
    categories.data,
    foods.data,
    resources.data,
    events.data,
    fmtMoney,
    fmtDate,
  ]);

  const results = useMemo(() => searchItems(items, query), [items, query]);
  const grouped = useMemo(() => {
    const map = new Map<SearchKind, typeof results>();
    for (const result of results) map.set(result.kind, [...(map.get(result.kind) ?? []), result]);
    return [...map.entries()];
  }, [results]);
  const pages = PAGES.filter((page) =>
    page.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const go = (to: string, search?: Record<string, string>) => {
    onOpenChange(false);
    setQuery("");
    void navigate({ to, ...(search ? { search } : {}) } as never);
  };

  return (
    <CommandDialog
      shouldFilter={false}
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setQuery("");
      }}
    >
      {/* Our own ranking decides the order; cmdk only renders. */}
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search tasks, notes, money, food…"
      />
      <CommandList className="max-h-[60vh]">
        <CommandEmpty>
          {query.trim().length < 2 ? "Type at least two letters." : "Nothing matches that."}
        </CommandEmpty>
        {grouped.map(([kind, list]) => {
          const meta = KINDS[kind];
          const Icon = meta.icon;
          return (
            <CommandGroup key={kind} heading={meta.label}>
              {list.map((result) => (
                <CommandItem
                  key={`${kind}-${result.id}`}
                  value={`${kind}-${result.id}`}
                  onSelect={() =>
                    kind === "note" ? go("/notes", { open: result.id }) : go(meta.to)
                  }
                  className="gap-3"
                >
                  <Icon className="text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{result.title}</span>
                  {result.detail ? (
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {result.detail}
                    </span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}
        {pages.length ? (
          <CommandGroup heading="Go to">
            {pages.slice(0, query.trim() ? 6 : 8).map((page) => (
              <CommandItem
                key={page.to}
                value={`page-${page.to}`}
                onSelect={() => go(page.to)}
                className="gap-3"
              >
                <Search className="text-muted-foreground" aria-hidden="true" />
                {page.label}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
