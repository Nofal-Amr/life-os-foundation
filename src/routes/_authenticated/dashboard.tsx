import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckSquare,
  LayoutDashboard,
  Moon,
  Sparkles,
  Sun,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { capabilitiesQuery } from "@/data/capabilities";
import { evidenceQuery } from "@/data/evidence";
import { goalsQuery } from "@/data/goals";
import { profileQuery } from "@/data/profile";
import { projectsQuery } from "@/data/projects";
import { isOpen, tasksQuery, type Task } from "@/data/tasks";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "System Dashboard — Life OS" },
      { name: "description", content: "Your focused Life OS system briefing." },
      { property: "og:title", content: "System Dashboard — Life OS" },
      { property: "og:description", content: "Your focused Life OS system briefing." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});

const PRIORITY_WEIGHT: Record<Task["priority"], number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function sortDirectives(a: Task, b: Task) {
  if (a.due_date && b.due_date && a.due_date !== b.due_date) {
    return a.due_date.localeCompare(b.due_date);
  }
  if (a.due_date && !b.due_date) return -1;
  if (!a.due_date && b.due_date) return 1;
  return PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
}

function dueLabel(value: string | null) {
  if (!value) return null;
  const date = parseISO(value);
  if (isToday(date)) return "Due today";
  if (isTomorrow(date)) return "Due tomorrow";
  return `Due ${format(date, "d MMM")}`;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function SystemLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </p>
  );
}

