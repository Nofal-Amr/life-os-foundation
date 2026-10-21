import type { DayRow, MonthSheet, WorkRules } from "@/data/work/rules";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * One person's month, laid out like a company attendance sheet: a row per
 * day, then the minutes, the counts and the money. Corrected times carry a
 * small mark; tapping a day (admins) opens its correction.
 */
export function MonthSheetView({
  sheet,
  rules,
  onDay,
  corrections = [],
}: {
  sheet: MonthSheet;
  rules: WorkRules;
  /** Admins: tap a day to correct it. */
  onDay?: (row: DayRow) => void;
  corrections?: { day: string; field: string; reason: string }[];
}) {
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString([], {
      timeZone: rules.timezone,
      hour: "numeric",
      minute: "2-digit",
    });
  const money = (value: number) => `${value.toLocaleString()} ${rules.currency}`;
  const leaveName = (id: string | null) =>
    t(rules.leaveTypes.find((type) => type.id === id)?.name ?? "Leave");
  const { totals } = sheet;

  return (
    <div className="space-y-5">
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[640px] text-sm tabular-nums">
          <thead className="bg-secondary text-xs text-muted-foreground">
            <tr>
              {["Date", "Day", "In", "Out", "Late", "Penalty", "Early leave", "Overtime"].map(
                (label) => (
                  <th key={label} className="px-2 py-2 text-start font-medium">
                    {t(label)}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((row) => {
              const workedOff = row.kind === "off" && !!row.in;
              const tone =
                row.kind === "leave"
                  ? "bg-[color-mix(in_oklch,var(--chart-4)_14%,transparent)]"
                  : row.kind === "holiday" || (row.kind === "off" && !row.in)
                    ? "bg-secondary/60 text-muted-foreground"
                    : workedOff
                      ? "bg-primary/10"
                      : "";
              const mark = (field: "in" | "out") =>
                row.corrected.includes(field) ? (
                  <span className="ms-0.5 text-primary" title={t("Corrected by an admin")}>
                    *
                  </span>
                ) : null;
              const blank = row.kind === "leave" || !row.in;
              return (
                <tr
                  key={row.day}
                  className={cn(
                    "border-t border-border",
                    tone,
                    onDay && "cursor-pointer hover:bg-accent",
                  )}
                  onClick={onDay ? () => onDay(row) : undefined}
                >
                  <td className="px-2 py-1.5">{Number(row.day.slice(8))}</td>
                  <td className="px-2 py-1.5">{t(WEEKDAYS[row.weekday]!)}</td>
                  {blank ? (
                    <td className="px-2 py-1.5" colSpan={6}>
                      {row.kind === "leave" ? (
                        leaveName(row.leaveTypeId)
                      ) : row.note === "absent-unexplained" ? (
                        <span className="text-destructive">{t("Absent, not explained")}</span>
                      ) : row.kind === "holiday" ? (
                        t("Holiday")
                      ) : (
                        t("Day off")
                      )}
                    </td>
                  ) : (
                    <>
                      <td className="px-2 py-1.5">
                        {time(row.in!)}
                        {mark("in")}
                      </td>
                      <td className="px-2 py-1.5">
                        {row.out ? (
                          <>
                            {time(row.out)}
                            {mark("out")}
                          </>
                        ) : (
                          <span className="text-destructive">{t("No clock-out")}</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5">{row.late || ""}</td>
                      <td className="px-2 py-1.5">
                        {row.dayPenalty ? t("A day") : row.penalty || ""}
                      </td>
                      <td className="px-2 py-1.5">{row.earlyLeave || ""}</td>
                      <td className="px-2 py-1.5">
                        {row.overtime || ""}
                        {workedOff ? (
                          <span className="ms-1 text-xs text-muted-foreground">{t("day off")}</span>
                        ) : null}
                        {row.site ? (
                          <span className="ms-1 text-xs text-muted-foreground">{t("site")}</span>
                        ) : null}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t border-border bg-secondary font-medium">
            <tr>
              <td className="px-2 py-2" colSpan={4}>
                {t("Total (minutes)")}
              </td>
              <td className="px-2 py-2">{totals.late}</td>
              <td className="px-2 py-2">{totals.penalty}</td>
              <td className="px-2 py-2">{totals.earlyLeave}</td>
              <td className="px-2 py-2">{totals.overtime}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        <Line label="Late, penalty and early-leave time (hours)">
          {((totals.late + totals.penalty + totals.earlyLeave) / 60).toFixed(2)}
        </Line>
        <Line label="Overtime (hours)">{(totals.overtime / 60).toFixed(2)}</Line>
        {Object.entries(totals.leaves).map(([id, days]) => (
          <Line key={id} label={leaveName(id)}>
            {days} {t("days")}
          </Line>
        ))}
        <Line label="Day penalties (days)">{totals.dayPenalties}</Line>
        <Line label="Site days">{totals.siteDays}</Line>
      </dl>

      <dl className="space-y-1.5 rounded-xl border border-border p-4 text-sm tabular-nums">
        <Line label="Base salary">{money(sheet.money.base)}</Line>
        <Line label="Late, penalties and early leave">−{money(sheet.money.deductions)}</Line>
        <Line label="Overtime pay">+{money(sheet.money.overtimePay)}</Line>
        <Line label="Leave deductions">
          −{money(sheet.money.leaveDeductions)}
          {rules.absenceFromTotal ? "" : ` (${t("not taken off the total")})`}
        </Line>
        <Line label="Day penalties">−{money(sheet.money.dayPenaltyDeductions)}</Line>
        <div className="border-t border-border pt-1.5 text-base font-semibold">
          <Line label="Total">{money(sheet.money.total)}</Line>
        </div>
        <p className="pt-1 text-xs text-muted-foreground">
          {t("Hourly rate")}: {sheet.money.ratePerHour.toFixed(2)} {rules.currency}
        </p>
      </dl>

      {corrections.length ? (
        <div className="space-y-1 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">{t("Corrections")}</p>
          {corrections.map((item, index) => (
            <p key={`${item.day}-${index}`}>
              {Number(item.day.slice(8))} ·{" "}
              {t(item.field === "leave" ? "Leave" : item.field === "in" ? "In" : "Out")}:{" "}
              {item.reason}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{t(label)}</dt>
      <dd className="tabular-nums">{children}</dd>
    </div>
  );
}
