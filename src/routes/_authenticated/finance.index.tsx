import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Info,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AnimatedNumber } from "@/components/app/AnimatedNumber";
import { AreaHabits } from "@/components/app/AreaHabits";
import { MoreSections, Section } from "@/components/app/MoreSections";
import { ResourcesSummary } from "@/components/app/ResourcesSummary";
import { todayISO } from "@/lib/date";

import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { FormDialog } from "@/components/app/FormDialog";
import { MoneyBreakdownDialog } from "@/components/app/MoneyBreakdown";
import { PageHeader } from "@/components/app/PageHeader";
import { QuickAddTransactionDialog } from "@/components/app/QuickAddTransaction";
import {
  GlanceSection,
  NotEnoughData,
  RingStat,
  StatCard,
  WeeklyBars,
} from "@/components/app/StatCards";
import { SemanticBadge } from "@/components/app/SemanticBadge";
import { ErrorState, LoadingState } from "@/components/app/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  accountPocketsQuery,
  accountsQuery,
  availableBeforePayday,
  countsTowardSpendable,
  daysUntil,
  financeCategoriesQuery,
  financeKeys,
  hasPaydaySetup,
  monthlyEquivalent,
  nextPayday,
  paydayConfigQuery,
  recurringCostsQuery,
  transactionsQuery,
  savePaydayConfig,
  separateBalance,
} from "@/data/finance";
import { hasEnoughPoints, paydayCycle, weeklySpendByCategory } from "@/data/stats";
import { usePreferences } from "@/hooks/usePreferences";
import { availabilityTone } from "@/lib/semantics";
import { RecurringList } from "./finance.recurring";