function DashboardPage() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const tasks = useQuery(tasksQuery());
  const projects = useQuery(projectsQuery());
  const goals = useQuery(goalsQuery());
  const capabilities = useQuery(capabilitiesQuery());
  const evidence = useQuery(evidenceQuery());
  const profile = useQuery(profileQuery());

  const openTasks = (tasks.data ?? []).filter(isOpen).sort(sortDirectives);
  const directive = openTasks[0];
  const upNext = openTasks.slice(1, 4);
  const projectById = new Map((projects.data ?? []).map((project) => [project.id, project]));
  const goalById = new Map((goals.data ?? []).map((goal) => [goal.id, goal]));
  const evidenceCounts = new Map<string, number>();
  for (const item of evidence.data ?? []) {
    if (item.capability_id) {
      evidenceCounts.set(item.capability_id, (evidenceCounts.get(item.capability_id) ?? 0) + 1);
    }
  }
  const topCapability = [...(capabilities.data ?? [])]
    .filter((capability) => (evidenceCounts.get(capability.id) ?? 0) > 0)
    .sort((a, b) => (evidenceCounts.get(b.id) ?? 0) - (evidenceCounts.get(a.id) ?? 0))[0];
  const topEvidenceCount = topCapability ? evidenceCounts.get(topCapability.id) ?? 0 : 0;
  const linkedEvidenceTotal = [...evidenceCounts.values()].reduce((sum, count) => sum + count, 0);
  const capabilityShare = linkedEvidenceTotal ? (topEvidenceCount / linkedEvidenceTotal) * 100 : 0;
  const displayName = profile.data?.display_name?.trim() || user?.email?.split("@")[0] || "there";
  const firstName = displayName.split(/\s+/)[0];
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const loading = tasks.isLoading || projects.isLoading || goals.isLoading || capabilities.isLoading || evidence.isLoading;
  const error = tasks.error ?? projects.error ?? goals.error ?? capabilities.error ?? evidence.error;

  return (
    <div className="system-canvas min-h-screen px-4 pb-28 pt-5 sm:px-6 lg:px-10 lg:pt-7">
      <div className="mx-auto max-w-6xl">
        <header>
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <span className="size-2 rounded-full bg-primary shadow-[0_0_0_5px_color-mix(in_oklab,var(--color-primary)_12%,transparent)]" />
              <span className="text-sm font-bold uppercase tracking-[0.16em] text-foreground">Life OS</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="rounded-full bg-card"
                aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                onClick={toggleTheme}
              >
                {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </Button>
              <div
                className="flex size-9 items-center justify-center rounded-full border border-border bg-card text-xs font-semibold text-foreground"
                aria-label={`Signed in as ${displayName}`}
                title={displayName}
              >
                {initials || "LO"}
              </div>
            </div>
          </div>
          <div className="py-9 sm:py-12">
            <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, d MMMM yyyy")}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-foreground sm:text-4xl">
              {greeting()}, {firstName}
            </h1>
          </div>
        </header>

        {loading ? (
          <div className="system-card p-8 text-sm text-muted-foreground">Preparing your briefing…</div>
        ) : error ? (
          <div className="system-card p-8">
            <p className="font-medium text-foreground">Your briefing could not be loaded.</p>
            <Button className="mt-4" onClick={() => window.location.reload()}>Try again</Button>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(19rem,0.8fr)]">
            <section className="system-card relative overflow-hidden p-6 sm:p-8 lg:p-10">
              <div className="absolute inset-x-0 top-0 h-px bg-primary/70" />
              <SystemLabel>System Directive</SystemLabel>
              {directive ? (
                <>
                  <h2 className="mt-7 max-w-3xl text-3xl font-bold leading-tight tracking-normal text-foreground sm:text-4xl lg:text-5xl">
                    {directive.title}
                  </h2>
                  <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {directive.project_id && projectById.get(directive.project_id) ? (
                      <span className="rounded-full bg-accent px-3 py-1.5 font-medium text-accent-foreground">
                        {projectById.get(directive.project_id)?.name}
                      </span>
                    ) : null}
                    {directive.goal_id && goalById.get(directive.goal_id) ? (
                      <span className="rounded-full bg-secondary px-3 py-1.5 font-medium text-secondary-foreground">
                        {goalById.get(directive.goal_id)?.name}
                      </span>
                    ) : null}
                    {directive.due_date ? <span className="ml-1 font-medium">{dueLabel(directive.due_date)}</span> : null}
                  </div>
                  {directive.description ? (
                    <div className="mt-9 border-l-2 border-[var(--system-tertiary)] pl-4">
                      <SystemLabel>Strategic Rationale</SystemLabel>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{directive.description}</p>
                    </div>
                  ) : null}
                  {directive.due_date ? (
                    <p className="mt-7 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      Stakes <span className="ml-2 normal-case tracking-normal text-foreground">{dueLabel(directive.due_date)}</span>
                    </p>
                  ) : null}
                  <div className="mt-9 flex flex-wrap gap-3">
                    <Button asChild className="rounded-lg shadow-[0_0_20px_var(--color-accent)]">
                      <Link to="/tasks" hash={directive.id}>Initiate Directive <ArrowRight className="size-4" /></Link>
                    </Button>
                    <Button asChild variant="outline" className="rounded-lg bg-card">
                      <Link to="/tasks" hash={directive.id}>View Details</Link>
                    </Button>
                  </div>
                </>
              ) : (
                <div className="py-16 sm:py-24">
                  <h2 className="text-2xl font-semibold tracking-normal text-foreground">The system is clear.</h2>
                  <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">Create a task when you are ready to set the next directive.</p>
                  <Button asChild className="mt-6 rounded-lg"><Link to="/tasks">Create a task</Link></Button>
                </div>
              )}
            </section>

            <div className="grid gap-5">
              <section className="system-card p-6">
                <SystemLabel>System Observation</SystemLabel>
                <div className="mt-7 flex items-start gap-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <Sparkles className="size-4" />
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    The System needs more activity before it can surface patterns.
                  </p>
                </div>
              </section>

              <section className="system-card p-6">
                <SystemLabel>Capability Readout</SystemLabel>
                {topCapability ? (
                  <div className="mt-7">
                    <h2 className="text-xl font-semibold tracking-normal text-foreground">{topCapability.name}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      <span className="font-semibold text-primary">{topEvidenceCount}</span>{" "}
                      verified evidence {topEvidenceCount === 1 ? "event" : "events"}
                    </p>
                    <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${capabilityShare}%` }} />
                    </div>
                  </div>
                ) : (
                  <p className="mt-7 text-sm leading-6 text-muted-foreground">
                    Complete linked tasks to build a verified capability readout.
                  </p>
                )}
              </section>
            </div>

            <section className="lg:col-span-2">
              <div className="mb-3 flex items-center justify-between">
                <SystemLabel>Up Next</SystemLabel>
                <Link to="/tasks" className="text-xs font-medium text-primary hover:underline">View all tasks</Link>
              </div>
              {upNext.length ? (
                <div className="system-card divide-y divide-border overflow-hidden">
                  {upNext.map((task, index) => (
                    <Link key={task.id} to="/tasks" className="group grid gap-3 p-4 transition-colors hover:bg-accent/50 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-center sm:px-6">
                      <span className="text-xs font-semibold text-muted-foreground">0{index + 1}</span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                        {task.project_id && projectById.get(task.project_id) ? (
                          <p className="mt-1 truncate text-xs text-muted-foreground">{projectById.get(task.project_id)?.name}</p>
                        ) : null}
                      </div>
                      {task.due_date ? <span className="text-xs font-medium text-muted-foreground">{dueLabel(task.due_date)}</span> : null}
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="system-card p-6 text-sm text-muted-foreground">No other incomplete tasks are waiting.</div>
              )}
            </section>
          </div>
        )}
      </div>

      <nav aria-label="Dashboard navigation" className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 rounded-2xl border border-border bg-card/80 p-1.5 shadow-lg backdrop-blur-xl">
        <div className="flex items-center gap-1">
          {[
            { to: "/dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
            { to: "/projects" as const, label: "Projects", icon: BriefcaseBusiness },
            { to: "/tasks" as const, label: "Tasks", icon: CheckSquare },
            { to: "/capabilities" as const, label: "Capabilities", icon: Sparkles },
          ].map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} aria-label={label} title={label} className="flex size-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[status=active]:bg-accent data-[status=active]:text-primary">
              <Icon className="size-4" />
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}