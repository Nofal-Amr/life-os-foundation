import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { isToday, parseISO } from "date-fns";
import {
  Check,
  Gauge,
  HeartPulse,
  Info,
  Moon,
  Pill,
  Utensils,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { MoneyBreakdownDialog, useAvailableBeforePayday } from "@/components/app/MoneyBreakdown";
import { QuickAddTaskDialog } from "@/components/app/QuickAddTask";
import { QuickAddTransactionDialog } from "@/components/app/QuickAddTransaction";
import { ShrinkItButton, ShrinkItDialog } from "@/components/app/ShrinkIt";

import { SemanticBadge } from "@/components/app/SemanticBadge";
import { ErrorState, LoadingState } from "@/components/app/States";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  accountsQuery,
  daysUntil,
  hasPaydaySetup,
  liquidBalance,
  nextPayday,
  paydayConfigQuery,
  previousPayday,
  recurringCostsQuery,
  transactionsQuery,
} from "@/data/finance";

import { dayTotals, foodLogsQuery } from "@/data/food";
import { goalsQuery } from "@/data/goals";
import {
  healthKeys,
  healthLogsQuery,
  medicationLogsQuery,
  medicationsQuery,
  setDoseTaken,
} from "@/data/health";

import { meterFacts, quotaFacts, resourceReadingsQuery, resourcesQuery } from "@/data/resources";

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
import {
  completeTask,
  estimateLabel,
  isOpen,
  notStartedYet,
  stepsOf,
  taskKeys,
  tasksQuery,
  topLevelTasks,
  type Task,
} from "@/data/tasks";
import { useModules } from "@/hooks/useModules";
import { usePreferences } from "@/hooks/usePreferences";
import { todayISO } from "@/lib/date";
import { prayerTimesFor } from "@/lib/prayer";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Today — Life OS" },
      { name: "description", content: "Your next action, plus a one-line look at prayers, money, body and what is coming up." },
      { property: "og:title", content: "Today — Life OS" },
      { property: "og:description", content: "Your next action, plus a one-line look at prayers, money, body and what is coming up." },
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

type NextAction = {
  item: Task;
  parent: Task;
  minutes: number | null;
  estimate: string;
};

function urgencyRank(task: Task, today: string) {
  if (task.due_date && task.due_date < today) return 0;
  if (task.due_date === today) return 1;
  return 2;
}

/**
 * Next actions come from open tasks. A task with open steps is represented by
 * its first open step, so the thing shown is always small enough to start.
 */
function nextActions(tasks: Task[], today: string): NextAction[] {
  const parents = topLevelTasks(tasks).filter(
    (task) => isOpen(task) && !notStartedYet(task, today),
  );
  const candidates = parents.map((parent) => {
    const step = stepsOf(tasks, parent.id).find(isOpen);
    const item = step ?? parent;
    return {
      item,
      parent,
      minutes: item.estimated_minutes ?? null,
      estimate: estimateLabel(item),
    };
  });

  return candidates.sort((a, b) => {
    const byUrgency = urgencyRank(a.parent, today) - urgencyRank(b.parent, today);
    if (byUrgency !== 0) return byUrgency;
    const byPriority = PRIORITY_WEIGHT[b.parent.priority] - PRIORITY_WEIGHT[a.parent.priority];
    if (byPriority !== 0) return byPriority;
    /* Unknown estimates are unknown, never treated as zero. */
    const aMin = a.minutes ?? Number.POSITIVE_INFINITY;
    const bMin = b.minutes ?? Number.POSITIVE_INFINITY;
    if (aMin !== bMin) return aMin - bMin;
    return a.parent.created_at.localeCompare(b.parent.created_at);
  });
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
  kind: "commitment" | "projection";
  to: "/tasks" | "/projects" | "/goals" | "/finance/recurring" | "/resources";
};

function SectionHeading({ title, detail }: { title: string; detail?: string | undefined }) {
  return (
    <div className="min-w-0">
      <h2 className="text-lg font-semibold text-foreground sm:text-xl">{title}</h2>
      {detail ? <p className="mt-1 text-sm text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

/**
 * Small filled / hollow segments. Purely a second reading of the count that is
 * already written in words next to it — never the only way to read the row.
 */
function Dots({ filled, total }: { filled: number; total: number }) {
  if (total <= 0) return null;
  return (
    <span aria-hidden="true" className="flex shrink-0 items-center gap-1">
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={`size-2 rounded-full ${index < filled ? "bg-foreground/70" : "border border-border"}`}
        />
      ))}
    </span>
  );
}

