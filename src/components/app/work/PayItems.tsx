import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { WorkMember, WorkOrg } from "@/data/work/api";
import {
  addPayItems,
  countsIn,
  isMonthly,
  monthStart,
  payItemsKey,
  stopPayItem,
  workPayItemsQuery,
  type PayItemKind,
  type WorkPayItem,
} from "@/data/work/payItems";
import type { WorkRules } from "@/data/work/rules";
import { isMissingTable } from "@/data/relationshipsApi";
import { t } from "@/lib/i18n";
import { toError } from "@/lib/supabase-helpers";

const KINDS: { value: PayItemKind; label: string }[] = [
  { value: "incentive", label: "Incentive" },
  { value: "allowance", label: "Transport allowance" },
  { value: "other", label: "Other addition" },
];

/**
 * Incentives, allowances and other money added to one person's pay this
 * month, with "Add money" for them or the whole team.
 */
export function PayItems({
  org,
  rules,
  member,
  members,
  month,
}: {
  org: WorkOrg;
  rules: WorkRules;
  member: WorkMember;
  members: WorkMember[];
  month: string;
}) {
  const queryClient = useQueryClient();
  const items = useQuery(workPayItemsQuery(org.id));
  const [adding, setAdding] = useState(false);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: payItemsKey(org.id) });
  const stop = useMutation({
    mutationFn: (item: WorkPayItem) => stopPayItem(item, month),
    onSuccess: () => {
      refresh();
      toast.success(t("Removed from this month on"));
    },
    onError: (error: unknown) => toast.error(toError(error).message),
  });

  if (items.error && isMissingTable(items.error))
    return (
      <p className="text-xs text-muted-foreground">
        {t("Incentives and allowances need a database update first.")}
      </p>
    );
  const mine = (items.data ?? []).filter(
    (item) => item.user_id === member.user_id && countsIn(item, month),
  );
  const money = (value: number) => `${Number(value).toLocaleString()} ${rules.currency}`;

  return (
    <section className="stat-card space-y-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{t("Incentives and allowances")}</p>
        <Button type="button" size="sm" variant="outline" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> {t("Add money")}
        </Button>
      </div>
      {mine.length ? (
        <ul className="space-y-1.5 text-sm">
          {mine.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0">
                {item.label} · +{money(item.amount)}
                <span className="ms-1 text-xs text-muted-foreground">
                  {isMonthly(item) ? t("every month") : t("this month")}
                </span>
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={stop.isPending}
                onClick={() => stop.mutate(item)}
              >
                {isMonthly(item) ? t("Stop from this month") : t("Remove")}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">{t("Nothing added for this month.")}</p>
      )}
      <AddMoneyDialog
        open={adding}
        onOpenChange={setAdding}
        org={org}
        member={member}
        members={members}
        month={month}
        onSaved={refresh}
      />
    </section>
  );
}

function AddMoneyDialog({
  open,
  onOpenChange,
  org,
  member,
  members,
  month,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  org: WorkOrg;
  member: WorkMember;
  members: WorkMember[];
  month: string;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState<PayItemKind>("incentive");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [monthly, setMonthly] = useState(false);
  const [everyone, setEveryone] = useState(false);
  const save = useMutation({
    mutationFn: () => {
      const start = monthStart(month);
      const people = everyone ? members : [member];
      return addPayItems(
        people.map((person) => ({
          org_id: org.id,
          user_id: person.user_id,
          kind,
          label: label.trim() || t(KINDS.find((item) => item.value === kind)!.label),
          amount: Math.round(Number(amount) * 100) / 100,
          from_month: start,
          until_month: monthly ? null : start,
        })),
      );
    },
    onSuccess: () => {
      onSaved();
      toast.success(t("Added"));
      setLabel("");
      setAmount("");
      onOpenChange(false);
    },
    onError: (error: unknown) => toast.error(toError(error).message),
  });
  const value = Number(amount);
  const valid = amount.trim() !== "" && Number.isFinite(value) && value > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Add money")}</DialogTitle>
          <DialogDescription>
            {`${everyone ? t("Everyone in the team") : member.display_name} · ${month}`}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (valid) save.mutate();
          }}
        >
          <select
            aria-label={t("Kind")}
            className="h-10 w-full rounded-lg border border-border bg-card px-2 text-sm"
            value={kind}
            onChange={(event) => {
              const next = event.target.value as PayItemKind;
              setKind(next);
              setMonthly(next === "allowance");
            }}
          >
            {KINDS.map((item) => (
              <option key={item.value} value={item.value}>
                {t(item.label)}
              </option>
            ))}
          </select>
          <Input
            value={label}
            maxLength={80}
            placeholder={t(KINDS.find((item) => item.value === kind)!.label)}
            aria-label={t("Name (optional)")}
            onChange={(event) => setLabel(event.target.value)}
          />
          <Input
            inputMode="decimal"
            value={amount}
            placeholder={t("Amount")}
            aria-label={t("Amount")}
            onChange={(event) => setAmount(event.target.value)}
          />
          <label className="flex items-center justify-between gap-3 text-sm">
            {t("Every month, until stopped")}
            <Switch checked={monthly} onCheckedChange={setMonthly} />
          </label>
          {members.length > 1 ? (
            <label className="flex items-center justify-between gap-3 text-sm">
              {`${t("For everyone in the team")} (${members.length})`}
              <Switch checked={everyone} onCheckedChange={setEveryone} />
            </label>
          ) : null}
          <Button type="submit" className="w-full" disabled={!valid || save.isPending}>
            {t("Add")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
