import { Layers } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { calendarShowsSpace, withCalendarSpace, type SpaceKey } from "@/data/spaces";
import { useModules } from "@/hooks/useModules";
import { t } from "@/lib/i18n";

const ROWS: { space: SpaceKey; label: string; hint: string }[] = [
  {
    space: "work",
    label: "Work in the calendar",
    hint: "Work tasks with a date, next to the rest of your day.",
  },
  {
    space: "study",
    label: "Study in the calendar",
    hint: "Study tasks, assignments and exams with a date.",
  },
];

/** Settings → Calendar: whether Work and Study sit in the main calendar. */
export function CalendarSpacesCard() {
  const { enabled, setModules, isSaving } = useModules();
  return (
    <section className="stat-card space-y-3 p-4 sm:space-y-4 sm:p-5">
      <div>
        <p className="flex items-center gap-2 text-base font-semibold">
          <Layers className="size-4" /> {t("Work and Study in the calendar")}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t(
            "Show them with everything else, or keep the main calendar for life only. Each space still has its own calendar tab, and you can switch them for one visit on the Calendar page.",
          )}
        </p>
      </div>
      <div className="space-y-2">
        {ROWS.map((row) => {
          const on = calendarShowsSpace(enabled, row.space);
          return (
            <div
              key={row.space}
              className="flex min-h-14 items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{t(row.label)}</p>
                <p className="text-xs text-muted-foreground">{t(row.hint)}</p>
              </div>
              <Switch
                checked={on}
                aria-label={t(row.label)}
                disabled={isSaving}
                onCheckedChange={(next) => setModules(withCalendarSpace(enabled, row.space, next))}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
