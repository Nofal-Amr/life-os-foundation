import { addDays, format, isToday, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePreferences } from "@/hooks/usePreferences";
import { todayISO } from "@/lib/date";

/**
 * Shows which date is being logged. Future dates are never selectable.
 */
export function DateNav({
  value,
  onChange,
  label = "Logging",
}: {
  value: string;
  onChange: (next: string) => void;
  label?: string;
}) {
  const { fmtLongDate } = usePreferences();
  const today = todayISO();
  const date = parseISO(value);
  const atToday = value >= today;

  const shift = (days: number) => {
    const next = format(addDays(date, days), "yyyy-MM-dd");
    if (next > today) return;
    onChange(next);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11"
          aria-label="Previous day"
          onClick={() => shift(-1)}
        >
          <ChevronLeft className="size-5" />
        </Button>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-sm font-medium text-foreground">
            {isToday(date) ? "Today" : fmtLongDate(date)}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11"
          aria-label="Next day"
          disabled={atToday}
          onClick={() => shift(1)}
        >
          <ChevronRight className="size-5" />
        </Button>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={atToday}
        onClick={() => onChange(today)}
      >
        Today
      </Button>
    </div>
  );
}
