import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { addDays, format, isToday, parseISO } from "date-fns";
import {
  Check,
  Gauge,
  HeartPulse,
  Info,
  Moon,
  MoreHorizontal,
  PenLine,
  Pill,
  Smile,
  Utensils,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useXp } from "@/hooks/useXp";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { MoneyBreakdownDialog, useAvailableBeforePayday } from "@/components/app/MoneyBreakdown";
import { TodayRing, TodayRingLegend, useTodaySegments } from "@/components/app/TodayRing";
import { upcomingTimes, userRemindersQuery } from "@/data/userReminders";
import { FocusDialog } from "@/components/app/FocusDialog";
import { TodayFocus, type FocusRow } from "@/components/app/TodayFocus";
import { focusGroup, taskFocusGroup } from "@/data/focus";
import { ENERGY_LABELS, MOOD_LABELS, reviewByDateQuery } from "@/data/reviews";
import { TodayLog, type LogTile } from "@/components/app/TodayLog";
import { ReflectSheet } from "@/components/app/ReflectSheet";
import { reflectionCount } from "@/data/reflections";
import { notesQuery } from "@/data/notes";
import { openQuick } from "@/components/app/Shortcuts";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CheckIn } from "@/components/app/CheckIn";
import { OnThisDay, ReflectionNudge } from "@/components/app/OnThisDay";
import { DaySummary } from "@/components/app/DaySummary";
import { RelationshipsToday } from "@/components/app/relationships/RelationshipsToday";
import { QuickAddTaskDialog } from "@/components/app/QuickAddTask";
import { useHolidays } from "@/components/app/Holidays";
import { TaskTimerButton } from "@/components/app/Timer";
import { PrayerTiles } from "@/components/app/PrayerLog";
import { StuckCard, StuckHelperDialog } from "@/components/app/StuckHelper";
import { isSnoozed, snoozeForToday, stuckTasks } from "@/data/stuck";

import { SemanticBadge } from "@/components/app/SemanticBadge";
import { ErrorState, LoadingState } from "@/components/app/States";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  accountsQuery,
  daysUntil,
  hasPaydaySetup,
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
import { prayerCounts } from "@/data/week";
import {
  completeTask,
  energyCapacity,
  estimateLabel,
  fitsEnergy,
  isOpen,
  notStartedYet,
  stepsOf,
  taskKeys,
  tasksQuery,
  topLevelTasks,
  type Task,
  type TaskEnergy,
} from "@/data/tasks";
import { useModules } from "@/hooks/useModules";
import {
  classSessionsQuery,
  classesOn,
  coursesQuery,
  dueLabel,
  hhmm,
  studyItemsQuery,
  upcomingItems,
} from "@/data/study";
import { podEventsQuery, podsQuery } from "@/data/together";
import { usePreferences } from "@/hooks/usePreferences";
import { t } from "@/lib/i18n";
import { todayISO } from "@/lib/date";
import { prayerTimesFor } from "@/lib/prayer";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Today · Life OS" },
      {
        name: "description",
        content:
          "Your next action, plus a one-line look at prayers, money, body and what is coming up.",
      },
      { property: "og:title", content: "Today · Life OS" },
      {
        property: "og:description",
        content:
          "Your next action, plus a one-line look at prayers, money, body and what is coming up.",
      },
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
function nextActions(
  tasks: Task[],
  today: string,
  capacity: TaskEnergy | null = null,
): NextAction[] {
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
    // Within the same urgency, what fits today's energy comes first.
    const byEnergy =
      Number(!fitsEnergy(a.parent, capacity)) - Number(!fitsEnergy(b.parent, capacity));
    if (byEnergy !== 0) return byEnergy;
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
  if (hour < 12) return t("Good morning");
  if (hour < 18) return t("Good afternoon");
  return t("Good evening");
}

type ComingUpItem = {
  id: string;
  dimension: string;
  sortValue: string;
  title: string;
  detail: string;
  kind: "commitment" | "projection";
  to:
    | "/tasks"
    | "/projects"
    | "/goals"
    | "/finance/recurring"
    | "/resources"
    | "/reminders"
    | "/together"
    | "/study"
    | "/calendar";
};