/**
 * The liquid balance split into the parts the user themselves defined: costs
 * already set up and falling due before payday, their chosen buffer, and what
 * is left. Every segment is also written out in text.
 */
function MoneySplitBar({
  committed,
  buffer,
  available,
  fmtMoney,
}: {
  committed: number;
  buffer: number;
  available: number;
  fmtMoney: (value: number) => string;
}) {
  const spendable = Math.max(available, 0);
  const total = committed + buffer + spendable;
  if (total <= 0) return null;
  const pct = (value: number) => `${(value / total) * 100}%`;
  return (
    <div className="mt-3 min-w-0">
      <div
        aria-hidden="true"
        className="flex h-2 w-full min-w-0 overflow-hidden rounded-full border border-border"
      >
        <span style={{ width: pct(committed) }} className="bg-foreground/55" />
        <span style={{ width: pct(buffer) }} className="bg-foreground/25" />
        <span style={{ width: pct(spendable) }} className="bg-primary/70" />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Committed {fmtMoney(committed)} · Buffer {fmtMoney(buffer)} ·{" "}
        {available >= 0
          ? `Left to spend ${fmtMoney(available)}`
          : `Short by ${fmtMoney(Math.abs(available))}`}
      </p>
    </div>
  );
}

const iso = (date: Date) => date.toISOString().slice(0, 10);

