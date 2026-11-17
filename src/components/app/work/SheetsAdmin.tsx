import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, MessageSquareText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { MemberMonth, MonthNav, sheetOptions, useMonthPicker } from "@/components/app/work/MyMonth";
import { WhatsAppImport } from "@/components/app/work/WhatsAppImport";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { XLSX_MIME } from "@/data/exportData";
import {
  addCorrection,
  allowanceUsed,
  usesAllowance,
  workYearLeavesQuery,
  approveLeave,
  deleteLeave,
  sheetInputFor,
  workCorrectionsQuery,
  workEventsQuery,
  workKeys,
  workLeavesQuery,
  workMembersQuery,
  workPlacesQuery,
  type WorkMember,
  type WorkOrg,
} from "@/data/work/api";
import { monthSheet, type DayRow, type WorkRules, type ExcuseCovers } from "@/data/work/rules";
import { exportSheets } from "@/data/work/sheetExport";
import { t } from "@/lib/i18n";
import { saveFile } from "@/lib/native";
import { zonedIso } from "@/data/work/time";
import { toError } from "@/lib/supabase-helpers";

/** Sheets: everyone's month, corrections, attempts away from a place, leave requests. */
export function SheetsAdmin({ org, rules }: { org: WorkOrg; rules: WorkRules }) {
  const queryClient = useQueryClient();
  const members = useQuery(workMembersQuery(org.id));
  const places = useQuery(workPlacesQuery(org.id));
  const { month, step } = useMonthPicker();
  const monthEvents = useQuery(workEventsQuery(org.id, month));
  const corrections = useQuery(workCorrectionsQuery(org.id, month));
  const leaves = useQuery(workLeavesQuery(org.id, month));
  const yearLeaves = useQuery(workYearLeavesQuery(org.id, Number(month.slice(0, 4))));
  const [who, setWho] = useState<string | null>(null);
  const [day, setDay] = useState<{ row: DayRow; member: WorkMember } | null>(null);
  const [importing, setImporting] = useState(false);
  const list = members.data ?? [];
  const member = list.find((item) => item.user_id === who) ?? list[0] ?? null;
  const name = (userId: string) => list.find((item) => item.user_id === userId)?.display_name ?? "";
  const refresh = () => void queryClient.invalidateQueries({ queryKey: workKeys.all });

  const correct = useMutation({
    mutationFn: addCorrection,
    onSuccess: () => {
      refresh();
      toast.success(t("Corrected"));
    },
    onError: (error: unknown) => toast.error(toError(error).message),
  });
  const approve = useMutation({ mutationFn: approveLeave, onSuccess: refresh });
  const decline = useMutation({ mutationFn: deleteLeave, onSuccess: refresh });

  const attempts = (monthEvents.data ?? []).filter((event) => event.kind === "attempt");
  const flagged = (monthEvents.data ?? []).filter(
    (event) => event.kind !== "attempt" && (event.mock || event.reason || event.sent_late),
  );
  const requested = (leaves.data ?? []).filter((leave) => leave.status === "requested");
  const time = (iso: string) =>
    new Date(iso).toLocaleString([], {
      timeZone: rules.timezone,
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  const leaveName = (id: string) => t(rules.leaveTypes.find((type) => type.id === id)?.name ?? id);

  const exportAll = () => {
    if (!monthEvents.data || !corrections.data || !leaves.data) return;
    const sheets = list.map((item) => ({
      person: item.display_name,
      sheet: monthSheet(
        sheetInputFor({
          member: item,
          rules,
          month,
          events: monthEvents.data.filter((row) => row.user_id === item.user_id),
          corrections: corrections.data.filter((row) => row.user_id === item.user_id),
          leaves: leaves.data.filter((row) => row.user_id === item.user_id),
          holidays: [],
        }),
      ),
    }));
    const where = saveFile(
      `${org.name} ${month}.xlsx`,
      exportSheets(sheets, org.name, month, sheetOptions(rules)),
      XLSX_MIME,
    );
    if (where) toast.success(`${t("Saved to")} ${where}`);
    else toast.error(t("The file couldn't be saved on this device."));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <select
          className="h-10 rounded-lg border border-border bg-card px-3 text-sm"
          value={member?.user_id ?? ""}
          onChange={(event) => setWho(event.target.value)}
          aria-label={t("Person")}
        >
          {list.map((item) => (
            <option key={item.user_id} value={item.user_id}>
              {item.display_name}
            </option>
          ))}
        </select>
        <MonthNav month={month} step={step} />
        <span className="flex flex-wrap gap-2">
          {rules.tests.whatsappImport ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setImporting(true)}>
              <MessageSquareText className="size-4" /> {t("From WhatsApp")}
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={exportAll}>
            <Download className="size-4" /> {t("Excel for everyone")}
          </Button>
        </span>
      </div>

      {requested.length ? (
        <section className="stat-card space-y-2 p-4">
          <p className="text-sm font-semibold">{t("Leave requests")}</p>
          {requested.map((leave) => (
            <div
              key={leave.id}
              className="flex flex-wrap items-center justify-between gap-2 text-sm"
            >
              <span>
                {name(leave.user_id)} · {leave.day} · {leaveName(leave.type_id)}
                {leave.note ? ` · ${leave.note}` : ""}
              </span>
              <span className="flex gap-1">
                <Button type="button" size="sm" onClick={() => approve.mutate(leave.id)}>
                  {t("Approve")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => decline.mutate(leave.id)}
                >
                  {t("Decline")}
                </Button>
              </span>
            </div>
          ))}
        </section>
      ) : null}

      {attempts.length || flagged.length ? (
        <section className="stat-card space-y-2 p-4">
          <p className="text-sm font-semibold">{t("To look at")}</p>
          {attempts.map((attempt) => (
            <div
              key={attempt.id}
              className="flex flex-wrap items-center justify-between gap-2 text-sm"
            >
              <span className="min-w-0">
                {name(attempt.user_id)} · {time(attempt.at)} · {Math.round(attempt.distance_m ?? 0)}{" "}
                m {t("from")}{" "}
                {places.data?.find((place) => place.id === attempt.place_id)?.name ?? t("a place")}
                {attempt.reason ? ` · “${attempt.reason}”` : ""}
              </span>
              <span className="flex gap-1">
                {(["in", "out"] as const).map((field) => (
                  <Button
                    key={field}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      correct.mutate({
                        org_id: org.id,
                        user_id: attempt.user_id,
                        day: new Date(attempt.at).toLocaleDateString("en-CA", {
                          timeZone: rules.timezone,
                        }),
                        field,
                        value: attempt.at,
                        reason:
                          `${t("Counted an attempt away from a place")}: ${attempt.reason ?? ""}`.slice(
                            0,
                            300,
                          ),
                      })
                    }
                  >
                    {t(field === "in" ? "Count as in" : "Count as out")}
                  </Button>
                ))}
              </span>
            </div>
          ))}
          {flagged.map((event) => (
            <p key={event.id} className="text-sm text-muted-foreground">
              {name(event.user_id)} · {time(event.at)} · {t(event.kind === "in" ? "In" : "Out")}
              {event.mock ? ` · ${t("faked location reported by the phone")}` : ""}
              {event.reason ? ` · ${t("outside a place")}: “${event.reason}”` : ""}
              {event.sent_late ? ` · ${t("sent later (offline)")}` : ""}
            </p>
          ))}
        </section>
      ) : null}

      {member ? (
        <MemberMonth
          org={org}
          rules={rules}
          member={member}
          month={month}
          onDay={(row) => setDay({ row, member })}
        />
      ) : null}

      <WhatsAppImport
        open={importing}
        onOpenChange={setImporting}
        org={org}
        rules={rules}
        members={list}
        onSaved={refresh}
      />

      <CorrectionDialog
        open={!!day}
        onOpenChange={(open) => !open && setDay(null)}
        day={day}
        rules={rules}
        allowance={
          day && yearLeaves.data
            ? {
                used: allowanceUsed({ userId: day.member.user_id, rules, ...yearLeaves.data }),
                total: Number(day.member.annual_leave_days ?? 0),
              }
            : null
        }
        onSave={(field, value, reason) => {
          if (!day) return;
          correct.mutate(
            { org_id: org.id, user_id: day.member.user_id, day: day.row.day, field, value, reason },
            { onSuccess: () => setDay(null) },
          );
        }}
      />
    </div>
  );
}

function CorrectionDialog({
  open,
  onOpenChange,
  day,
  rules,
  allowance,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  day: { row: DayRow; member: WorkMember } | null;
  rules: WorkRules;
  /** This person's paid vacation this year. */
  allowance: { used: number; total: number } | null;
  onSave: (field: "in" | "out" | "leave" | "excuse", value: string | null, reason: string) => void;
}) {
  const [field, setField] = useState<
    "in" | "out" | "leave" | "excuse" | "remove-in" | "remove-out"
  >("out");
  const [covers, setCovers] = useState<ExcuseCovers>("late");
  const [clock, setClock] = useState("16:30");
  const [leave, setLeave] = useState(rules.leaveTypes[0]?.id ?? "");
  const [reason, setReason] = useState("");
  if (!day) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Correct this day</DialogTitle>
          <DialogDescription>{`${day.member.display_name} · ${day.row.day}`}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!reason.trim()) return;
            if (field === "remove-in" || field === "remove-out")
              onSave(field === "remove-in" ? "in" : "out", null, reason.trim());
            else
              onSave(
                field,
                field === "leave"
                  ? leave
                  : field === "excuse"
                    ? covers
                    : zonedIso(day.row.day, clock, rules.timezone),
                reason.trim(),
              );
            setReason("");
          }}
        >
          <select
            className="h-10 w-full rounded-lg border border-border bg-card px-2 text-sm"
            value={field}
            onChange={(event) => setField(event.target.value as typeof field)}
          >
            <option value="in">{t("Set the clock-in time")}</option>
            <option value="out">{t("Set the clock-out time")}</option>
            {day.row.out ? (
              <option value="remove-out">{t("Remove the clock-out (a wrong tap)")}</option>
            ) : null}
            {day.row.in ? <option value="remove-in">{t("Remove the clock-in")}</option> : null}
            <option value="leave">{t("Mark as leave")}</option>
            <option value="excuse">{t("Excuse (late or early leave doesn't count)")}</option>
          </select>
          {field === "leave" ? (
            <select
              className="h-10 w-full rounded-lg border border-border bg-card px-2 text-sm"
              value={leave}
              onChange={(event) => setLeave(event.target.value)}
            >
              {rules.leaveTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {t(type.name)}
                </option>
              ))}
            </select>
          ) : null}
          {field === "leave" &&
          allowance &&
          usesAllowance(rules.leaveTypes.find((type) => type.id === leave)) ? (
            <p
              className={
                allowance.used >= allowance.total
                  ? "text-xs text-destructive"
                  : "text-xs text-muted-foreground"
              }
            >
              {`${t("Paid vacation used this year")}: ${allowance.used} ${t("of")} ${allowance.total} ${t("days")}`}
              {allowance.used >= allowance.total
                ? `. ${t("This day goes past their allowance; it can still be saved.")}`
                : ""}
            </p>
          ) : null}
          {field === "excuse" ? (
            <select
              aria-label={t("What is excused")}
              className="h-10 w-full rounded-lg border border-border bg-card px-2 text-sm"
              value={covers}
              onChange={(event) => setCovers(event.target.value as ExcuseCovers)}
            >
              <option value="late">{t("The late arrival")}</option>
              <option value="early">{t("The early leave")}</option>
              <option value="both">{t("Both")}</option>
              {day.row.excused.length ? (
                <option value="none">{t("Take the excuse back")}</option>
              ) : null}
            </select>
          ) : null}
          {field === "in" || field === "out" ? (
            <Input type="time" value={clock} onChange={(event) => setClock(event.target.value)} />
          ) : null}
          <Input
            value={reason}
            maxLength={300}
            placeholder={t("Reason (shown on the sheet)")}
            onChange={(event) => setReason(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {t("The original stays stored; the sheet shows this as a correction.")}
          </p>
          <Button type="submit" className="w-full" disabled={!reason.trim()}>
            {t("Save correction")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