export const Route = createFileRoute("/_authenticated/finance/")({
  head: () => ({
    meta: [
      { title: "Money · Life OS" },
      {
        name: "description",
        content: "One glanceable figure: what you actually have before your next payday.",
      },
      { property: "og:title", content: "Money · Life OS" },
      {
        property: "og:description",
        content: "One glanceable figure: what you actually have before your next payday.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FinanceOverview,
});


function FinanceOverview() {
  const queryClient = useQueryClient();
  const accounts = useQuery(accountsQuery());
  const transactions = useQuery(transactionsQuery());
  const pockets = useQuery(accountPocketsQuery());
  const costs = useQuery(recurringCostsQuery());
  const payday = useQuery(paydayConfigQuery());
  const categories = useQuery(financeCategoriesQuery());
  const { fmtDate, fmtMoney } = usePreferences();

  const [editingPayday, setEditingPayday] = useState(false);
  const [expectedNet, setExpectedNet] = useState("");
  const [safetyBuffer, setSafetyBuffer] = useState("");
  const [quickAdd, setQuickAdd] = useState<"expense" | "income" | null>(null);

  const onError = (e: unknown) =>
    toast.error(e instanceof Error ? e.message : "Something went wrong.");


  const saveMoneySetup = useMutation({
    mutationFn: () =>
      savePaydayConfig({
        expected_net_amount: expectedNet === "" ? null : Number(expectedNet),
        safety_buffer: safetyBuffer === "" ? null : Number(safetyBuffer),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeKeys.payday });
      setEditingPayday(false);
      toast.success("Money setup updated.");
    },
    onError,
  });

  const loading =
    accounts.isLoading ||
    transactions.isLoading ||
    pockets.isLoading ||
    costs.isLoading ||
    payday.isLoading;
  const error =
    accounts.error ?? transactions.error ?? pockets.error ?? costs.error ?? payday.error;

  const config = payday.data ?? null;
  const cycle = paydayCycle(config);
  const spend = weeklySpendByCategory(transactions.data ?? [], categories.data ?? []);
  const spendTotal = spend.rows.reduce((sum, week) => sum + week.total, 0);
  const setup = hasPaydaySetup(config);
  const nextDate = nextPayday(config);
  const days = nextDate ? daysUntil(nextDate) : null;

  // What today has cost so far, from logged expenses.
  const todayExpenses = (transactions.data ?? []).filter(
    (t) => t.kind === "expense" && t.date === todayISO(),
  );
  const spentToday = todayExpenses.reduce((sum, t) => sum + Number(t.amount), 0);
  const todayCount = todayExpenses.length;

  const totals = availableBeforePayday({
    accounts: accounts.data ?? [],
    transactions: transactions.data ?? [],
    pockets: pockets.data ?? [],
    costs: costs.data ?? [],
    payday: nextDate,
    safetyBuffer: config?.safety_buffer == null ? null : Number(config.safety_buffer),
  });

  const hasAccounts = (accounts.data ?? []).length > 0;
  const monthlyRecurring = (costs.data ?? []).reduce((sum, cost) => sum + monthlyEquivalent(cost), 0);
  const separateAccounts = (accounts.data ?? []).filter(
    (account) => account.active && !countsTowardSpendable(account),
  );
  const keptSeparate = separateBalance(
    accounts.data ?? [],
    transactions.data ?? [],
    pockets.data ?? [],
  );
  const untilPayday =
    days === null
      ? null
      : days === 0
        ? "Payday is today"
        : `${days} ${days === 1 ? "day" : "days"} until payday`;
  const shortfall = totals.available < 0;


  return (
    <>
      <PageHeader
        title="Money"
        description="Everything here comes from what you have logged."
        actions={
          <Button asChild variant="outline">
            <Link to="/finance/accounts">Accounts</Link>
          </Button>
        }
      />
      <AreaHabits category="money" title="Money habits" className="mb-6" />

      {loading ? (
        <LoadingState rows={4} />
      ) : error ? (
        <ErrorState
          error={error}
          onRetry={() => {
            accounts.refetch();
            transactions.refetch();
            pockets.refetch();
            costs.refetch();
            payday.refetch();
          }}
        />
      ) : (
        <div className="space-y-6">
          {/* The one glanceable number */}
          <section className="stat-card p-6 sm:p-8">
            {setup && hasAccounts ? (
              <>
                <p className="text-sm font-medium text-muted-foreground">
                  Left to spend before payday
                </p>
                <p className="mt-2 text-5xl font-semibold tabular-nums tracking-tight sm:text-6xl">
                  <AnimatedNumber value={fmtMoney(totals.available)} />
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {untilPayday ? `${untilPayday} · ` : ""}After upcoming recurring costs and your
                  safety buffer.
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Spent today:{" "}
                  <span className="font-medium tabular-nums text-foreground">
                    {fmtMoney(spentToday)}
                  </span>
                  {todayCount ? ` · ${todayCount} ${todayCount === 1 ? "entry" : "entries"}` : ""}
                </p>
                <MoneyActions onAdd={setQuickAdd} />
                <div className="mt-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <SemanticBadge tone={availabilityTone(totals.available)}>
                      {shortfall
                        ? `Upcoming costs are ${fmtMoney(Math.abs(totals.available))} more than you have`
                        : `Balance now is ${fmtMoney(totals.liquid)}`}
                    </SemanticBadge>
                    <MoneyBreakdownDialog
                      trigger={
                        <Button type="button" size="sm" variant="outline">
                          <Info className="size-4" />
                          How this is worked out
                        </Button>
                      }
                    />
                  </div>
                  <dl className="grid min-w-0 gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-muted-foreground">Recurring costs before payday</dt>
                      <dd className="tabular-nums">{fmtMoney(totals.committed)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Safety buffer</dt>
                      <dd className="tabular-nums">{fmtMoney(totals.buffer)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Next payday</dt>
                      <dd className="tabular-nums">
                        {nextDate
                          ? `${fmtDate(format(nextDate, "yyyy-MM-dd"))} · ${
                              days === 0 ? "today" : `${days} ${days === 1 ? "day" : "days"}`
                            }`
                          : "—"}
                      </dd>
                    </div>
                  </dl>
                  {separateAccounts.length ? (
                    <KeptSeparate
                      amount={fmtMoney(keptSeparate)}
                      names={separateAccounts.map((account) => account.name)}
                    />
                  ) : null}
                  {editingPayday ? (
                    <form
                      className="grid min-w-0 gap-3 rounded-lg border border-border p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
                      onSubmit={(event) => {
                        event.preventDefault();
                        saveMoneySetup.mutate();
                      }}
                    >
                      <div className="min-w-0 space-y-2">
                        <Label htmlFor="overview-expected">Expected net pay</Label>
                        <Input
                          id="overview-expected"
                          type="number"
                          min="0"
                          step="0.01"
                          value={expectedNet}
                          onChange={(event) => setExpectedNet(event.target.value)}
                        />
                      </div>
                      <div className="min-w-0 space-y-2">
                        <Label htmlFor="overview-buffer">Safety buffer</Label>
                        <Input
                          id="overview-buffer"
                          type="number"
                          min="0"
                          step="0.01"
                          value={safetyBuffer}
                          onChange={(event) => setSafetyBuffer(event.target.value)}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit" disabled={saveMoneySetup.isPending}>
                          Save
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setEditingPayday(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setExpectedNet(
                          config?.expected_net_amount == null
                            ? ""
                            : String(config.expected_net_amount),
                        );
                        setSafetyBuffer(
                          config?.safety_buffer == null ? "" : String(config.safety_buffer),
                        );
                        setEditingPayday(true);
                      }}
                    >
                      Edit pay and buffer
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-muted-foreground">
                  Balance you can spend
                </p>
                <p className="mt-2 text-5xl font-semibold tabular-nums tracking-tight sm:text-6xl">
                  {hasAccounts ? <AnimatedNumber value={fmtMoney(totals.liquid)} /> : "—"}
                </p>
                {hasAccounts ? <MoneyActions onAdd={setQuickAdd} /> : null}
                {separateAccounts.length ? (
                  <div className="mt-3">
                    <KeptSeparate
                      amount={fmtMoney(keptSeparate)}
                      names={separateAccounts.map((account) => account.name)}
                    />
                  </div>
                ) : null}
                {!hasAccounts ? (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <p className="text-sm text-muted-foreground">
                      Nothing logged yet. Add an account with its opening balance to see your
                      figure.
                    </p>
                    <Button asChild size="sm">
                      <Link to="/finance/accounts" search={{ new: true }}>
                        Add an account
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <p className="text-sm text-muted-foreground">
                      Tell Life OS when you are paid and it can show what is free to spend before
                      then.
                    </p>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/settings">Set up payday</Link>
                    </Button>
                  </div>
                )}
              </>
            )}
          </section>

          <MoreSections id="money">
          <Section id="money-glance" title="At a glance">
          <GlanceSection>
            {cycle ? (
              <RingStat
                title="Payday cycle"
                icon={CalendarDays}
                done={cycle.elapsed}
                total={cycle.total}
                center={`${cycle.elapsed}/${cycle.total}`}
                headline={`${cycle.elapsed} of ${cycle.total} days`}
                detail={`Since payday on ${fmtDate(cycle.start)}. Next payday ${fmtDate(cycle.end)}.`}
                tone={1}
                ringLabel={`${cycle.elapsed} of ${cycle.total} days of the payday cycle have passed`}
              />
            ) : (
              <StatCard title="Payday cycle" icon={CalendarDays}>
                <p className="text-sm text-muted-foreground">
                  Set your payday in{" "}
                  <Link to="/settings" className="text-foreground underline underline-offset-4">
                    Settings
                  </Link>{" "}
                  to see how far through the cycle you are.
                </p>
              </StatCard>
            )}

            {categories.error ? (
              <StatCard title="Spending per week" icon={Wallet}>
                <p className="text-sm text-muted-foreground">
                  Categories could not be loaded, so this chart is paused.
                </p>
              </StatCard>
            ) : categories.data && hasEnoughPoints(spend.rows) ? (
              <WeeklyBars
                title="Spending per week"
                icon={Wallet}
                badge="8 weeks"
                description="Money out, by category, over the last 8 weeks."
                rows={spend.rows}
                series={spend.series}
                formatValue={fmtMoney}
                hero={{
                  value: fmtMoney(spendTotal),
                  caption: `logged across ${spend.rows.length} weeks`,
                }}
                legend
              />
            ) : categories.data ? (
              <StatCard title="Spending per week" icon={Wallet}>
                <NotEnoughData hint="Log spending in at least two different weeks." />
              </StatCard>
            ) : null}
          </GlanceSection>
          </Section>


          {/* What is due next stays one tap away. */}
          <Section id="money-coming" title="Coming up">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {monthlyRecurring > 0 ? (
                  <>
                    Recurring costs come to about{" "}
                    <span className="tabular-nums text-foreground">{fmtMoney(monthlyRecurring)}</span>{" "}
                    a month.
                  </>
                ) : (
                  "No recurring costs yet."
                )}
              </p>
              <Button asChild size="sm" variant="ghost">
                <Link to="/finance/recurring">Manage</Link>
              </Button>
            </div>
            <RecurringList compact />
          </Section>
          </MoreSections>
        </div>
      )}


      <QuickAddTransactionDialog
        open={quickAdd !== null}
        onOpenChange={(open) => !open && setQuickAdd(null)}
        {...(quickAdd ? { initialKind: quickAdd } : {})}
      />

    </>
  );
}

/** Log money right from the overview. */
function MoneyActions({ onAdd }: { onAdd: (kind: "expense" | "income") => void }) {
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      <Button type="button" onClick={() => onAdd("expense")}>
        <ArrowUpRight className="size-4" aria-hidden="true" />
        Add spending
      </Button>
      <Button type="button" variant="outline" onClick={() => onAdd("income")}>
        <ArrowDownLeft className="size-4" aria-hidden="true" />
        Add income
      </Button>
      <Button asChild variant="ghost">
        <Link to="/finance/transactions">All transactions</Link>
      </Button>
    </div>
  );
}

/** Accounts tracked apart from left to spend, such as a home fund. */
function KeptSeparate({ amount, names }: { amount: string; names: string[] }) {
  return (
    <p className="text-sm text-muted-foreground">
      Kept separate, not in this figure:{" "}
      <span className="tabular-nums text-foreground">{amount}</span> in {names.join(", ")}.
    </p>
  );
}
