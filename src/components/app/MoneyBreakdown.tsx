import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  accountPocketsQuery,
  accountsQuery,
  availableBeforePayday,
  daysUntil,
  hasPaydaySetup,
  nextPayday,
  paydayConfigQuery,
  recurringCostsQuery,
  transactionsQuery,
} from "@/data/finance";
import { usePreferences } from "@/hooks/usePreferences";

/**
 * Every line here is a real row: the balance you have logged, the recurring
 * costs you set up, and the buffer you chose. Recurring costs stay projections
 * until you log them, so this figure is an estimate and says so.
 */
export function useAvailableBeforePayday() {
  const accounts = useQuery(accountsQuery());
  const transactions = useQuery(transactionsQuery());
  const pockets = useQuery(accountPocketsQuery());
  const costs = useQuery(recurringCostsQuery());
  const payday = useQuery(paydayConfigQuery());

  const config = payday.data ?? null;
  const paydayDate = nextPayday(config);
  const totals = availableBeforePayday({
    accounts: accounts.data ?? [],
    transactions: transactions.data ?? [],
    pockets: pockets.data ?? [],
    costs: costs.data ?? [],
    payday: paydayDate,
    safetyBuffer: config?.safety_buffer == null ? null : Number(config.safety_buffer),
  });

  return {
    ...totals,
    config,
    paydayDate,
    paydayReady: hasPaydaySetup(config),
    days: paydayDate ? daysUntil(paydayDate) : null,
    isLoading:
      accounts.isLoading ||
      transactions.isLoading ||
      pockets.isLoading ||
      costs.isLoading ||
      payday.isLoading,
  };
}

export function MoneyBreakdownDialog({ trigger }: { trigger: ReactNode }) {
  const { fmtDate, fmtMoney } = usePreferences();
  const { liquid, committed, buffer, available, upcoming, paydayDate, days } =
    useAvailableBeforePayday();

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>How this figure is worked out</DialogTitle>
          <DialogDescription>
            {paydayDate
              ? `Up to your next payday on ${fmtDate(paydayDate.toISOString().slice(0, 10))}${
                  days == null ? "" : days === 0 ? " · today" : ` · in ${days} ${days === 1 ? "day" : "days"}`
                }.`
              : "Add your payday in Settings to include upcoming costs."}
          </DialogDescription>
        </DialogHeader>

        <dl className="space-y-3 text-sm">
          <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2">
            <dt className="text-muted-foreground">Money in your accounts now</dt>
            <dd className="tabular-nums">{fmtMoney(liquid)}</dd>
          </div>

          <div className="space-y-2 border-b border-border pb-2">
            <dt className="text-muted-foreground">Recurring costs due before payday</dt>
            {upcoming.length ? (
              <ul className="space-y-1.5">
                {upcoming.map((cost) => (
                  <li key={cost.id} className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate">
                      {cost.name}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {fmtDate(cost.next_due_date)}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums">
                      −{fmtMoney(Math.abs(Number(cost.amount)))}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <dd className="text-muted-foreground">None set up for this period.</dd>
            )}
            <div className="flex items-baseline justify-between gap-3 pt-1 text-xs text-muted-foreground">
              <span>Total</span>
              <span className="tabular-nums">−{fmtMoney(committed)}</span>
            </div>
          </div>

          <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2">
            <dt className="text-muted-foreground">Safety buffer you chose</dt>
            <dd className="tabular-nums">−{fmtMoney(buffer)}</dd>
          </div>

          <div className="flex items-baseline justify-between gap-3 pt-1">
            <dt className="font-medium">Estimated left to spend</dt>
            <dd className="text-lg font-semibold tabular-nums">{fmtMoney(available)}</dd>
          </div>
        </dl>

        <p className="text-xs text-muted-foreground">
          Recurring costs are projections. They only change your balance when you log one.
        </p>
      </DialogContent>
    </Dialog>
  );
}
