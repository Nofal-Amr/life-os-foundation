import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { useAvailableBeforePayday } from "@/components/app/MoneyBreakdown";
import { transactionsQuery } from "@/data/finance";
import { isOpen, tasksQuery, topLevelTasks } from "@/data/tasks";
import { usePreferences } from "@/hooks/usePreferences";
import { todayISO } from "@/lib/date";
import { isAndroidApp, setTodayWidget } from "@/lib/native";

/**
 * Keeps the home-screen Today widget up to date (Android app only): left to
 * spend, spent today, and tasks due today or overdue with the first one.
 * Mounted once in the app layout.
 */
export function useTodayWidgetSync() {
  const android = isAndroidApp();
  const tasks = useQuery({ ...tasksQuery(), enabled: android });
  const transactions = useQuery({ ...transactionsQuery(), enabled: android });
  const money = useAvailableBeforePayday();
  const { fmtMoney } = usePreferences();

  const today = todayISO();
  const due = topLevelTasks(tasks.data ?? [])
    .filter((task) => isOpen(task) && task.due_date && task.due_date <= today)
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
  const spent = (transactions.data ?? [])
    .filter((t) => t.kind === "expense" && t.date === today)
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
  const left = money.paydayReady ? fmtMoney(money.available) : fmtMoney(money.liquid);
  const tasksText = due.length
    ? `${due.length} ${due.length === 1 ? "task" : "tasks"} due · next: ${due[0]!.title}`
    : "Nothing due today.";
  const spentText = fmtMoney(spent);
  const ready = !tasks.isLoading && !transactions.isLoading && !money.isLoading;

  useEffect(() => {
    if (!android || !ready) return;
    setTodayWidget({ left, spent: spentText, tasks: tasksText });
  }, [android, ready, left, spentText, tasksText]);
}
