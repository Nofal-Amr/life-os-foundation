import { format, isSameDay, isToday } from "date-fns";
import { useEffect, useRef, useState } from "react";

import { layoutTimed } from "@/data/calendarLayout";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type GridItem = {
  id: string;
  title: string;
  /** Tailwind classes for the block's tint and text. */
  tone: string;
  start: Date;
  end: Date | null;
};
export type AllDayItem = { id: string; title: string; tone: string; dashed?: boolean };
export type Mark = { label: string; at: Date };

const HOUR = 48;
const PX = HOUR / 60;

/**
 * The Week / Day time grid: hours down the side, a column per day, timed
 * items placed at their times (side by side where they overlap), all-day
 * items in a strip on top, a line for now, and prayer times as quiet marks.
 * Tapping an empty spot starts a new event at that half hour.
 */
export function TimeGrid({
  days,
  timed,
  allDay,
  marks,
  onSlot,
  onItem,
  onDay,
}: {
  days: Date[];
  timed: (day: Date) => GridItem[];
  allDay: (day: Date) => AllDayItem[];
  marks: (day: Date) => Mark[];
  onSlot: (at: Date) => void;
  onItem: (id: string) => void;
  onDay?: (day: Date) => void;
}) {
  const scroller = useRef<HTMLDivElement | null>(null);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  // Open on the working day: an hour before now when today is shown, else 7:00.
  useEffect(() => {
    const showsToday = days.some((day) => isToday(day));
    const hour = showsToday ? Math.max(0, new Date().getHours() - 1) : 7;
    scroller.current?.scrollTo({ top: hour * HOUR });
  }, [days.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const columns = `3rem repeat(${days.length}, minmax(0, 1fr))`;
  const anyAllDay = days.some((day) => allDay(day).length);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {/* Day headers */}
      <div className="grid border-b border-border" style={{ gridTemplateColumns: columns }}>
        <div />
        {days.map((day) => (
          <button
            key={day.toISOString()}
            type="button"
            onClick={onDay ? () => onDay(day) : undefined}
            className="flex flex-col items-center py-2 text-xs"
          >
            <span className="text-muted-foreground">{t(format(day, "EEE"))}</span>
            <span
              className={cn(
                "mt-0.5 grid size-7 place-items-center rounded-full text-sm font-semibold tabular-nums",
                isToday(day) && "bg-primary text-primary-foreground",
              )}
            >
              {format(day, "d")}
            </span>
          </button>
        ))}
      </div>

      {anyAllDay ? (
        <div className="grid border-b border-border" style={{ gridTemplateColumns: columns }}>
          <div className="px-1 py-1 text-end text-2xs text-muted-foreground">{t("All day")}</div>
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className="min-w-0 space-y-0.5 border-s border-border p-0.5"
            >
              {allDay(day)
                .slice(0, 3)
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onItem(item.id)}
                    className={cn(
                      "block w-full truncate rounded px-1 py-0.5 text-start text-2xs",
                      item.tone,
                      item.dashed && "border border-dashed border-current bg-transparent",
                    )}
                  >
                    {item.title}
                  </button>
                ))}
              {allDay(day).length > 3 ? (
                <p className="px-1 text-2xs text-muted-foreground">+{allDay(day).length - 3}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {/* Hours */}
      <div ref={scroller} className="relative max-h-[65vh] overflow-y-auto overscroll-contain">
        <div className="grid" style={{ gridTemplateColumns: columns, height: 24 * HOUR }}>
          <div className="relative">
            {Array.from({ length: 24 }, (_, hour) => (
              <span
                key={hour}
                className="absolute end-1 -translate-y-1/2 text-2xs tabular-nums text-muted-foreground"
                style={{ top: hour * HOUR }}
              >
                {hour === 0 ? "" : format(new Date(2026, 0, 1, hour), "HH:mm")}
              </span>
            ))}
          </div>
          {days.map((day, dayIndex) => {
            const items = timed(day);
            const blocks = layoutTimed(items, day);
            return (
              <div
                key={day.toISOString()}
                className="relative border-s border-border"
                onClick={(event) => {
                  if (event.target !== event.currentTarget) return;
                  const y = event.nativeEvent.offsetY;
                  const minutes = Math.floor(y / PX / 30) * 30;
                  const at = new Date(day);
                  at.setHours(0, minutes, 0, 0);
                  onSlot(at);
                }}
              >
                {Array.from({ length: 24 }, (_, hour) => (
                  <div
                    key={hour}
                    className="pointer-events-none absolute inset-x-0 border-t border-border/60"
                    style={{ top: hour * HOUR }}
                  />
                ))}
                {marks(day).map((mark) => {
                  const minutes = mark.at.getHours() * 60 + mark.at.getMinutes();
                  return (
                    <div
                      key={mark.label}
                      className="pointer-events-none absolute inset-x-0 border-t border-dashed border-primary/40"
                      style={{ top: minutes * PX }}
                    >
                      {/* The name once, in the first column; lines alone across the week. */}
                      {dayIndex === 0 ? (
                        <span className="absolute start-0.5 -top-3.5 text-[9px] text-primary/70">
                          {mark.label}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
                {blocks.map((block) => {
                  const item = items.find((entry) => entry.id === block.id)!;
                  return (
                    <button
                      key={block.id}
                      type="button"
                      onClick={() => onItem(block.id)}
                      className={cn(
                        "absolute overflow-hidden rounded-md px-1 py-0.5 text-start text-2xs leading-tight shadow-sm",
                        item.tone,
                      )}
                      style={{
                        top: block.top * PX,
                        height: Math.max(block.height * PX - 2, 18),
                        insetInlineStart: `calc(${(block.column / block.columns) * 100}% + 2px)`,
                        width: `calc(${100 / block.columns}% - 4px)`,
                      }}
                    >
                      <span className="block truncate font-medium">{item.title}</span>
                      {block.height >= 45 ? (
                        <span className="block truncate opacity-80">
                          {format(item.start, "HH:mm")}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
                {isSameDay(day, now) ? (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-destructive"
                    style={{ top: (now.getHours() * 60 + now.getMinutes()) * PX }}
                  >
                    <span className="absolute -start-1 -top-1 size-2 rounded-full bg-destructive" />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
