import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { parseISO } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/app/ConfirmDialog";
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
  RECURRENCE_FREQUENCIES,
  accountsQuery,
  createRecurringCost,
  deleteRecurringCost,
  financeCategoriesQuery,
  financeKeys,
  logRecurringCost,
  recurringCostsQuery,
  skipRecurringCost,
  updateRecurringCost,
  type RecurringCost,
  type RecurringCostInput,
} from "@/data/finance";
import { usePreferences } from "@/hooks/usePreferences";
import { todayISO } from "@/lib/date";

export const Route = createFileRoute("/_authenticated/finance/recurring")({
  head: () => ({
    meta: [
      { title: "Recurring costs — Life OS" },
      {
        name: "description",
        content: "Costs you expect again, shown before they arrive. Projections only until you log one.",
      },
      { property: "og:title", content: "Recurring costs — Life OS" },
      {
        property: "og:description",
        content: "Costs you expect again, shown before they arrive. Projections only until you log one.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RecurringPage,
});

const emptyForm: RecurringCostInput = {
  name: "",
  amount: 0,
  category_id: null,
  account_id: null,
  frequency: "monthly",
  next_due_date: todayISO(),
  active: true,
};

export function RecurringList({ compact = false }: { compact?: boolean }) {
  const queryClient = useQueryClient();
  const costs = useQuery(recurringCostsQuery());
  const { fmtDate, fmtMoney } = usePreferences();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: financeKeys.recurring });
    queryClient.invalidateQueries({ queryKey: financeKeys.transactions });
  };
  const onError = (e: unknown) =>
    toast.error(e instanceof Error ? e.message : "Something went wrong.");

  const log = useMutation({
    mutationFn: (cost: RecurringCost) => logRecurringCost(cost),
    onSuccess: () => {
      invalidate();
      toast.success("Logged and moved to its next date.");
    },
    onError,
  });

  const skip = useMutation({
    mutationFn: (cost: RecurringCost) => skipRecurringCost(cost),
    onSuccess: () => {
      invalidate();
      toast.success("Skipped — nothing was logged.");
    },
    onError,
  });

  if (costs.isLoading) return <LoadingState rows={2} />;
  if (costs.error) return <ErrorState error={costs.error} onRetry={() => costs.refetch()} />;

  const active = (costs.data ?? []).filter((c) => c.active);
  const list = compact ? active.slice(0, 5) : (costs.data ?? []);

  if (list.length === 0) {
    return (
      <EmptyState
        title="Nothing logged yet"
        description="Add the costs you know are coming so they stay in sight."
      />
    );
  }

  const today = new Date();

  return (
    <ul className="space-y-3">
      {list.map((cost) => {
        const due = parseISO(cost.next_due_date);
        const overdue = due < new Date(today.getFullYear(), today.getMonth(), today.getDate());
        return (
          <li
            key={cost.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
          >
            <div className="min-w-0">
              <p className="font-medium">{cost.name}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="tabular-nums">{fmtMoney(Number(cost.amount))}</span>
                <SemanticBadge tone={overdue ? "warning" : "neutral"}>
                  {overdue ? "Past its date" : "Due"} {fmtDate(cost.next_due_date)}
                </SemanticBadge>
                <span>
                  {RECURRENCE_FREQUENCIES.find((f) => f.value === cost.frequency)?.label}
                </span>
                {!cost.active ? <SemanticBadge tone="quiet">Paused</SemanticBadge> : null}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => log.mutate(cost)} disabled={log.isPending}>
                Log
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => skip.mutate(cost)}
                disabled={skip.isPending}
              >
                Skip
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function RecurringPage() {
  const queryClient = useQueryClient();
  const costs = useQuery(recurringCostsQuery());
  const accounts = useQuery(accountsQuery());
  const categories = useQuery(financeCategoriesQuery());

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringCost | null>(null);
  const [form, setForm] = useState<RecurringCostInput>(emptyForm);
  const [toDelete, setToDelete] = useState<RecurringCost | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: financeKeys.recurring });
  const onError = (e: unknown) =>
    toast.error(e instanceof Error ? e.message : "Something went wrong.");

  const save = useMutation({
    mutationFn: () =>
      editing ? updateRecurringCost(editing.id, form) : createRecurringCost(form),
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      toast.success(editing ? "Cost updated." : "Cost added.");
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteRecurringCost(id),
    onSuccess: () => {
      invalidate();
      setToDelete(null);
      toast.success("Cost deleted.");
    },
    onError,
  });

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, account_id: accounts.data?.[0]?.id ?? null });
    setDialogOpen(true);
  }

  function openEdit(cost: RecurringCost) {
    setEditing(cost);
    setForm({
      name: cost.name,
      amount: Number(cost.amount),
      category_id: cost.category_id,
      account_id: cost.account_id,
      frequency: cost.frequency,
      next_due_date: cost.next_due_date,
      active: cost.active,
    });
    setDialogOpen(true);
  }

  return (
    <>
      <PageHeader
        title="Recurring costs"
        description="Projections only. Nothing changes a balance until you log it."
        actions={<Button onClick={openCreate}>New cost</Button>}
      />

      <RecurringList />

      {(costs.data ?? []).length > 0 ? (
        <ul className="mt-6 space-y-2">
          {(costs.data ?? []).map((cost) => (
            <li
              key={cost.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border px-4 py-2 text-sm"
            >
              <span className="truncate">{cost.name}</span>
              <span className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => openEdit(cost)}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setToDelete(cost)}>
                  Delete
                </Button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? "Edit recurring cost" : "New recurring cost"}
        pending={save.isPending}
        onSubmit={() => save.mutate()}
      >
        <div className="space-y-2">
          <Label htmlFor="cost-name">Name</Label>
          <Input
            id="cost-name"
            required
            className="h-12"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cost-amount">Amount</Label>
            <Input
              id="cost-amount"
              type="number"
              step="0.01"
              min="0"
              required
              className="h-12 tabular-nums"
              value={form.amount || ""}
              onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cost-date">Next due</Label>
            <Input
              id="cost-date"
              type="date"
              required
              className="h-12"
              value={form.next_due_date}
              onChange={(e) => setForm({ ...form, next_due_date: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Frequency</Label>
            <Select
              value={form.frequency}
              onValueChange={(v) =>
                setForm({ ...form, frequency: v as RecurringCostInput["frequency"] })
              }
            >
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECURRENCE_FREQUENCIES.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Account</Label>
            <Select
              value={form.account_id ?? "none"}
              onValueChange={(v) => setForm({ ...form, account_id: v === "none" ? null : v })}
            >
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No account yet</SelectItem>
                {(accounts.data ?? []).map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={form.category_id ?? "none"}
              onValueChange={(v) => setForm({ ...form, category_id: v === "none" ? null : v })}
            >
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No category</SelectItem>
                {(categories.data ?? []).map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={form.active ? "active" : "paused"}
              onValueChange={(v) => setForm({ ...form, active: v === "active" })}
            >
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete this recurring cost?"
        description="Transactions you already logged from it stay as they are."
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />

      <QuickAddTransactionButton />
    </>
  );
}
