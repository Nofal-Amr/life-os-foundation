import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeft,
  CheckSquare,
  Moon,
  NotebookPen,
  Plus,
  Timer,
  Utensils,
  Wallet,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { EntityIcon } from "@/components/app/EntityIdentity";
import { PrayerTiles } from "@/components/app/PrayerLog";
import { QuickAddTaskDialog } from "@/components/app/QuickAddTask";
import { QuickAddTransactionDialog } from "@/components/app/QuickAddTransaction";
import { QuickMeals } from "@/components/app/QuickMeals";
import { useTimer } from "@/components/app/Timer";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useModules } from "@/hooks/useModules";
import { todayISO } from "@/lib/date";
import { useQuery } from "@tanstack/react-query";
import { prayerLogsQuery } from "@/data/spirit";
import { cn } from "@/lib/utils";

type Panel = "menu" | "meal" | "timer" | "prayer";

/**
 * One button, reachable from every page, for the things you log most. Each
 * is one or two taps; nothing needs navigating to first.
 */
export function QuickAdd() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const { enabled } = useModules();
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>("menu");
  const [money, setMoney] = useState(false);
  const [task, setTask] = useState(false);
  const { activities, start, running } = useTimer();
  const prayerLogs = useQuery({ ...prayerLogsQuery(), enabled: open && panel === "prayer" });

  // Notes has its own new-note button in the same place.
  if (pathname.startsWith("/notes")) return null;

  const close = () => {
    setOpen(false);
    window.setTimeout(() => setPanel("menu"), 200);
  };

  const actions: {
    key: string;
    label: string;
    icon: typeof Plus;
    show: boolean;
    run: () => void;
  }[] = [
    {
      key: "money",
      label: "Spending",
      icon: Wallet,
      show: enabled.includes("money"),
      run: () => {
        close();
        setMoney(true);
      },
    },
    {
      key: "meal",
      label: "Meal",
      icon: Utensils,
      show: enabled.includes("body"),
      run: () => setPanel("meal"),
    },
    { key: "timer", label: "Timer", icon: Timer, show: true, run: () => setPanel("timer") },
    {
      key: "task",
      label: "Task",
      icon: CheckSquare,
      show: enabled.includes("do"),
      run: () => {
        close();
        setTask(true);
      },
    },
    {
      key: "note",
      label: "Note",
      icon: NotebookPen,
      show: enabled.includes("notes"),
      run: () => {
        close();
        void navigate({ to: "/notes", search: { new: "1" } as never });
      },
    },
    {
      key: "prayer",
      label: "Prayer",
      icon: Moon,
      show: enabled.includes("spirit"),
      run: () => setPanel("prayer"),
    },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Quick add"
        className={cn(
          "fixed right-4 z-40 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_8px_24px_-6px_color-mix(in_oklch,var(--color-primary)_55%,transparent)] transition-[scale,rotate] duration-150 ease-out active:scale-95 md:bottom-8 md:right-8",
          running
            ? "bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+9.5rem)]"
            : "bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+5.25rem)]",
        )}
      >
        <Plus className={cn("size-6 transition-transform duration-200 ease-out", open && "rotate-45")} />
      </button>

      <Sheet open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto rounded-t-3xl px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6"
        >
          <SheetTitle className="mb-4 text-base">
            {panel === "menu"
              ? "Log something"
              : panel === "meal"
                ? "Log a meal"
                : panel === "timer"
                  ? "Start a timer"
                  : "Prayers today"}
          </SheetTitle>

          {panel === "menu" ? (
            <div className="grid grid-cols-3 gap-2 animate-in fade-in duration-200 ease-out">
              {actions
                .filter((action) => action.show)
                .map(({ key, label, icon: Icon, run }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={run}
                    className="stat-card flex min-h-20 flex-col items-center justify-center gap-2 px-2 py-4 text-sm font-medium transition-[scale,background-color] duration-150 ease-out hover:bg-accent active:scale-[0.97]"
                  >
                    <Icon className="size-6 text-primary" aria-hidden="true" />
                    {label}
                  </button>
                ))}
            </div>
          ) : null}

          {panel === "meal" ? (
            <Back onBack={() => setPanel("menu")}>
              <QuickMeals date={todayISO()} />
            </Back>
          ) : null}

          {panel === "timer" ? (
            <Back onBack={() => setPanel("menu")}>
              <div className="grid grid-cols-2 gap-2">
                {(activities.data ?? [])
                  .filter((a) => !a.archived)
                  .map((activity) => (
                    <button
                      key={activity.id}
                      type="button"
                      onClick={() => {
                        start.mutate({
                          activity_id: activity.id,
                          task_id: null,
                          label: activity.name,
                        });
                        close();
                      }}
                      className="stat-card flex min-h-12 items-center gap-2 p-3 text-left text-sm font-medium transition-[scale,background-color] duration-150 ease-out hover:bg-accent active:scale-[0.97]"
                    >
                      <EntityIcon icon={activity.icon} color={activity.color} />
                      {activity.name}
                    </button>
                  ))}
              </div>
              <button
                type="button"
                className="mt-2 inline-flex min-h-11 items-center text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
                onClick={() => {
                  close();
                  void navigate({ to: "/time" });
                }}
              >
                {(activities.data ?? []).length
                  ? "Time page"
                  : "Set up activities on the Time page"}
              </button>
            </Back>
          ) : null}

          {panel === "prayer" ? (
            <Back onBack={() => setPanel("menu")}>
              <PrayerTiles date={todayISO()} logs={prayerLogs.data ?? []} />
            </Back>
          ) : null}
        </SheetContent>
      </Sheet>

      <QuickAddTransactionDialog open={money} onOpenChange={setMoney} />
      <QuickAddTaskDialog open={task} onOpenChange={setTask} />
    </>
  );
}

function Back({ onBack, children }: { onBack: () => void; children: ReactNode }) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200 ease-out">
      <button
        type="button"
        onClick={onBack}
        className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back
      </button>
      {children}
    </div>
  );
}