function SectionHeading({ title, detail }: { title: string; detail?: string | undefined }) {
  return (
    <div className="min-w-0">
      <h2 className="text-lg font-semibold tracking-[-0.01em] text-foreground">{t(title)}</h2>
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
  liquid,
  committed,
  buffer,
  available,
  fmtMoney,
}: {
  liquid: number;
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
        Balance now {fmtMoney(liquid)} · Recurring before payday {fmtMoney(committed)} · Buffer{" "}
        {fmtMoney(buffer)}
      </p>
    </div>
  );
}

/** Local calendar date; toISOString() would shift it by the UTC offset. */
const iso = (date: Date) => format(date, "yyyy-MM-dd");

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
          <span className="font-medium text-foreground/80">{label}:</span> {value}
        </p>
        {to ? (
          <Button
            asChild
            variant="link"
            size="sm"
            className="ml-auto h-auto min-h-11 px-1 text-xs text-muted-foreground"
          >
            <Link to={to} {...(hash ? { hash } : {})}>
              {linkLabel ?? `Open ${label}`}
            </Link>
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
  const userReminders = useQuery(userRemindersQuery());
  const pods = useQuery(podsQuery());
  const podEvents = useQuery(podEventsQuery());
  const holidays = useHolidays();
  const studyEnabled = useModules().isEnabled("study");
  const studyItems = useQuery({ ...studyItemsQuery(), enabled: studyEnabled });
  const classSessions = useQuery({ ...classSessionsQuery(), enabled: studyEnabled });
  const studyCourses = useQuery({ ...coursesQuery(), enabled: studyEnabled });

  const ringSegments = useTodaySegments();
  const [quickTask, setQuickTask] = useState(false);
  const [focusTask, setFocusTask] = useState<{ id: string; title: string } | null>(null);
  const [shrinkTask, setShrinkTask] = useState<Task | null>(null);
  const [sheet, setSheet] = useState<"mood" | "medication" | null>(null);
  const [reflecting, setReflecting] = useState(false);
  const notes = useQuery(notesQuery());

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

  const xp = useXp();
  /** Completing the shown action promotes the next one in place. */
  const finish = useMutation({
    mutationFn: (id: string) => completeTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      toast.success("Done." + xp.suffix({ kind: "task" }));
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
  const todayReview = useQuery(reviewByDateQuery(today));
  const capacity = energyCapacity(todayReview.data?.energy);
  const actions = nextActions(allTasks, today, capacity);
  const primary = actions[0];
  // One task that has waited a long while (not the one already up next).
  // "Not today" is kept per device; the counter only re-renders after it.
  const [, setSnoozed] = useState(0);
  const stuck = stuckTasks(allTasks, today).find(
    (item) => item.task.id !== primary?.parent.id && !isSnoozed(item.task.id, today),
  );
  // Everything after the one next action, by when it's due (up to six).
  const projectById = new Map((projects.data ?? []).map((project) => [project.id, project]));
  const focusRows: FocusRow[] = [];
  for (const action of actions.slice(1)) {
    const group = taskFocusGroup(action.parent, today);
    if (!group) continue;
    const project = action.parent.project_id ? projectById.get(action.parent.project_id) : null;
    focusRows.push({
      kind: "task",
      id: action.parent.id,
      doneId: action.item.id,
      title: action.item.title,
      parentTitle: action.item.id !== action.parent.id ? action.parent.title : null,
      due: action.parent.due_date,
      dueTime: action.parent.due_time ? action.parent.due_time.slice(0, 5) : null,
      group,
      project: project ? { name: project.name, color: project.color } : null,
      priority: action.parent.priority === "low" ? null : action.parent.priority,
      estimate: action.minutes ? action.estimate : null,
    });
    if (focusRows.length >= 6) break;
  }
  for (const cost of recurring.data ?? []) {
    const group = cost.active ? focusGroup(cost.next_due_date, today) : null;
    if (!group) continue;
    focusRows.push({
      kind: "bill",
      id: cost.id,
      title: cost.name,
      due: cost.next_due_date,
      group,
      amount: fmtMoney(Number(cost.amount)),
    });
  }
  const overdueTasks = topLevelTasks(allTasks).filter(
    (task) => isOpen(task) && Boolean(task.due_date) && String(task.due_date) < today,
  ).length;

  const todayPrayerLogs = (prayerLogs.data ?? []).filter(
    (log) => log.prayer_date === today && prayerCounts(log),
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
  const nextWeek = iso(addDays(new Date(), 7));

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
    if (
      project.status === "archived" ||
      project.status === "completed" ||
      !project.due_date ||
      project.due_date > nextWeek
    )
      continue;
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

  // Student mode: today's classes, and what's due this week.
  if (studyEnabled) {
    const courseName = (id: string | null) =>
      (studyCourses.data ?? []).find((course) => course.id === id)?.name ?? null;
    for (const session of classesOn(classSessions.data ?? [], today)) {
      comingUp.push({
        id: `class-${session.id}`,
        dimension: "knowledge",
        sortValue: `${today} ${session.starts}`,
        title: courseName(session.course_id) ?? "Class",
        detail: `Class · Today ${hhmm(session.starts)}–${hhmm(session.ends)}${session.room ? ` · ${session.room}` : ""}`,
        kind: "commitment",
        to: "/study",
      });
    }
    for (const item of upcomingItems(studyItems.data ?? [])) {
      const due = item.due_at!.slice(0, 10);
      if (due > nextWeek) continue;
      const course = courseName(item.course_id);
      comingUp.push({
        id: `study-${item.id}`,
        dimension: "knowledge",
        sortValue: due,
        title: item.title,
        detail: `${item.kind[0]!.toUpperCase()}${item.kind.slice(1)}${course ? ` · ${course}` : ""} · due ${dueLabel(item.due_at!)}`,
        kind: "commitment",
        to: "/study",
      });
    }
  }

  // Holidays you turned on (Settings → Holidays): the next week.
  for (const holiday of holidays) {
    if (holiday.date < today || holiday.date > nextWeek) continue;
    comingUp.push({
      id: `holiday-${holiday.date}-${holiday.name}`,
      dimension: "spirit",
      sortValue: holiday.date,
      title: holiday.name,
      detail: `${holiday.kind === "islamic" ? "Expected" : "Holiday"} · ${holiday.date === today ? "Today" : fmtDate(holiday.date)}`,
      kind: "commitment",
      to: "/calendar",
    });
  }

  // Shared calendars (Together): the next week.
  for (const event of podEvents.data ?? []) {
    const day = format(new Date(event.starts_at), "yyyy-MM-dd");
    if (day < today || day > nextWeek) continue;
    const space = (pods.data ?? []).find((pod) => pod.id === event.pod_id)?.name ?? "Shared";
    comingUp.push({
      id: `pod-${event.id}`,
      dimension: "discipline",
      sortValue: day,
      title: event.title,
      detail: `${space} · ${day === today ? "Today" : fmtDate(day)}${event.all_day ? "" : ` · ${fmtTime(new Date(event.starts_at))}`}`,
      kind: "commitment",
      to: "/together",
    });
  }

  for (const reminder of userReminders.data ?? []) {
    const next = upcomingTimes(reminder, new Date(), 1, addDays(new Date(), 7))[0];
    if (!next) continue;
    comingUp.push({
      id: `reminder-${reminder.id}`,
      dimension: "discipline",
      sortValue: iso(next),
      title: reminder.title,
      detail: `Reminder · ${fmtDate(iso(next))} · ${fmtTime(next)}`,
      kind: "commitment",
      to: "/reminders",
    });
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
    .flatMap((medication) =>
      (medication.schedule_times ?? []).map((slot) => ({ medication, slot })),
    )
    .sort((a, b) => a.slot.localeCompare(b.slot));
  const dosesDue = scheduledDoses.filter(
    ({ medication, slot }) => !takenDoseKeys.has(`${medication.id}-${slot}`),
  );

  comingUp.sort((a, b) => {
    const byDimension =
      (dimensionRank.get(a.dimension) ?? 99) - (dimensionRank.get(b.dimension) ?? 99);
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
        <div id="today-prayers" className="mt-3 min-w-0 scroll-mt-5">
          <PrayerTiles
            date={today}
            logs={prayerLogs.data ?? []}
            times={
              prayerTimes
                ? {
                    fajr: prayerTimes.fajr,
                    dhuhr: prayerTimes.dhuhr,
                    asr: prayerTimes.asr,
                    maghrib: prayerTimes.maghrib,
                    isha: prayerTimes.isha,
                  }
                : null
            }
            next={nextPrayer as PrayerName | null}
            formatTime={fmtTime}
          />
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
                <span className="w-full truncate text-xs tabular-nums opacity-75">
                  {fmtSlot(slot)}
                </span>
                <span className="flex items-center gap-1 text-xs">
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
            todayFoodLogs.length ? `${todayCalories} kcal logged today` : "No food logged yet today"
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
          ? `${money.available >= 0 ? `${fmtMoney(money.available)} left to spend` : `Short by ${fmtMoney(Math.abs(money.available))}`} · payday in ${daysUntil(payday)} ${daysUntil(payday) === 1 ? "day" : "days"}`
          : `${fmtMoney(money.liquid)} now · payday not set up yet`
      }
      to="/finance"
      linkLabel="Open Money"
      action={
        paydayReady && payday ? (
          <MoneyBreakdownDialog
            trigger={
              <Button type="button" variant="outline" size="sm" className="min-h-11">
                <Info className="size-4" />
                <span>{t("Left before payday")}</span>
              </Button>
            }
          />
        ) : (
          <Button asChild variant="outline" size="sm" className="min-h-11">
            <Link to="/settings">{t("Set up payday")}</Link>
          </Button>
        )
      }
    >
      {paydayReady && payday ? (
        <>
          <MoneySplitBar
            liquid={money.liquid}
            committed={money.committed}
            buffer={money.buffer}
            available={money.available}
            fmtMoney={fmtMoney}
          />
          {lastPayday ? <PaydayLine from={lastPayday} to={payday} fmtDate={fmtDate} /> : null}
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

  /*
   * Today's log: one tile per thing you log, showing where it stands and
   * opening its quick panel. Prayer first (the daily anchor); medication only
   * on days with doses scheduled.
   */
  const mood = todayReview.data?.mood ?? null;
  const energy = todayReview.data?.energy ?? null;
  const nextPrayerTime =
    prayerTimes && nextPrayer && nextPrayer !== "none"
      ? (prayerTimes as unknown as Record<string, Date>)[nextPrayer]
      : null;
  const logTiles: LogTile[] = [
    ...(isEnabled("spirit")
      ? [
          hasPrayerLocation
            ? {
                key: "prayer",
                icon: Moon,
                label: "Prayer",
                detail:
                  nextPrayer && nextPrayerTime && nextPrayer !== "sunrise"
                    ? `${nextPrayer[0]!.toUpperCase()}${nextPrayer.slice(1)} ${fmtTime(nextPrayerTime)}`
                    : `${todayPrayerLogs.length} of 5 logged`,
                onClick: () => openQuick("prayer"),
              }
            : {
                key: "prayer",
                icon: Moon,
                label: "Prayer",
                detail: "Set your location",
                to: "/spirit",
              },
        ]
      : []),
    {
      key: "mood",
      icon: Smile,
      label: "Mood",
      detail:
        mood && energy ? `${MOOD_LABELS[mood - 1]} · ${ENERGY_LABELS[energy - 1]}` : "How are you?",
      onClick: () => setSheet("mood"),
    },
    ...(isEnabled("food")
      ? [
          {
            key: "meal",
            icon: Utensils,
            label: "Meal",
            detail: todayFoodLogs.length ? `${todayCalories} kcal today` : "Nothing yet today",
            onClick: () => openQuick("meal"),
          },
        ]
      : []),
    ...(isEnabled("money")
      ? [
          {
            key: "money",
            icon: Wallet,
            label: "Spending",
            detail:
              paydayReady && payday
                ? money.available >= 0
                  ? `${fmtMoney(money.available)} left`
                  : `Short by ${fmtMoney(Math.abs(money.available))}`
                : `${fmtMoney(money.liquid)} now`,
            onClick: () => openQuick("money"),
          },
        ]
      : []),
    {
      key: "reflect",
      icon: PenLine,
      label: "Reflect",
      detail: (() => {
        const count = reflectionCount(todayReview.data, notes.data ?? [], today);
        return count
          ? `${count} ${count === 1 ? "thing" : "things"} today`
          : "A good thing, an idea…";
      })(),
      onClick: () => setReflecting(true),
    },
    ...(isEnabled("body") && scheduledDoses.length
      ? [
          {
            key: "medication",
            icon: Pill,
            label: "Medication",
            detail: dosesDue.length
              ? `${dosesDue.length} of ${scheduledDoses.length} left`
              : "All taken",
            onClick: () => setSheet("medication"),
          },
        ]
      : []),
  ];

  /* Prayers are the daily anchor and stay first; the rest follows the saved order. */
  const strips: { dimension: string; node: ReactNode }[] = [
    ...(isEnabled("body") || isEnabled("food") ? [{ dimension: "health", node: bodyRows }] : []),
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
            {action.parent.original_due_date
              ? ` since ${fmtDate(action.parent.original_due_date)}`
              : ""}
            .
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
          <TaskTimerButton task={action.item} />
          {/* One clear action; the rest one tap away. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={large ? "size-10" : "size-9"}
                aria-label="More for this task"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onSelect={() => setFocusTask({ id: action.item.id, title: action.item.title })}
              >
                Focus on it
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setShrinkTask(action.parent)}>
                This feels hard
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/tasks" hash={action.parent.id}>
                  Open task
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="w-full min-w-0">
        <header className="pb-6">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">{fmtLongDate(new Date())}</p>
              <h1 className="mt-1 text-[1.75rem] font-semibold leading-tight tracking-[-0.025em] text-foreground">
                {greeting()}
                {firstName ? `, ${firstName}` : ""}
              </h1>
            </div>
            {loading ? null : <TodayRing segments={ringSegments} />}
          </div>
          {loading ? null : <TodayRingLegend segments={ringSegments} />}
        </header>

        {loading ? (
          <LoadingState rows={6} />
        ) : error ? (
          <ErrorState error={error} onRetry={() => queries.forEach((query) => query.refetch())} />
        ) : (
          // Phones: one column. Wide screens: the thing to do and the check-in on
          // the left, the snapshot and today's figures on the right.
          <main className="flex min-w-0 flex-col gap-10 xl:grid xl:grid-cols-2 xl:items-start xl:gap-x-10">
            {/* Zone 1 — the one thing to do. */}
            {isEnabled("do") ? (
              <section className="min-w-0 xl:col-start-1 xl:row-start-1">
                <Card className="system-card min-w-0 border-primary/30">
                  <CardHeader>
                    <SectionHeading
                      title="Next action"
                      detail={
                        overdueTasks
                          ? `${overdueTasks} open ${overdueTasks === 1 ? "task is" : "tasks are"} past their date.`
                          : undefined
                      }
                    />
                  </CardHeader>
                  <CardContent>
                    {primary ? (
                      <div
                        key={primary.item.id}
                        className="animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out"
                      >
                        <ActionBlock action={primary} large />
                        {capacity != null &&
                        primary.parent.energy != null &&
                        fitsEnergy(primary.parent, capacity) ? (
                          <p className="mt-3 text-xs text-muted-foreground">
                            {t("Picked to fit your energy right now.")}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <div className="flex min-w-0 flex-wrap items-center justify-between gap-4">
                        <p className="min-w-0 text-sm text-muted-foreground">
                          {t("No open tasks right now.")}
                        </p>
                        <Button type="button" onClick={() => setQuickTask(true)}>
                          Add a task
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {stuck ? (
                  <div className="mt-5">
                    <StuckCard
                      key={stuck.task.id}
                      item={stuck}
                      onSnooze={() => {
                        snoozeForToday(stuck.task.id, today);
                        setSnoozed((count) => count + 1);
                      }}
                    />
                  </div>
                ) : null}

                {focusRows.length ? (
                  <div className="mt-8 min-w-0">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h2 className="text-sm font-semibold text-foreground">
                        {t("Today's focus")}
                      </h2>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setQuickTask(true)}
                      >
                        Add task
                      </Button>
                    </div>
                    <TodayFocus
                      rows={focusRows}
                      today={today}
                      onDone={(id) => finish.mutate(id)}
                      pendingId={finish.isPending ? (finish.variables ?? null) : null}
                    />
                  </div>
                ) : null}
              </section>
            ) : null}

            {/* Log: one tile per thing you track, each showing where it stands. */}
            <div className="min-w-0 xl:col-start-2 xl:row-start-1">
              <TodayLog tiles={logTiles} />

              {/* People: a birthday soon, or a check-in whose rhythm came round. */}
              <RelationshipsToday className="mt-8 min-w-0" />

              {/* Everything else about today, folded away until you want it. */}
              <details className="group mt-8 min-w-0 border-t border-border/60 pt-4">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
                  <span>
                    {t("More about today")}
                    {quotaAlerts.length ? (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {quotaAlerts.length} {quotaAlerts.length === 1 ? "alert" : "alerts"}
                      </span>
                    ) : null}
                  </span>
                  <span
                    aria-hidden="true"
                    className="text-muted-foreground transition-transform duration-200 group-open:rotate-90"
                  >
                    ›
                  </span>
                </summary>
                <div className="mt-3 min-w-0 space-y-6 text-sm">
                  <div className="min-w-0 divide-y divide-border">
                    {strips.map((strip, index) => (
                      <div key={index} className="min-w-0 py-2 first:pt-0 last:pb-0">
                        {strip.node}
                      </div>
                    ))}
                  </div>
                  <div className="min-w-0 text-xs text-muted-foreground">
                    <h2 className="text-sm font-medium text-foreground">{t("Coming up")}</h2>
                    {visibleComingUp.length ? (
                      <div className="mt-1 divide-y divide-border/50">
                        {visibleComingUp.slice(0, 6).map((item) => (
                          <Link
                            key={item.id}
                            to={item.to}
                            className="flex min-h-11 min-w-0 flex-col justify-center py-2"
                          >
                            <p className="truncate text-sm font-medium text-foreground/90">
                              {item.title}
                            </p>
                            <p className="mt-0.5 truncate">{item.detail}</p>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1">{t("Nothing due soon.")}</p>
                    )}
                  </div>
                  <DaySummary className="min-w-0" />
                  <OnThisDay className="min-w-0" />
                  <ReflectionNudge />
                </div>
              </details>
            </div>
          </main>
        )}
      </div>

      <QuickAddTaskDialog open={quickTask} onOpenChange={setQuickTask} />
      <ReflectSheet open={reflecting} onOpenChange={setReflecting} date={today} />
      <Sheet open={sheet !== null} onOpenChange={(open) => !open && setSheet(null)}>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto rounded-t-3xl px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6"
        >
          <SheetTitle className="sr-only">
            {sheet === "mood" ? "How are you right now?" : "Medication today"}
          </SheetTitle>
          {sheet === "mood" ? <CheckIn /> : sheet === "medication" ? medicationRow : null}
        </SheetContent>
      </Sheet>
      <FocusDialog
        open={!!focusTask}
        task={focusTask}
        onOpenChange={(open) => !open && setFocusTask(null)}
      />
      <StuckHelperDialog
        task={shrinkTask}
        existingSteps={shrinkTask ? stepsOf(allTasks, shrinkTask.id).length : 0}
        open={!!shrinkTask}
        onOpenChange={(open) => !open && setShrinkTask(null)}
      />
    </div>
  );
}
