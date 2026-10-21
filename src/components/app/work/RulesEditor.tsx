import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { saveRules, workKeys, type WorkOrg } from "@/data/work/api";
import { ADO_PRESET, type LateStep, type WorkRules } from "@/data/work/rules";
import { t } from "@/lib/i18n";
import { toError } from "@/lib/supabase-helpers";
import { cn } from "@/lib/utils";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * The company's rules, as a small rule builder. Everything is a setting; the
 * ADO sheet is only a ready-made starting point.
 */
export function RulesEditor({ org, rules: saved }: { org: WorkOrg; rules: WorkRules }) {
  const queryClient = useQueryClient();
  const [rules, setRules] = useState<WorkRules>(saved);
  const set = <K extends keyof WorkRules>(key: K, value: WorkRules[K]) =>
    setRules({ ...rules, [key]: value });
  const save = useMutation({
    mutationFn: () => saveRules(org.id, rules),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workKeys.all });
      toast.success(t("Rules saved. Sheets use them right away."));
    },
    onError: (error: unknown) => toast.error(toError(error).message),
  });
  const number = (text: string, fallback: number) => {
    const value = Number(text);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  };
  const setStep = (index: number, step: LateStep) =>
    set(
      "lateSteps",
      rules.lateSteps.map((item, at) => (at === index ? step : item)),
    );

  return (
    <div className="space-y-5">
      <Group title="Work days and hours">
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map((label, day) => {
            const on = rules.workDays.includes(day);
            return (
              <button
                key={label}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  set(
                    "workDays",
                    on
                      ? rules.workDays.filter((item) => item !== day)
                      : [...rules.workDays, day].sort(),
                  )
                }
                className={cn(
                  "rounded-full border px-3 py-1 text-sm",
                  on ? "border-primary bg-primary/10" : "border-border text-muted-foreground",
                )}
              >
                {t(label)}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3">
          <Field label="Starts">
            <Input
              type="time"
              className="h-9 w-32"
              value={rules.dayStart}
              onChange={(event) => set("dayStart", event.target.value)}
            />
          </Field>
          <Field label="Ends">
            <Input
              type="time"
              className="h-9 w-32"
              value={rules.dayEnd}
              onChange={(event) => set("dayEnd", event.target.value)}
            />
          </Field>
          <Field label="Grace before late (min)">
            <Input
              inputMode="numeric"
              className="h-9 w-24"
              value={rules.graceMinutes}
              onChange={(event) => set("graceMinutes", number(event.target.value, 0))}
            />
          </Field>
        </div>
      </Group>

      <Group
        title="Arriving very late"
        hint="Each step: arriving after a time gives a penalty instead of late minutes. A ladder grows with how many times it happened this month (1st, 2nd, 3rd…)."
      >
        {rules.lateSteps.map((step, index) => (
          <div key={index} className="flex flex-wrap items-end gap-2 rounded-lg bg-secondary p-3">
            <Field label="After">
              <Input
                type="time"
                className="h-9 w-32"
                value={step.after}
                onChange={(event) => setStep(index, { ...step, after: event.target.value })}
              />
            </Field>
            <Field label="Penalty">
              <select
                className="h-9 rounded-lg border border-border bg-card px-2 text-sm"
                value={step.penalty.kind}
                onChange={(event) =>
                  setStep(index, {
                    ...step,
                    penalty:
                      event.target.value === "day"
                        ? { kind: "day" }
                        : { kind: "ladder", minutes: [120, 150, 180], thenAdd: 30 },
                  })
                }
              >
                <option value="ladder">{t("Minutes, by occurrence")}</option>
                <option value="day">{t("A whole day")}</option>
              </select>
            </Field>
            {step.penalty.kind === "ladder" ? (
              <>
                <Field label="Minutes for the 1st, 2nd, 3rd…">
                  <Input
                    className="h-9 w-40"
                    defaultValue={step.penalty.minutes.join(", ")}
                    onBlur={(event) =>
                      setStep(index, {
                        ...step,
                        penalty: {
                          kind: "ladder",
                          minutes: event.target.value
                            .split(/[,\s]+/)
                            .map(Number)
                            .filter((value) => Number.isFinite(value) && value >= 0),
                          thenAdd: step.penalty.kind === "ladder" ? step.penalty.thenAdd : 30,
                        },
                      })
                    }
                  />
                </Field>
                <Field label="Then add each time">
                  <Input
                    inputMode="numeric"
                    className="h-9 w-24"
                    value={step.penalty.thenAdd}
                    onChange={(event) =>
                      step.penalty.kind === "ladder" &&
                      setStep(index, {
                        ...step,
                        penalty: { ...step.penalty, thenAdd: number(event.target.value, 0) },
                      })
                    }
                  />
                </Field>
              </>
            ) : null}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={t("Remove step")}
              onClick={() =>
                set(
                  "lateSteps",
                  rules.lateSteps.filter((_, at) => at !== index),
                )
              }
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            set("lateSteps", [...rules.lateSteps, { after: "09:30", penalty: { kind: "day" } }])
          }
        >
          <Plus className="size-4" /> {t("Add a step")}
        </Button>
        <Field label="A day's penalty costs base salary ÷">
          <Input
            inputMode="numeric"
            className="h-9 w-24"
            value={rules.dayPenaltyDivisor}
            onChange={(event) => set("dayPenaltyDivisor", number(event.target.value, 30))}
          />
        </Field>
      </Group>

      <Group title="Overtime and pay">
        <Toggle
          label="Count minutes before the start"
          checked={rules.overtime.beforeStart}
          onChange={(value) => set("overtime", { ...rules.overtime, beforeStart: value })}
        />
        <Toggle
          label="Count minutes after the end"
          checked={rules.overtime.afterEnd}
          onChange={(value) => set("overtime", { ...rules.overtime, afterEnd: value })}
        />
        <Toggle
          label="A worked day off is all overtime"
          checked={rules.overtime.dayOffAllOvertime}
          onChange={(value) => set("overtime", { ...rules.overtime, dayOffAllOvertime: value })}
        />
        <Toggle
          label="Count leaving early (deducted like late)"
          checked={rules.earlyLeaveCounted}
          onChange={(value) => set("earlyLeaveCounted", value)}
        />
        <div className="flex flex-wrap gap-3">
          <Field label="Overtime counts from (min)">
            <Input
              inputMode="numeric"
              className="h-9 w-24"
              value={rules.overtime.minimumMinutes}
              onChange={(event) =>
                set("overtime", {
                  ...rules.overtime,
                  minimumMinutes: number(event.target.value, 0),
                })
              }
            />
          </Field>
          <Field label="Hourly rate">
            <select
              className="h-9 rounded-lg border border-border bg-card px-2 text-sm"
              value={rules.rate.kind}
              onChange={(event) =>
                set(
                  "rate",
                  event.target.value === "fixed"
                    ? { kind: "fixed", perHour: 47 }
                    : { kind: "fromSalary" },
                )
              }
            >
              <option value="fixed">{t("A fixed amount")}</option>
              <option value="fromSalary">{t("Base salary ÷ the month's working hours")}</option>
            </select>
          </Field>
          {rules.rate.kind === "fixed" ? (
            <Field label={`${t("Per hour")} (${rules.currency})`}>
              <Input
                inputMode="decimal"
                className="h-9 w-24"
                value={rules.rate.perHour}
                onChange={(event) =>
                  set("rate", { kind: "fixed", perHour: number(event.target.value, 0) })
                }
              />
            </Field>
          ) : null}
          <Field label="Currency">
            <Input
              className="h-9 w-24"
              maxLength={3}
              value={rules.currency}
              onChange={(event) => set("currency", event.target.value.toUpperCase())}
            />
          </Field>
        </div>
      </Group>

      <Group
        title="Leave"
        hint="Each kind of leave and how much of the base salary a day of it costs."
      >
        {rules.leaveTypes.map((type, index) => (
          <div key={type.id} className="flex flex-wrap items-end gap-2">
            <Field label="Name">
              <Input
                className="h-9 w-56"
                value={type.name}
                onChange={(event) =>
                  set(
                    "leaveTypes",
                    rules.leaveTypes.map((item, at) =>
                      at === index ? { ...item, name: event.target.value } : item,
                    ),
                  )
                }
              />
            </Field>
            <Field label="% of base per day">
              <Input
                inputMode="decimal"
                className="h-9 w-24"
                value={type.percent}
                onChange={(event) =>
                  set(
                    "leaveTypes",
                    rules.leaveTypes.map((item, at) =>
                      at === index ? { ...item, percent: number(event.target.value, 0) } : item,
                    ),
                  )
                }
              />
            </Field>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={t("Remove")}
              onClick={() =>
                set(
                  "leaveTypes",
                  rules.leaveTypes.filter((_, at) => at !== index),
                )
              }
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            set("leaveTypes", [
              ...rules.leaveTypes,
              { id: `leave-${Date.now().toString(36)}`, name: t("Sick leave"), percent: 0 },
            ])
          }
        >
          <Plus className="size-4" /> {t("Add a kind of leave")}
        </Button>
        <Toggle
          label="Leave deductions come off the total"
          checked={rules.absenceFromTotal}
          onChange={(value) => set("absenceFromTotal", value)}
        />
      </Group>

      <Group title="Clocking in away from a place">
        <select
          className="h-10 w-full rounded-lg border border-border bg-card px-2 text-sm"
          value={rules.outsideRadius}
          onChange={(event) =>
            set("outsideRadius", event.target.value as WorkRules["outsideRadius"])
          }
        >
          <option value="refuseAndRecord">{t("Refuse, but keep the attempt with a reason")}</option>
          <option value="refuse">{t("Refuse")}</option>
          <option value="allowWithReason">{t("Allow it with a reason (marked for admins)")}</option>
        </select>
      </Group>

      <div className="sticky bottom-0 flex flex-wrap gap-2 bg-background py-3">
        <Button type="button" disabled={save.isPending} onClick={() => save.mutate()}>
          {t("Save rules")}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setRules(ADO_PRESET)}>
          {t("Start from the ADO example")}
        </Button>
      </div>
    </div>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="stat-card space-y-3 p-5">
      <div>
        <p className="text-sm font-semibold">{t(title)}</p>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{t(hint)}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1 text-xs text-muted-foreground">
      <span className="block">{t(label)}</span>
      {children}
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      {t(label)}
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
