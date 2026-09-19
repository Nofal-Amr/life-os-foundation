import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { EntityIcon, EntityIdentityPicker } from "@/components/app/EntityIdentity";
import { FormDialog } from "@/components/app/FormDialog";
import { PageHeader } from "@/components/app/PageHeader";
import { QuickAddTransactionButton } from "@/components/app/QuickAddTransaction";
import { SemanticBadge } from "@/components/app/SemanticBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ACCOUNT_TYPES,
  accountBalance,
  accountsQuery,
  availableBeforePayday,
  createAccount,
  daysUntil,
  deleteAccount,
  financeKeys,
  hasPaydaySetup,
  nextPayday,
  paydayConfigQuery,
  recurringCostsQuery,
  transactionsQuery,
  updateAccount,
  savePaydayConfig,
  type Account,
  type AccountInput,
} from "@/data/finance";
import { usePreferences } from "@/hooks/usePreferences";
import { availabilityTone } from "@/lib/semantics";
import { RecurringList } from "./finance.recurring";

export const Route = createFileRoute("/_authenticated/finance/")({
  head: () => ({
    meta: [
      { title: "Money — Life OS" },
      {
        name: "description",
        content: "One glanceable figure: what you actually have before your next payday.",
      },
      { property: "og:title", content: "Money — Life OS" },
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

const emptyAccount: AccountInput = {
  name: "",
  type: "checking",
  opening_balance: 0,
  currency: null,
  active: true,
  icon: null,
  color: null,
};

function FinanceOverview() {
  const queryClient = useQueryClient();
  const accounts = useQuery(accountsQuery());
  const transactions = useQuery(transactionsQuery());
  const costs = useQuery(recurringCostsQuery());
  const payday = useQuery(paydayConfigQuery());
  const { fmtDate, fmtMoney } = usePreferences();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState<AccountInput>(emptyAccount);
  const [toDelete, setToDelete] = useState<Account | null>(null);
  const [editingPayday, setEditingPayday] = useState(false);
  const [expectedNet, setExpectedNet] = useState("");
  const [safetyBuffer, setSafetyBuffer] = useState("");

  const onError = (e: unknown) =>
    toast.error(e instanceof Error ? e.message : "Something went wrong.");

  const save = useMutation({
    mutationFn: () => (editing ? updateAccount(editing.id, form) : createAccount(form)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeKeys.accounts });
      setDialogOpen(false);
      toast.success(editing ? "Account updated." : "Account added.");
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteAccount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeKeys.accounts });
      queryClient.invalidateQueries({ queryKey: financeKeys.transactions });
      setToDelete(null);
      toast.success("Account deleted.");
    },
    onError,
  });

  const saveMoneySetup = useMutation({
    mutationFn: () => savePaydayConfig({
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
    accounts.isLoading || transactions.isLoading || costs.isLoading || payday.isLoading;
  const error = accounts.error ?? transactions.error ?? costs.error ?? payday.error;

  const config = payday.data ?? null;
  const setup = hasPaydaySetup(config);
  const nextDate = nextPayday(config);
  const days = nextDate ? daysUntil(nextDate) : null;

  const totals = availableBeforePayday({
    accounts: accounts.data ?? [],
    transactions: transactions.data ?? [],
    costs: costs.data ?? [],
    payday: nextDate,
    safetyBuffer: config?.safety_buffer == null ? null : Number(config.safety_buffer),
  });

  const hasAccounts = (accounts.data ?? []).length > 0;
  const shortfall = totals.available < 0;

  function openCreate() {
    setEditing(null);
    setForm(emptyAccount);
    setDialogOpen(true);
  }

  function openEdit(account: Account) {
    setEditing(account);
    setForm({
      name: account.name,
      type: account.type,
      opening_balance: Number(account.opening_balance),
      currency: account.currency,
      active: account.active,
      icon: account.icon,
      color: account.color,
    });
    setDialogOpen(true);
  }

  return (
    <>
      <PageHeader
        title="Money"
        description="Everything here comes from what you have logged."
        actions={<Button onClick={openCreate}>New account</Button>}
      />

      {loading ? (
        <LoadingState rows={4} />
      ) : error ? (
        <ErrorState
          error={error}
          onRetry={() => {
            accounts.refetch();
            transactions.refetch();
            costs.refetch();
            payday.refetch();
          }}
        />
      ) : (
        <div className="space-y-6">
          {/* The one glanceable number */}
          <section className="rounded-2xl border border-border bg-card p-6">
            <p className="text-sm text-muted-foreground">Total liquid balance</p>
            <p className="mt-1 text-4xl font-semibold tabular-nums tracking-tight">
              {hasAccounts ? fmtMoney(totals.liquid) : "—"}
            </p>
            {!hasAccounts ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Nothing logged yet. Add an account with its opening balance to see your figure.
              </p>
            ) : !setup ? (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <p className="text-sm text-muted-foreground">
                  Tell Life OS when you are paid and it can show what is free to spend before then.
                </p>
                <Button asChild size="sm" variant="outline">
                  <Link to="/settings">Set up payday</Link>
                </Button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <SemanticBadge tone={availabilityTone(totals.available)}>
                  {shortfall
                    ? `Committed costs exceed available funds before payday by ${fmtMoney(Math.abs(totals.available))}`
                    : `You have ${fmtMoney(totals.available)} to spend before payday`}
                </SemanticBadge>
                <dl className="grid min-w-0 gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-muted-foreground">Committed before payday</dt>
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
                        ? `${fmtDate(nextDate.toISOString().slice(0, 10))} · ${
                            days === 0 ? "today" : `${days} ${days === 1 ? "day" : "days"}`
                          }`
                        : "—"}
                    </dd>
                  </div>
                </dl>
                {editingPayday ? (
                  <form className="grid min-w-0 gap-3 rounded-lg border border-border p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end" onSubmit={(event) => { event.preventDefault(); saveMoneySetup.mutate(); }}>
                    <div className="min-w-0 space-y-2"><Label htmlFor="overview-expected">Expected net pay</Label><Input id="overview-expected" type="number" min="0" step="0.01" value={expectedNet} onChange={(event) => setExpectedNet(event.target.value)} /></div>
                    <div className="min-w-0 space-y-2"><Label htmlFor="overview-buffer">Safety buffer</Label><Input id="overview-buffer" type="number" min="0" step="0.01" value={safetyBuffer} onChange={(event) => setSafetyBuffer(event.target.value)} /></div>
                    <div className="flex gap-2"><Button type="submit" disabled={saveMoneySetup.isPending}>Save</Button><Button type="button" variant="ghost" onClick={() => setEditingPayday(false)}>Cancel</Button></div>
                  </form>
                ) : (
                  <Button type="button" size="sm" variant="outline" onClick={() => { setExpectedNet(config?.expected_net_amount == null ? "" : String(config.expected_net_amount)); setSafetyBuffer(config?.safety_buffer == null ? "" : String(config.safety_buffer)); setEditingPayday(true); }}>Edit pay and buffer</Button>
                )}
              </div>
            )}
          </section>

          {/* Accounts */}
          <section>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Accounts
            </h2>
            {!hasAccounts ? (
              <EmptyState
                title="Nothing logged yet"
                description="Add your accounts and their opening balances. Balances are always worked out from what you log."
                action={<Button onClick={openCreate}>Add an account</Button>}
              />
            ) : (
              <ul className="space-y-3">
                {(accounts.data ?? []).map((account) => (
                  <li
                    key={account.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
                  >
                     <div className="flex min-w-0 items-center gap-3">
                       <EntityIcon icon={account.icon} color={account.color} />
                       <div className="min-w-0"><p className="truncate font-medium">{account.name}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <SemanticBadge tone={account.type === "credit" ? "info" : "neutral"}>
                          {ACCOUNT_TYPES.find((t) => t.value === account.type)?.label}
                        </SemanticBadge>
                        {!account.active ? <SemanticBadge tone="quiet">Inactive</SemanticBadge> : null}
                      </div>
                       </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-medium tabular-nums">
                        {fmtMoney(accountBalance(account, transactions.data ?? []))}
                      </span>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(account)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setToDelete(account)}>
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Upcoming recurring costs stay in sight */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Coming up
              </h2>
              <Button asChild size="sm" variant="ghost">
                <Link to="/finance/recurring">Manage</Link>
              </Button>
            </div>
            <RecurringList compact />
          </section>
        </div>
      )}

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? "Edit account" : "New account"}
        pending={save.isPending}
        onSubmit={() => save.mutate()}
      >
        <div className="space-y-2">
          <Label htmlFor="account-name">Name</Label>
          <Input
            id="account-name"
            required
            className="h-12"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <EntityIdentityPicker value={{ icon: form.icon, color: form.color }} onChange={(identity) => setForm({ ...form, ...identity })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={form.type}
              onValueChange={(v) => setForm({ ...form, type: v as AccountInput["type"] })}
            >
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-opening">Opening balance</Label>
            <Input
              id="account-opening"
              type="number"
              step="0.01"
              className="h-12 tabular-nums"
              value={form.opening_balance}
              onChange={(e) => setForm({ ...form, opening_balance: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={form.active ? "active" : "inactive"}
              onValueChange={(v) => setForm({ ...form, active: v === "active" })}
            >
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete this account?"
        description={(() => {
          const used = (transactions.data ?? []).filter(
            (t) => t.account_id === toDelete?.id,
          ).length;
          return used > 0
            ? `${used} ${used === 1 ? "transaction is" : "transactions are"} logged against this account and will be removed with it.`
            : "This cannot be undone.";
        })()}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />

      <QuickAddTransactionButton />
    </>
  );
}
