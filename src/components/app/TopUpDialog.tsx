import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { accountsQuery, createTransaction, financeKeys, signedAmount } from "@/data/finance";
import { addReading, isMoneyUnit, resourceKeys, topUpPlan, type Resource } from "@/data/resources";
import { usePreferences } from "@/hooks/usePreferences";
import { todayISO } from "@/lib/date";
import { toError } from "@/lib/supabase-helpers";
import { cn } from "@/lib/utils";

const num = (text: string) => (text.trim() === "" ? null : Number(text));

/**
 * A top-up in one step: what you paid (logged as spending from an account)
 * and what the balance gained, which becomes the new reading. A negative
 * balance is paid back first; paid minus credited shows as fees.
 */
export function TopUpDialog({
  resource,
  balance,
  open,
  onOpenChange,
}: {
  resource: Resource;
  /** The latest reading, or null for none yet. */
  balance: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const accounts = useQuery(accountsQuery());
  const { fmtMoney, currency } = usePreferences();
  const [paid, setPaid] = useState("");
  const [mode, setMode] = useState<"credited" | "after">("credited");
  const [value, setValue] = useState("");
  const [accountId, setAccountId] = useState("none");
  /** What the meter shows right before the top-up; starts at the last reading. */
  const [before, setBefore] = useState("");

  useEffect(() => {
    if (!open) return;
    setPaid("");
    setValue("");
    setMode("credited");
    setBefore(balance == null ? "" : String(balance));
    setAccountId(
      resource.account_id ?? (accounts.data ?? []).find((account) => account.active)?.id ?? "none",
    );
    // Only when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const moneyUnit = isMoneyUnit(resource.unit, currency);
  const current = num(before) ?? balance;
  const plan = topUpPlan({
    balance: current,
    paid: num(paid) ?? 0,
    // For a money balance, "Added" left empty means all of it went on (the hint shows it).
    credited: mode === "credited" ? (num(value) ?? (moneyUnit ? num(paid) : null)) : null,
    balanceAfter: mode === "after" ? num(value) : null,
    moneyUnit,
  });
  const ready = (num(paid) ?? 0) > 0 && plan.balanceAfter != null;

  const save = useMutation({
    mutationFn: async () => {
      const amountPaid = num(paid)!;
      const note = [
        `Top-up: paid ${fmtMoney(amountPaid)}`,
        plan.credited != null ? `credited ${plan.credited} ${resource.unit}` : null,
        plan.fees ? `${fmtMoney(plan.fees)} fees` : null,
      ]
        .filter(Boolean)
        .join(", ");
      // The meter moved since the last reading: save where it was first, so
      // the top-up lands on today's number and the usage in between counts.
      if (current != null && current !== balance) {
        await addReading({
          resource_id: resource.id,
          reading: current,
          reading_at: new Date(Date.now() - 1000).toISOString(),
          note: null,
        });
      }
      if (accountId !== "none") {
        await createTransaction({
          account_id: accountId,
          kind: "expense",
          amount: signedAmount(amountPaid, "expense"),
          date: todayISO(),
          description: `${resource.name} top-up${plan.credited != null ? ` · +${plan.credited} ${resource.unit}` : ""}`,
          category_id: resource.category_id,
        });
      }
      return addReading({
        resource_id: resource.id,
        reading: plan.balanceAfter!,
        reading_at: new Date().toISOString(),
        note,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: resourceKeys.readings });
      void queryClient.invalidateQueries({ queryKey: financeKeys.transactions });
      toast.success(
        accountId !== "none" ? "Top-up logged, with the spending in Money." : "Top-up logged.",
      );
      onOpenChange(false);
    },
    onError: (error) => toast.error(toError(error).message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Top up · {resource.name}</DialogTitle>
          <DialogDescription>
            {current != null && current < 0
              ? `The balance is ${current} ${resource.unit}; that is paid back first.`
              : "What the meter shows, what you paid, and what it added."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (ready) save.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="topup-before">Meter now, before the top-up ({resource.unit})</Label>
            <Input
              id="topup-before"
              inputMode="decimal"
              className="h-12 tabular-nums"
              value={before}
              placeholder="What it shows"
              onChange={(event) => setBefore(event.target.value)}
            />
            {balance != null ? (
              <p className="text-xs text-muted-foreground">
                Last reading {balance} {resource.unit}. Change it if the meter shows something else now.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="topup-paid">You paid</Label>
            <Input
              id="topup-paid"
              autoFocus
              inputMode="decimal"
              className="h-12 text-lg tabular-nums"
              value={paid}
              onChange={(event) => setPaid(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div
              className="flex gap-1 rounded-lg bg-secondary p-1"
              role="radiogroup"
              aria-label="What you know"
            >
              {(
                [
                  { value: "credited", label: `Added (${resource.unit})` },
                  { value: "after", label: "Balance after" },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={mode === option.value}
                  onClick={() => setMode(option.value)}
                  className={cn(
                    "min-h-9 flex-1 rounded-md text-xs font-medium transition-colors",
                    mode === option.value
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <Input
              aria-label={mode === "credited" ? "Amount added" : "Balance after the top-up"}
              inputMode="decimal"
              className="h-12 tabular-nums"
              value={value}
              placeholder={mode === "credited" && moneyUnit && paid ? paid : ""}
              onChange={(event) => setValue(event.target.value)}
            />
          </div>

          {plan.balanceAfter != null ? (
            <p className="rounded-lg bg-secondary p-3 text-sm tabular-nums">
              New balance {plan.balanceAfter} {resource.unit}
              {plan.fees ? (
                <span className="text-muted-foreground"> · {fmtMoney(plan.fees)} went to fees</span>
              ) : null}
            </p>
          ) : null}

          <div className="space-y-2">
            <Label>Paid from</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Don't log spending</SelectItem>
                {(accounts.data ?? [])
                  .filter((account) => account.active)
                  .map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Logs the spending in Money for you, under this resource's category.
            </p>
          </div>

          <Button type="submit" className="h-12 w-full" disabled={!ready || save.isPending}>
            {save.isPending ? "Saving…" : "Log top-up"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
