import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/States";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { habitKeys, habitLogsQuery, habitsQuery, logHabit, unlogHabit } from "@/data/habits";
import { projectsQuery } from "@/data/projects";
import { filterTasks, isOpen, tasksQuery } from "@/data/tasks";
import { todayISO } from "@/lib/date";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Life OS" },
      { name: "description", content: "Today's tasks, habits and an overview of your system." },
      { property: "og:title", content: "Dashboard — Life OS" },
      {
        property: "og:description",
        content: "Today's tasks, habits and an overview of your system.",
      },
    ],
  }),
  component: DashboardPage,
});

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function DashboardPage() {
  const queryClient = useQueryClient();
  const today = todayISO();

  const tasks = useQuery(tasksQuery());
  const projects = useQuery(projectsQuery());
  const habits = useQuery(habitsQuery());
  const logs = useQuery(habitLogsQuery());

  const toggleHabit = useMutation({
    mutationFn: async ({ habitId, done }: { habitId: string; done: boolean }) =>
      done ? unlogHabit(habitId, today) : logHabit(habitId, today),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: habitKeys.logs }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update habit."),
  });

  const isLoading =
    tasks.isLoading || projects.isLoading || habits.isLoading || logs.isLoading;
  const error = tasks.error ?? projects.error ?? habits.error ?? logs.error;

  const todaysTasks = filterTasks(tasks.data ?? [], "today");
  const activeHabits = (habits.data ?? []).filter((h) => h.active);
  const todaysLogs = new Set(
    (logs.data ?? []).filter((l) => l.log_date === today).map((l) => l.habit_id),
  );

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={format(new Date(), "EEEE, d MMMM yyyy")}
        actions={
          <>
            <Button asChild size="sm">
              <Link to="/tasks">New task</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/projects">New project</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/notes">New note</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/habits">Log habit</Link>
            </Button>
          </>
        }
      />

      {isLoading ? (
        <LoadingState rows={4} />
      ) : error ? (
        <ErrorState
          error={error}
          onRetry={() => {
            tasks.refetch();
            projects.refetch();
            habits.refetch();
            logs.refetch();
          }}
        />
      ) : (
        <div className="space-y-10">
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Active projects"
              value={(projects.data ?? []).filter((p) => p.status === "active").length}
            />
            <StatCard label="Open tasks" value={(tasks.data ?? []).filter(isOpen).length} />
            <StatCard
              label="Completed tasks"
              value={(tasks.data ?? []).filter((t) => t.status === "completed").length}
            />
            <StatCard label="Active habits" value={activeHabits.length} />
          </section>

          <section>
            <h2 className="mb-3 text-sm font-medium text-foreground">Today's tasks</h2>
            {todaysTasks.length === 0 ? (
              <EmptyState
                title="Nothing due today"
                description="Tasks with today's due date will appear here."
                action={
                  <Button asChild size="sm" variant="outline">
                    <Link to="/tasks">Go to tasks</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                {todaysTasks.map((task) => (
                  <li key={task.id} className="px-4 py-3 text-sm">
                    {task.title}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-sm font-medium text-foreground">Today's habits</h2>
            {activeHabits.length === 0 ? (
              <EmptyState
                title="No active habits"
                description="Create a habit to start tracking it daily."
                action={
                  <Button asChild size="sm" variant="outline">
                    <Link to="/habits">Go to habits</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                {activeHabits.map((habit) => {
                  const done = todaysLogs.has(habit.id);
                  return (
                    <li key={habit.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                      <Checkbox
                        checked={done}
                        aria-label={`Mark ${habit.name} for today`}
                        onCheckedChange={() =>
                          toggleHabit.mutate({ habitId: habit.id, done })
                        }
                      />
                      <span className={done ? "text-muted-foreground line-through" : ""}>
                        {habit.name}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </>
  );
}
