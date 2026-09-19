import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { isToday, parseISO } from "date-fns";
import {
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardPlus,
  HeartPulse,
  ListTodo,
  Plus,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { QuickAddTaskDialog } from "@/components/app/QuickAddTask";
import { QuickAddTransactionDialog } from "@/components/app/QuickAddTransaction";
import { EntityIcon } from "@/components/app/EntityIdentity";
import { SemanticBadge } from "@/components/app/SemanticBadge";
import { ErrorState, LoadingState } from "@/components/app/States";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  accountsQuery,
  daysUntil,
  hasPaydaySetup,
  liquidBalance,
  nextPayday,
  paydayConfigQuery,
  recurringCostsQuery,
  transactionsQuery,
} from "@/data/finance";
import {
  healthLogsQuery,
  medicationLogsQuery,
  medicationsQuery,
} from "@/data/health";
import { DEFAULT_DIMENSION_ORDER, preferencesQuery } from "@/data/preferences";
import { profileQuery } from "@/data/profile";
import { projectsQuery } from "@/data/projects";
import {
  PRAYER_LABELS,
  PRAYER_NAMES,
  clearPrayerLog,
  logPrayer,
  prayerLogsQuery,
  prayerSettingsQuery,
  spiritKeys,
  type PrayerName,
} from "@/data/spirit";
import { isOpen, tasksQuery, type Task } from "@/data/tasks";
import { usePreferences } from "@/hooks/usePreferences";
import { todayISO } from "@/lib/date";
import { prayerTimesFor } from "@/lib/prayer";
import { priorityLabel, priorityTone } from "@/lib/semantics";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Today — Life OS" },
      { name: "description", content: "Today’s tasks, prayers, money, health, and upcoming commitments." },
      { property: "og:title", content: "Today — Life OS" },
      { property: "og:description", content: "Today’s tasks, prayers, money, health, and upcoming commitments." },
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