/** Elapsed time between the user's own two paydays. No score, just the dates. */
function PaydayLine({
  from,
  to,
  fmtDate,
}: {
  from: Date;
  to: Date;
  fmtDate: (value: string) => string;
}) {
  const span = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000));
  const elapsed = Math.min(
    span,
    Math.max(0, Math.round((Date.now() - from.getTime()) / 86_400_000)),
  );
  return (
    <div className="mt-3 min-w-0">
      <div aria-hidden="true" className="h-1 w-full overflow-hidden rounded-full bg-border">
        <span
          className="block h-full bg-foreground/40"
          style={{ width: `${(elapsed / span) * 100}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Day {elapsed} of {span} since {fmtDate(iso(from))} · next {fmtDate(iso(to))}
      </p>
    </div>
  );
}

/**
 * One line per area. Rows with something to show carry their controls inline;
 * rows with nothing logged collapse to a shorter, quieter single line.
 */
function StatusRow({
  icon: Icon,
  label,
  value,
  to,
  hash,
  linkLabel,
  action,
  aside,
  compact,
  children,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  to?: "/spirit" | "/finance" | "/health" | "/food" | "/resources";
  hash?: string;
  linkLabel?: string;
  action?: ReactNode;
  aside?: ReactNode;
  compact?: boolean;
  children?: ReactNode;
}) {
  if (compact) {
    return (
      <div className="flex min-h-11 min-w-0 flex-wrap items-center gap-x-2 gap-y-1 py-1.5">
        <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="min-w-0 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80">{label}</span> — {value}
        </p>
        {to ? (
          <Button
            asChild
            variant="link"
            size="sm"
            className="ml-auto h-auto min-h-11 px-1 text-xs text-muted-foreground"
          >
            <Link to={to} {...(hash ? { hash } : {})}>{linkLabel ?? `Open ${label}`}</Link>
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="min-w-0 py-4 first:pt-0 last:pb-0">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p className="min-w-0 truncate text-sm font-medium text-foreground">{label}</p>
            {aside}
          </div>
          <p className="mt-1 break-words text-sm text-muted-foreground">{value}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:justify-start">
          {action}
          {to ? (
            <Button asChild variant="ghost" size="sm" className="min-h-11">
              <Link to={to} {...(hash ? { hash } : {})}>
                {linkLabel ?? `Open ${label}`}
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
      {children}
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
  const goals = useQuery(goalsQuery());
  const foodLogs = useQuery(foodLogsQuery());
  const resources = useQuery(resourcesQuery());
  const resourceReadings = useQuery(resourceReadingsQuery());

  const [quickTask, setQuickTask] = useState(false);
  const [quickMoney, setQuickMoney] = useState(false);
  const [shrinkTask, setShrinkTask] = useState<Task | null>(null);

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

  const setDose = useMutation({
    mutationFn: (input: { medication_id: string; time_slot: string; taken: boolean }) =>
      setDoseTaken({ log_date: today, ...input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: healthKeys.medicationLogs }),
    onError,
  });


  /** Completing the shown action promotes the next one in place. */
  const finish = useMutation({
    mutationFn: (id: string) => completeTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      toast.success("Done.");
    },
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
    goals,
    foodLogs,
    resources,
    resourceReadings,
  ];

  const loading = queries.some((query) => query.isLoading);
  const error = queries.find((query) => query.error)?.error;

  const allTasks = tasks.data ?? [];
  const actions = nextActions(allTasks, today);
  const primary = actions[0];
  const alsoToday = actions.slice(1, 3);
  const overdueTasks = topLevelTasks(allTasks).filter(
    (task) => isOpen(task) && Boolean(task.due_date) && String(task.due_date) < today,
  ).length;

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
  const lastPayday = previousPayday(paydayConfig.data);
  const paydayReady = hasPaydaySetup(paydayConfig.data);
  const money = useAvailableBeforePayday();
  const { isEnabled } = useModules();
  const todayHealth = (healthLogs.data ?? []).find((log) => log.log_date === today);


  /* Food and resources: derived only from rows the user logged. */
  const todayFoodLogs = (foodLogs.data ?? []).filter((log) => log.log_date === today);
  const todayCalories = Math.round(dayTotals(todayFoodLogs).calories);

  const quotaAlerts = (resources.data ?? [])
    .filter((resource) => resource.active && resource.kind === "quota")
    .map((resource) => ({ resource, facts: quotaFacts(resource, resourceReadings.data ?? []) }))
    .filter((item) => item.facts?.runsOutBeforeCycleEnd === true);

  const meterCosts = (resources.data ?? [])
    .filter((resource) => resource.active && resource.kind === "meter")
    .map((resource) => ({ resource, facts: meterFacts(resource, resourceReadings.data ?? []) }))
    .filter((item) => item.facts?.cycleCost != null);

  const dimensionOrder = preferences.data?.dimension_order?.length
    ? preferences.data.dimension_order
    : DEFAULT_DIMENSION_ORDER;
  const dimensionRank = new Map(dimensionOrder.map((dimension, index) => [dimension, index]));

  const comingUp: ComingUpItem[] = [];
  const nextWeek = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

  for (const task of topLevelTasks(allTasks)) {
    if (!isOpen(task)) continue;
    const notStarted = notStartedYet(task, today);
    const marker = notStarted ? String(task.start_date) : task.due_date;
    if (!marker || marker > nextWeek) continue;
    comingUp.push({
      id: `task-${task.id}`,
      dimension: "discipline",
      sortValue: marker,
      title: task.title,
      detail: notStarted
        ? `Task · Starts ${fmtDate(String(task.start_date))}`
        : task.due_date === today
          ? "Task · Due today"
          : `Task · Due ${fmtDate(String(task.due_date))}`,
      kind: "commitment",
      to: "/tasks",
    });
  }

  for (const project of projects.data ?? []) {
    if (project.status === "archived" || project.status === "completed" || !project.due_date || project.due_date > nextWeek) continue;
    comingUp.push({
      id: `project-${project.id}`,
      dimension: "professional",
      sortValue: project.due_date,
      title: project.name,
      detail: `Project · Due ${fmtDate(project.due_date)}`,
      kind: "commitment",
      to: "/projects",

    });
  }

  for (const goal of goals.data ?? []) {
    if (goal.status === "completed" || !goal.target_date || goal.target_date > nextWeek) continue;
    comingUp.push({
      id: `goal-${goal.id}`,
      dimension: "knowledge",
      sortValue: goal.target_date,
      title: goal.name,
      detail: `Goal · Target ${fmtDate(goal.target_date)}`,
      kind: "commitment",
      to: "/goals",

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
        kind: "projection",
        to: "/finance/recurring",

      });
    }
  }

  for (const { resource, facts } of quotaAlerts) {
    if (!facts?.runsOutOn) continue;
    comingUp.push({
      id: `quota-${resource.id}`,
      dimension: "professional",
      sortValue: facts.runsOutOn,
      title: resource.name,
      detail: `Resource · ${Math.round(Number(facts.remaining) * 10) / 10} ${resource.unit} left · around ${fmtDate(facts.runsOutOn)}`,
      kind: "projection",
      to: "/resources",

    });
  }

  const takenDoseKeys = new Set(
    (medicationLogs.data ?? [])
      .filter((log) => log.log_date === today && log.taken)
      .map((log) => `${log.medication_id}-${log.time_slot}`),
  );
  const scheduledDoses = (medications.data ?? [])
    .filter((medication) => medication.active)
    .flatMap((medication) => (medication.schedule_times ?? []).map((slot) => ({ medication, slot })))
    .sort((a, b) => a.slot.localeCompare(b.slot));
  const dosesDue = scheduledDoses.filter(
    ({ medication, slot }) => !takenDoseKeys.has(`${medication.id}-${slot}`),
  );


  comingUp.sort((a, b) => {
    const byDimension = (dimensionRank.get(a.dimension) ?? 99) - (dimensionRank.get(b.dimension) ?? 99);
    return byDimension || a.sortValue.localeCompare(b.sortValue);
  });

  /* Only modules the user kept appear here. */
  const visibleComingUp = comingUp.filter((item) => {
    if (item.id.startsWith("cost-")) return isEnabled("money");
    if (item.id.startsWith("quota-")) return isEnabled("resources");
    return isEnabled("do");
  });

  const completedTasksToday = allTasks.filter(
    (task) => task.completed_at && isToday(new Date(task.completed_at)),
  ).length;
  const expensesToday = (transactions.data ?? []).filter(
    (transaction) => transaction.date === today && transaction.kind === "expense",
  ).length;
  const todayCounts = [
    { label: "tasks and steps completed", value: completedTasksToday },
    { label: "prayers logged", value: todayPrayerLogs.length },
    { label: "expenses logged", value: expensesToday },
    { label: "health entries", value: todayHealth ? 1 : 0 },
    { label: "food entries", value: todayFoodLogs.length },
  ].filter((item) => item.value > 0);

  const displayName = profile.data?.display_name?.trim();
  const firstName = displayName?.split(/\s+/)[0];

  const prayerRow = (
    <StatusRow
      key="spirit"
      icon={Moon}
      label="Prayers"
      value={
        hasPrayerLocation
          ? `${todayPrayerLogs.length} of 5 logged today${prayerConfig?.city ? ` · ${prayerConfig.city}` : ""}`
          : "Add your location once to see today’s times."
      }
      aside={hasPrayerLocation ? <Dots filled={todayPrayerLogs.length} total={5} /> : undefined}
      to="/spirit"
      linkLabel="Open Spirit"
      compact={!hasPrayerLocation}
    >
      {hasPrayerLocation ? (
        <div id="today-prayers" className="mt-3 grid min-w-0 grid-cols-5 gap-1.5 scroll-mt-5">
          {PRAYER_NAMES.map((name) => {
            const log = todayPrayerLogs.find((item) => item.prayer_name === name);
            const marked = Boolean(log);
            const time = prayerTimes ? (prayerTimes[name] as Date) : null;
            return (
              <Button
                key={name}
                type="button"
                variant="outline"
                aria-pressed={marked}
                aria-label={`${PRAYER_LABELS[name]}${marked ? " logged" : ""}`}
                className={`h-auto min-h-14 min-w-0 flex-col gap-0.5 px-1 py-2 ${marked ? "tone-positive" : ""}`}
                onClick={() =>
                  marked ? unsetPrayer.mutate(name) : setPrayer.mutate({ prayer_name: name, on_time: null })
                }
              >
                <span className="w-full truncate text-xs font-medium">{PRAYER_LABELS[name]}</span>
                <span className="w-full truncate text-[11px] tabular-nums opacity-75">
                  {time ? fmtTime(time) : "—"}
                </span>
                <span className="flex items-center gap-1 text-[11px]">
                  {marked ? <Check className="size-3" /> : null}
                  {marked ? "Prayed" : nextPrayer === name ? "Next" : "Log"}
                </span>
              </Button>
            );
          })}
        </div>
      ) : null}
    </StatusRow>
  );

  const medicationRow = (
    <StatusRow
      icon={Pill}
      label="Medication"
      value={
        scheduledDoses.length
          ? `${dosesDue.length} of ${scheduledDoses.length} scheduled ${scheduledDoses.length === 1 ? "entry remains" : "entries remain"} today`
          : "No medication times scheduled"
      }
      aside={
        scheduledDoses.length ? (
          <Dots filled={scheduledDoses.length - dosesDue.length} total={scheduledDoses.length} />
        ) : undefined
      }
      to="/health"
      hash="medications"
      linkLabel="Open medications"
      compact={!scheduledDoses.length}
    >
      {scheduledDoses.length ? (
        <div className="mt-3 grid min-w-0 grid-cols-2 gap-1.5 sm:grid-cols-3">
          {scheduledDoses.map(({ medication, slot }) => {
            const taken = takenDoseKeys.has(`${medication.id}-${slot}`);
            return (
              <Button
                key={`${medication.id}-${slot}`}
                type="button"
                variant="outline"
                aria-pressed={taken}
                aria-label={`${medication.name} at ${fmtSlot(slot)}${taken ? " taken" : " not taken"}`}
                className={`h-auto min-h-14 min-w-0 flex-col items-start gap-0.5 px-2 py-2 text-left ${taken ? "tone-positive" : ""}`}
                disabled={setDose.isPending}
                onClick={() =>
                  setDose.mutate({
                    medication_id: medication.id,
                    time_slot: slot,
                    taken: !taken,
                  })
                }
              >
                <span className="w-full truncate text-xs font-medium">
                  {medication.name}
                  {medication.dosage ? (
                    <span className="ml-1 font-normal opacity-75">{medication.dosage}</span>
                  ) : null}
                </span>
                <span className="w-full truncate text-[11px] tabular-nums opacity-75">
                  {fmtSlot(slot)}
                </span>
                <span className="flex items-center gap-1 text-[11px]">
                  {taken ? <Check className="size-3" /> : null}
                  {taken ? "Taken" : "Not taken"}
                </span>
              </Button>
            );
          })}
        </div>
      ) : null}
    </StatusRow>
  );

  const bodyRows = (
    <div key="health" className="min-w-0 divide-y divide-border/60">
      {isEnabled("body") ? medicationRow : null}
      {isEnabled("body") ? (
      <StatusRow
        icon={HeartPulse}
        label="Health log"
        value={todayHealth ? "Logged today" : "Nothing logged yet today"}
        to="/health"
        hash="daily-log"
        linkLabel={todayHealth ? "Open today’s log" : "Log health"}
        compact={!todayHealth}
      />
      ) : null}
      {isEnabled("food") ? (
      <StatusRow
        icon={Utensils}
        label="Calories"
        value={
          todayFoodLogs.length
            ? `${todayCalories} kcal logged today`
            : "No food logged yet today"
        }
        to="/food"
        linkLabel={todayFoodLogs.length ? "Open Food" : "Log food"}
        compact={!todayFoodLogs.length}
      />
      ) : null}
    </div>
  );

  const moneyRow = (
    <StatusRow
      key="money"
      icon={Wallet}
      label="Money"
      value={
        paydayReady && payday
          ? `${fmtMoney(balance)} now · payday in ${daysUntil(payday)} ${daysUntil(payday) === 1 ? "day" : "days"}`
          : `${fmtMoney(balance)} now · payday not set up yet`
      }
      to="/finance"
      linkLabel="Open Money"
      action={
        paydayReady && payday ? (
          <MoneyBreakdownDialog
            trigger={
              <Button type="button" variant="outline" size="sm" className="min-h-11">
                <Info className="size-4" />
                <span>Left before payday</span>
              </Button>
            }
          />
        ) : (
          <Button asChild variant="outline" size="sm" className="min-h-11">
            <Link to="/settings">Set up payday</Link>
          </Button>
        )
      }
    >
      {paydayReady && payday ? (
        <>
          <MoneySplitBar
            committed={money.committed}
            buffer={money.buffer}
            available={money.available}
            fmtMoney={fmtMoney}
          />
          {lastPayday ? (
            <PaydayLine from={lastPayday} to={payday} fmtDate={fmtDate} />
          ) : null}
        </>
      ) : null}
    </StatusRow>
  );

  const resourceRows =
    quotaAlerts.length || meterCosts.length ? (
      <div key="resources" className="min-w-0 divide-y divide-border/60">
        {quotaAlerts.map(({ resource, facts }) => (
          <StatusRow
            key={resource.id}
            icon={Gauge}
            label={resource.name}
            value={`${Math.round(Number(facts!.remaining) * 10) / 10} ${resource.unit} left${facts!.runsOutOn ? ` · around ${fmtDate(facts!.runsOutOn)}` : ""}`}
            to="/resources"
            linkLabel="Open Resources"
          />
        ))}
        {meterCosts.map(({ resource, facts }) => (
          <StatusRow
            key={resource.id}
            icon={Gauge}
            label={resource.name}
            value={`This cycle so far ${fmtMoney(facts!.cycleCost)}${facts!.projectedCycleCost == null ? "" : ` · projected ${fmtMoney(facts!.projectedCycleCost)}`}`}
            to="/resources"
            linkLabel="Open Resources"
          />
        ))}
      </div>
    ) : null;

  /* Prayers are the daily anchor and stay first; the rest follows the saved order. */
  const strips: { dimension: string; node: ReactNode }[] = [
    ...(isEnabled("body") || isEnabled("food")
      ? [{ dimension: "health", node: bodyRows }]
      : []),
    ...(isEnabled("money") ? [{ dimension: "professional", node: moneyRow }] : []),
    ...(isEnabled("resources") ? [{ dimension: "professional", node: resourceRows }] : []),
  ].filter((strip) => strip.node != null);

  strips.sort(
    (a, b) => (dimensionRank.get(a.dimension) ?? 99) - (dimensionRank.get(b.dimension) ?? 99),
  );
  if (isEnabled("spirit")) strips.unshift({ dimension: "spirit", node: prayerRow });


  function ActionBlock({ action, large }: { action: NextAction; large?: boolean }) {
    const isStep = action.item.id !== action.parent.id;
    return (
      <div className="min-w-0">
        {isStep ? (
          <p className="truncate text-xs text-muted-foreground">{action.parent.title}</p>
        ) : null}
        <p
          className={`mt-1 break-words font-semibold text-foreground ${large ? "text-2xl sm:text-3xl" : "text-base"}`}
        >
          {action.item.title}
          {action.minutes ? (
            <span className="ml-2 text-base font-normal text-muted-foreground">
              · {action.estimate}
            </span>
          ) : null}
        </p>
        {(action.parent.postponed_count ?? 0) >= 3 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Moved {action.parent.postponed_count} times
            {action.parent.original_due_date ? ` since ${fmtDate(action.parent.original_due_date)}` : ""}.
          </p>
        ) : null}
        <div className={`mt-4 flex flex-wrap gap-2 ${large ? "" : "gap-2"}`}>
          <Button
            type="button"
            size={large ? "lg" : "default"}
            className={large ? "min-w-40" : ""}
            disabled={finish.isPending}
            onClick={() => finish.mutate(action.item.id)}
          >
            <Check className="size-4" />
            Done
          </Button>
          <ShrinkItButton
            size={large ? "default" : "sm"}
            onClick={() => setShrinkTask(action.parent)}
          />
          <Button asChild variant="ghost" size={large ? "default" : "sm"}>
            <Link to="/tasks" hash={action.parent.id}>
              Open task
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="w-full min-w-0">
        <header className="pb-5">
          <p className="text-sm text-muted-foreground">
            {fmtLongDate(new Date())} · {greeting()}
            {firstName ? `, ${firstName}` : ""}
          </p>
        </header>

        {loading ? (
          <LoadingState rows={6} />
        ) : error ? (
          <ErrorState error={error} onRetry={() => queries.forEach((query) => query.refetch())} />
        ) : (
          <main className="flex min-w-0 flex-col gap-10">
            {/* Zone 1 — the one thing to do. */}
            {isEnabled("do") ? (
            <section className="min-w-0">
              <Card className="system-card min-w-0 border-primary/30">
                <CardHeader>
                  <SectionHeading
                    title="Next action"
                    detail={overdueTasks ? `${overdueTasks} open ${overdueTasks === 1 ? "task is" : "tasks are"} past their date.` : undefined}
                  />
                </CardHeader>
                <CardContent>
                  {primary ? (
                    <ActionBlock action={primary} large />
                  ) : (
                    <div className="flex min-w-0 flex-wrap items-center justify-between gap-4">
                      <p className="min-w-0 text-sm text-muted-foreground">No open tasks right now.</p>
                      <Button type="button" onClick={() => setQuickTask(true)}>Add a task</Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {alsoToday.length ? (
                <div className="mt-4 min-w-0 rounded-lg border border-border/60 px-4 py-3">
                  <h2 className="text-sm font-medium text-muted-foreground">Also today</h2>
                  <div className="mt-1 divide-y divide-border/60">
                    {alsoToday.map((action) => (
                      <div key={action.item.id} className="py-3 first:pt-1 last:pb-1">
                        <ActionBlock action={action} />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
            ) : null}

            {/* Zone 2 — one block for everything today, each row acting on itself. */}
            <section className="min-w-0">
              <h2 className="text-base font-semibold text-foreground">Today</h2>
              <p className="mt-1 text-sm text-muted-foreground">Your own figures, and the logging beside them.</p>
              {strips.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  No modules are switched on yet. Choose what to track in Settings.
                </p>
              ) : null}
              <div className="mt-3 min-w-0 divide-y divide-border">
                {strips.map((strip, index) => (
                  <div key={index} className="min-w-0 py-2 first:pt-0 last:pb-0">
                    {strip.node}
                  </div>
                ))}
              </div>
            </section>

            {/* Zone 3 — quiet footer: what is ahead, what is done, small tools. */}
            <section className="min-w-0 border-t border-border/60 pt-5 text-xs text-muted-foreground">
              <div className="grid min-w-0 gap-6 sm:grid-cols-2">
                <div className="min-w-0">
                  <h2 className="text-xs font-medium uppercase tracking-wide">Coming up</h2>
                  {visibleComingUp.length ? (
                    <div className="mt-1 divide-y divide-border/50">
                      {visibleComingUp.slice(0, 6).map((item) => (
                        <Link
                          key={item.id}
                          to={item.to}
                          className="flex min-h-11 min-w-0 flex-col justify-center py-2"
                        >
                          <p className="truncate text-xs font-medium text-foreground/90">
                            <span className="mr-1 font-normal text-muted-foreground">
                              {item.kind === "commitment" ? "You do ·" : "Happens ·"}
                            </span>
                            {item.title}
                          </p>
                          <p className="mt-0.5 truncate">{item.detail}</p>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1">Nothing due soon.</p>
                  )}
                </div>

                <div className="min-w-0">
                  <h2 className="text-xs font-medium uppercase tracking-wide">Today so far</h2>
                  {todayCounts.length ? (
                    <div className="mt-2 flex min-w-0 flex-wrap gap-2">
                      {todayCounts.map((item) => (
                        <SemanticBadge key={item.label} tone="positive" className="text-xs">
                          {item.value} {item.label}
                        </SemanticBadge>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1">Nothing logged yet today.</p>
                  )}
                </div>
              </div>

              <div className="mt-5 flex min-w-0 flex-wrap items-center gap-1">
                {isEnabled("calendar") ? (
                <Button asChild variant="link" size="sm" className="h-auto min-h-11 px-2 text-xs text-muted-foreground">
                  <Link to="/calendar">Calendar</Link>
                </Button>
                ) : null}
                {isEnabled("notes") ? (
                <Button asChild variant="link" size="sm" className="h-auto min-h-11 px-2 text-xs text-muted-foreground">
                  <Link to="/notes">Notes</Link>
                </Button>
                ) : null}
                {isEnabled("money") ? (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto min-h-11 px-2 text-xs text-muted-foreground"
                  onClick={() => setQuickMoney(true)}
                >
                  Log expense
                </Button>
                ) : null}
                {isEnabled("do") ? (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto min-h-11 px-2 text-xs text-muted-foreground"
                  onClick={() => setQuickTask(true)}
                >
                  Add task
                </Button>
                ) : null}
              </div>
            </section>
          </main>
        )}
      </div>


      <QuickAddTransactionDialog open={quickMoney} onOpenChange={setQuickMoney} />
      <QuickAddTaskDialog open={quickTask} onOpenChange={setQuickTask} />
      <ShrinkItDialog
        task={shrinkTask}
        existingSteps={shrinkTask ? stepsOf(allTasks, shrinkTask.id).length : 0}
        open={!!shrinkTask}
        onOpenChange={(open) => !open && setShrinkTask(null)}
      />
    </div>
  );
}
