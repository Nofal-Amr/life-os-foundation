import { addMonths, format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { MonthSheetView } from "@/components/app/work/MonthSheetView";
import { useMonthSheet } from "@/components/app/work/useMonthSheet";
import { LoadingState } from "@/components/app/States";
import { Button } from "@/components/ui/button";
import { XLSX_MIME } from "@/data/exportData";
import type { WorkMember, WorkOrg } from "@/data/work/api";
import type { DayRow, WorkRules } from "@/data/work/rules";
import { exportSheets } from "@/data/work/sheetExport";
import { t } from "@/lib/i18n";
import { saveFile } from "@/lib/native";

export function monthLabel(month: string) {
  return format(parseISO(`${month}-01`), "MMMM yyyy");
}

/** Previous / next month, with this month as the default. */
export function useMonthPicker() {
  const [month, setMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const step = (by: number) => setMonth(format(addMonths(parseISO(`${month}-01`), by), "yyyy-MM"));
  return { month, step };
}

export function MonthNav({ month, step }: { month: string; step: (by: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t("Previous month")}
        onClick={() => step(-1)}
      >
        <ChevronLeft className="size-5 rtl:rotate-180" />
      </Button>
      <span className="min-w-32 text-center text-sm font-medium">{monthLabel(month)}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t("Next month")}
        onClick={() => step(1)}
      >
        <ChevronRight className="size-5 rtl:rotate-180" />
      </Button>
    </div>
  );
}

export function sheetOptions(rules: WorkRules) {
  return {
    labels: t,
    fmt: {
      time: (iso: string) =>
        new Date(iso).toLocaleTimeString([], {
          timeZone: rules.timezone,
          hour: "2-digit",
          minute: "2-digit",
        }),
      date: (day: string) => day,
    },
    leaveName: (id: string) => t(rules.leaveTypes.find((type) => type.id === id)?.name ?? id),
  };
}

/** One member's month: the sheet, and an Excel download of it. */
export function MemberMonth({
  org,
  rules,
  member,
  month,
  onDay,
}: {
  org: WorkOrg;
  rules: WorkRules;
  member: WorkMember;
  month: string;
  onDay?: (row: DayRow) => void;
}) {
  const { sheet, corrections, loading, error } = useMonthSheet(org, rules, month, member);
  if (loading) return <LoadingState rows={4} />;
  if (error) return <p className="text-sm text-destructive">{error.message}</p>;
  if (!sheet) return null;

  const download = () => {
    const bytes = exportSheets(
      [{ person: member.display_name, sheet }],
      org.name,
      month,
      sheetOptions(rules),
    );
    const where = saveFile(`${org.name} ${member.display_name} ${month}.xlsx`, bytes, XLSX_MIME);
    if (where) toast.success(`${t("Saved to")} ${where}`);
    else toast.error(t("The file couldn't be saved on this device."));
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={download}>
          <Download className="size-4" /> {t("Excel")}
        </Button>
      </div>
      <MonthSheetView
        sheet={sheet}
        rules={rules}
        {...(onDay ? { onDay } : {})}
        corrections={(corrections ?? []).map((item) => ({
          day: item.day,
          field: item.field,
          reason: item.reason,
        }))}
      />
    </div>
  );
}