function sortNextUp(a: Task, b: Task) {
  const byPriority = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
  if (byPriority !== 0) return byPriority;
  if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
  if (a.due_date) return -1;
  if (b.due_date) return 1;
  return a.created_at.localeCompare(b.created_at);
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

type ComingUpItem = {
  id: string;
  dimension: string;
  sortValue: string;
  title: string;
  detail: string;
  to: "/tasks" | "/finance/recurring" | "/health";
};

function SectionHeading({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="min-w-0">
      <h2 className="text-lg font-semibold text-foreground sm:text-xl">{title}</h2>
      {detail ? <p className="mt-1 text-sm text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

function DashboardPage() {
  const queryClient = useQueryClient();
  const { fmtLongDate, fmtDate, fmtTime, fmtSlot, fmtMoney } = usePreferences();
  const today = todayISO();

  const tasks = useQuery(tasksQuery());
  const prayerSettings = useQuery(prayerSettingsQuery());
  const prayerLogs = useQuery(prayerLogsQuery());
  const accounts = useQuery(accountsQuery());
  const transactions = useQuery(transactionsQuery());
  const recurring = useQuery(recurringCostsQuery());
  const paydayConfig = useQuery(paydayConfigQuery());
  const healthLogs = useQuery(healthLogsQuery());
  const medications = useQuery(medicationsQuery());
  const medicationLogs = useQuery(medicationLogsQuery());
  const preferences = useQuery(preferencesQuery());
  const profile = useQuery(profileQuery());
  const projects = useQuery(projectsQuery());

  const [quickTask, setQuickTask] = useState(false);
  const [quickMoney, setQuickMoney] = useState(false);

  const onError = (error: unknown) =>
    toast.error(error instanceof Error ? error.message : "Something went wrong.");

  const setPrayer = useMutation({
    mutationFn: (input: { prayer_name: PrayerName; on_time: boolean | null }) =>
      logPrayer({ prayer_date: today, completed: true, ...input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: spiritKeys.logs }),
    onError,
  });

  const unsetPrayer = useMutation({
    mutationFn: (prayer_name: PrayerName) => clearPrayerLog(today, prayer_name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: spiritKeys.logs }),
    onError,
  });

  const queries = [
    tasks,
    prayerSettings,
    prayerLogs,
    accounts,
    transactions,
    recurring,
    paydayConfig,
    healthLogs,
    medications,
    medicationLogs,
    preferences,
    profile,
    projects,
  ];
  const loading = queries.some((query) => query.isLoading);
  const error = queries.find((query) => query.error)?.error;

  const openTasks = [...(tasks.data ?? [])].filter(isOpen).sort(sortNextUp).slice(0, 3);
  const todayPrayerLogs = (prayerLogs.data ?? []).filter(
    (log) => log.prayer_date === today && log.completed,
  );
  const prayerConfig = prayerSettings.data;
  const hasPrayerLocation = prayerConfig?.latitude != null && prayerConfig?.longitude != null;
  const prayerTimes = hasPrayerLocation
    ? prayerTimesFor(
        Number(prayerConfig.latitude),
        Number(prayerConfig.longitude),
        prayerConfig.calc_method,
        prayerConfig.asr_school,
        today,
      )
    : null;
  const nextPrayer = prayerTimes ? String(prayerTimes.nextPrayer()).toLowerCase() : null;

  const balance = liquidBalance(accounts.data ?? [], transactions.data ?? []);
  const payday = nextPayday(paydayConfig.data);
  const paydayReady = hasPaydaySetup(paydayConfig.data);
  const todayHealth = (healthLogs.data ?? []).find((log) => log.log_date === today);

  const dimensionOrder = preferences.data?.dimension_order?.length
    ? preferences.data.dimension_order
    : DEFAULT_DIMENSION_ORDER;
  const dimensionRank = new Map(dimensionOrder.map((dimension, index) => [dimension, index]));
  const comingUp: ComingUpItem[] = [];

  for (const task of tasks.data ?? []) {
    if (!isOpen(task) || !task.due_date || (task.due_date !== today && task.due_date !== new Date(Date.now() + 86_400_000).toISOString().slice(0, 10))) continue;
    comingUp.push({
      id: `task-${task.id}`,
      dimension: "discipline",
      sortValue: task.due_date,
      title: task.title,
      detail: task.due_date === today ? "Task · Due today" : "Task · Due tomorrow",
      to: "/tasks",
    });
  }

  if (payday) {
    for (const cost of recurring.data ?? []) {
      if (!cost.active || parseISO(cost.next_due_date) > payday) continue;
      comingUp.push({
        id: `cost-${cost.id}`,
        dimension: "professional",
        sortValue: cost.next_due_date,
        title: cost.name,
        detail: `Recurring cost · ${fmtMoney(Number(cost.amount))} · ${fmtDate(cost.next_due_date)}`,
        to: "/finance/recurring",
      });
    }
  }

  const todayDoseKeys = new Set(
    (medicationLogs.data ?? [])
      .filter((log) => log.log_date === today && log.taken)
      .map((log) => `${log.medication_id}-${log.time_slot}`),
  );
  for (const medication of medications.data ?? []) {
    if (!medication.active) continue;
    for (const slot of medication.schedule_times ?? []) {
      if (todayDoseKeys.has(`${medication.id}-${slot}`)) continue;
      comingUp.push({
        id: `med-${medication.id}-${slot}`,
        dimension: "health",
        sortValue: `${today}T${slot}`,
        title: medication.name,
        detail: `Medication · ${fmtSlot(slot)}`,
        to: "/health",
      });
    }
  }
  comingUp.sort((a, b) => {
    const byDimension = (dimensionRank.get(a.dimension) ?? 99) - (dimensionRank.get(b.dimension) ?? 99);
    return byDimension || a.sortValue.localeCompare(b.sortValue);
  });

  const completedTasksToday = (tasks.data ?? []).filter(
    (task) => task.completed_at && isToday(new Date(task.completed_at)),
  ).length;
  const expensesToday = (transactions.data ?? []).filter(
    (transaction) => transaction.date === today && transaction.kind === "expense",
  ).length;
  const todayCounts = [
    { label: "tasks completed", value: completedTasksToday },
    { label: "prayers logged", value: todayPrayerLogs.length },
    { label: "expenses logged", value: expensesToday },
    { label: "health entries", value: todayHealth ? 1 : 0 },
  ].filter((item) => item.value > 0);

  const displayName = profile.data?.display_name?.trim();
  const firstName = displayName?.split(/\s+/)[0];

  function scrollToPrayers() {
    document.getElementById("today-prayers")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="min-w-0">
      <div className="w-full min-w-0">
        <header>
          <div className="pb-8 sm:pb-10">
            <p className="text-sm text-muted-foreground">{fmtLongDate(new Date())}</p>
            <h1 className="mt-2 text-3xl font-semibold text-foreground sm:text-4xl">
              {greeting()}{firstName ? `, ${firstName}` : ""}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">Here is what is true today.</p>
          </div>
        </header>

        {loading ? (
          <LoadingState rows={6} />
        ) : error ? (
          <ErrorState error={error} onRetry={() => queries.forEach((query) => query.refetch())} />
        ) : (
          <main className="min-w-0 space-y-5">
            <Card id="today-prayers" className="system-card scroll-mt-5">
              <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 space-y-0">
                <SectionHeading
                  title="Today’s prayers"
                  detail={hasPrayerLocation ? `${todayPrayerLogs.length} of 5 recorded${prayerConfig?.city ? ` · ${prayerConfig.city}` : ""}` : "Add your location once to calculate today’s times."}
                />
                <Button asChild variant="ghost" size="sm" className="shrink-0">
                  <Link to={hasPrayerLocation ? "/spirit" : "/settings"}>
                    {hasPrayerLocation ? "Open Spirit" : "Set up"}
                    <ChevronRight className="size-4" />
                  </Link>
                </Button>
              </CardHeader>
              {hasPrayerLocation ? (
                <CardContent>
                  <div className="grid min-w-0 gap-2 sm:grid-cols-5">
                    {PRAYER_NAMES.map((name) => {
                      const log = todayPrayerLogs.find((item) => item.prayer_name === name);
                      const marked = Boolean(log);
                      const time = prayerTimes ? (prayerTimes[name] as Date) : null;
                      return (
                        <div key={name} className="min-w-0 rounded-lg border border-border bg-card">
                          <Button
                            type="button"
                            variant="ghost"
                            aria-pressed={marked}
                            className={`h-auto min-h-16 w-full min-w-0 justify-between gap-2 rounded-lg px-3 py-3 sm:flex-col sm:items-start ${marked ? "tone-positive" : ""}`}
                            onClick={() => marked ? unsetPrayer.mutate(name) : setPrayer.mutate({ prayer_name: name, on_time: null })}
                          >
                            <span className="min-w-0 text-left">
                              <span className="block truncate text-sm font-medium">{PRAYER_LABELS[name]}</span>
                              <span className="mt-0.5 block text-xs tabular-nums opacity-75">{time ? fmtTime(time) : "—"}</span>
                            </span>
                            <span className="flex shrink-0 items-center gap-1 text-xs">
                              {marked ? <Check className="size-3.5" /> : null}
                              {marked ? "Prayed" : nextPrayer === name ? "Next" : "Log"}
                            </span>
                          </Button>
                          {marked ? (
                            <div className="grid grid-cols-2 gap-1 border-t border-border p-1">
                              <Button
                                type="button"
                                size="sm"
                                variant={log?.on_time === true ? "secondary" : "ghost"}
                                aria-pressed={log?.on_time === true}
                                className="h-9 px-2 text-xs"
                                onClick={() => setPrayer.mutate({ prayer_name: name, on_time: log?.on_time === true ? null : true })}
                              >
                                On time
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant={log?.on_time === false ? "secondary" : "ghost"}
                                aria-pressed={log?.on_time === false}
                                className="h-9 px-2 text-xs"
                                onClick={() => setPrayer.mutate({ prayer_name: name, on_time: log?.on_time === false ? null : false })}
                              >
                                Later
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              ) : null}
            </Card>

            <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
              <Card className="system-card min-w-0">
                <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 space-y-0">
                  <SectionHeading title="Next up" detail="Up to three open tasks, highest priority first." />
                  <Button type="button" size="sm" className="shrink-0" onClick={() => setQuickTask(true)}>
                    <Plus className="size-4" />
                    <span className="hidden sm:inline">Add task</span>
                  </Button>
                </CardHeader>
                <CardContent>
                  {openTasks.length ? (
                    <div className="divide-y divide-border">
                      {openTasks.map((task) => (
                        <Link
                          key={task.id}
                          to="/tasks"
                          className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-4 first:pt-0 last:pb-0"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                            {task.project_id ? (() => { const project = (projects.data ?? []).find((item) => item.id === task.project_id); return project ? <span className="mt-1 inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"><EntityIcon icon={project.icon} color={project.color} containerClassName="size-5 rounded" className="size-3" /><span className="truncate">{project.name}</span></span> : null; })() : null}
                            {task.due_date ? <p className="mt-1 text-xs text-muted-foreground">Due {fmtDate(task.due_date)}</p> : null}
                          </div>
                          <SemanticBadge tone={priorityTone(task.priority)} className="shrink-0">
                            {priorityLabel(task.priority)}
                          </SemanticBadge>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="flex min-w-0 items-center justify-between gap-4 rounded-lg border border-dashed border-border p-4">
                      <p className="min-w-0 text-sm text-muted-foreground">No open tasks right now.</p>
                      <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setQuickTask(true)}>Add one</Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="system-card min-w-0">
                <CardHeader>
                  <SectionHeading title="Money" detail="Across active non-credit accounts." />
                </CardHeader>
                <CardContent>
                  <p className="break-words text-3xl font-semibold tabular-nums text-foreground">{fmtMoney(balance)}</p>
                  {paydayReady && payday ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Payday in {daysUntil(payday)} {daysUntil(payday) === 1 ? "day" : "days"} · {fmtDate(payday.toISOString().slice(0, 10))}
                    </p>
                  ) : (
                    <Button asChild variant="outline" className="mt-4">
                      <Link to="/settings">Set up payday</Link>
                    </Button>
                  )}
                  <Button asChild variant="ghost" className="mt-3 px-0 text-primary">
                    <Link to="/finance">Open Money <ChevronRight className="size-4" /></Link>
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(17rem,0.8fr)]">
              <Card className="system-card min-w-0">
                <CardHeader>
                  <SectionHeading title="Coming up" detail="Due soon across your saved priorities." />
                </CardHeader>
                <CardContent>
                  {comingUp.length ? (
                    <div className="divide-y divide-border">
                      {comingUp.slice(0, 6).map((item) => (
                        <Link key={item.id} to={item.to} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 first:pt-0 last:pb-0">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                            <p className="mt-1 truncate text-xs text-muted-foreground">{item.detail}</p>
                          </div>
                          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nothing due soon.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="system-card min-w-0">
                <CardHeader>
                  <SectionHeading title="Health" detail="Today’s personal log." />
                </CardHeader>
                <CardContent>
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`grid size-10 shrink-0 place-items-center rounded-full ${todayHealth ? "tone-positive" : "tone-neutral"}`}>
                      {todayHealth ? <CheckCircle2 className="size-5" /> : <HeartPulse className="size-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{todayHealth ? "Logged today" : "Nothing logged yet today"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Anything you skip stays empty.</p>
                    </div>
                  </div>
                  <Button asChild className="mt-5 w-full">
                    <Link to="/health">{todayHealth ? "Update today’s log" : "Log health"}</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card className="system-card min-w-0">
              <CardHeader>
                <SectionHeading title="Quick logs" detail="Common actions for today." />
              </CardHeader>
              <CardContent>
                <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4">
                  <Button type="button" variant="outline" className="h-14 min-w-0 justify-start" onClick={scrollToPrayers}>
                    <ClipboardPlus className="size-4 shrink-0" />
                    <span className="truncate">Log prayer</span>
                  </Button>
                  <Button type="button" variant="outline" className="h-14 min-w-0 justify-start" onClick={() => setQuickMoney(true)}>
                    <CircleDollarSign className="size-4 shrink-0" />
                    <span className="truncate">Log expense</span>
                  </Button>
                  <Button asChild variant="outline" className="h-14 min-w-0 justify-start">
                    <Link to="/health"><HeartPulse className="size-4 shrink-0" /><span className="truncate">Log health</span></Link>
                  </Button>
                  <Button type="button" variant="outline" className="h-14 min-w-0 justify-start" onClick={() => setQuickTask(true)}>
                    <ListTodo className="size-4 shrink-0" />
                    <span className="truncate">Add task</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="system-card min-w-0">
              <CardHeader>
                <SectionHeading title="Today so far" />
              </CardHeader>
              <CardContent>
                {todayCounts.length ? (
                  <div className="flex min-w-0 flex-wrap gap-2">
                    {todayCounts.map((item) => (
                      <SemanticBadge key={item.label} tone="positive" className="text-sm">
                        {item.value} {item.label}
                      </SemanticBadge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nothing logged yet today.</p>
                )}
              </CardContent>
            </Card>
          </main>
        )}
      </div>

      <QuickAddTransactionDialog open={quickMoney} onOpenChange={setQuickMoney} />
      <QuickAddTaskDialog open={quickTask} onOpenChange={setQuickTask} />
    </div>
  );
}