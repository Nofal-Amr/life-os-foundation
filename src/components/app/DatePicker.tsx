import { format, isValid, parseISO } from "date-fns";
import { CalendarIcon, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePreferences } from "@/hooks/usePreferences";
import { cn } from "@/lib/utils";

function parseDate(value?: string | null) {
  if (!value) return undefined;
  const date = parseISO(value);
  return isValid(date) ? date : undefined;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Choose a date",
  disabled,
  disableFuture = false,
  id,
  className,
}: {
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  disableFuture?: boolean;
  id?: string;
  className?: string;
}) {
  const { fmtDate } = usePreferences();
  const selected = parseDate(value);
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const max = disableFuture ? format(today, "yyyy-MM-dd") : undefined;

  // A native date input sits invisibly over the button, so tapping opens the
  // phone's own date picker (like the time picker) while the button keeps
  // showing the date in the user's chosen format.
  return (
    <div className={cn("flex min-w-0 gap-1", className)}>
      <div className="relative min-w-0 flex-1">
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          tabIndex={-1}
          aria-hidden="true"
          className={cn(
            "pointer-events-none h-12 w-full justify-start text-left font-normal",
            !selected && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="size-4 shrink-0" />
          <span className="truncate">
            {selected ? fmtDate(format(selected, "yyyy-MM-dd")) : placeholder}
          </span>
        </Button>
        <input
          id={id}
          type="date"
          aria-label={placeholder}
          disabled={disabled}
          value={selected ? format(selected, "yyyy-MM-dd") : ""}
          max={max}
          onChange={(event) => onChange(event.target.value)}
          onClick={(event) => {
            try {
              event.currentTarget.showPicker?.();
            } catch {
              // Older browsers open the picker on their own.
            }
          }}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
      </div>
      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-12 w-10 shrink-0"
          onClick={() => onChange("")}
          aria-label="Clear date"
        >
          <X className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}

export function DateTimePicker({
  value,
  onChange,
  required,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  id?: string;
}) {
  const [date = "", time = ""] = value.split("T");
  const setDate = (nextDate: string) => onChange(nextDate ? `${nextDate}T${time || "09:00"}` : "");
  const setTime = (nextTime: string) =>
    onChange(
      date
        ? `${date}T${nextTime}`
        : nextTime
          ? `${format(new Date(), "yyyy-MM-dd")}T${nextTime}`
          : "",
    );

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
      <DatePicker {...(id ? { id } : {})} value={date} onChange={setDate} />
      <input
        type="time"
        aria-label="Time"
        required={required}
        value={time}
        onChange={(event) => setTime(event.target.value)}
        className="h-12 min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
      />
    </div>
  );
}
