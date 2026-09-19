import { format, isValid, parseISO } from "date-fns";
import { CalendarIcon, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function parseDate(value?: string | null) {
  if (!value) return undefined;
  const date = parseISO(value);
  return isValid(date) ? date : undefined;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "dd/mm/yyyy",
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
  const selected = parseDate(value);
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  return (
    <div className={cn("flex min-w-0 gap-1", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn("h-12 min-w-0 flex-1 justify-start text-left font-normal", !selected && "text-muted-foreground")}
          >
            <CalendarIcon className="size-4 shrink-0" />
            <span className="truncate">{selected ? format(selected, "dd/MM/yyyy") : placeholder}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={(date) => onChange(date ? format(date, "yyyy-MM-dd") : "")}
            disabled={disableFuture ? { after: today } : undefined}
            initialFocus
            className="pointer-events-auto p-3"
          />
        </PopoverContent>
      </Popover>
      {value ? (
        <Button type="button" variant="ghost" size="icon" className="h-12 w-10 shrink-0" onClick={() => onChange("")} aria-label="Clear date">
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
  const setTime = (nextTime: string) => onChange(date ? `${date}T${nextTime}` : nextTime ? `${format(new Date(), "yyyy-MM-dd")}T${nextTime}` : "");

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
      <DatePicker id={id} value={date} onChange={setDate} />
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