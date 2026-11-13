import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { parseISO } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { DatePicker } from "@/components/app/DatePicker";
import { EntityIcon } from "@/components/app/EntityIdentity";
import { FormDialog } from "@/components/app/FormDialog";
import { ListRow, RowList } from "@/components/app/ListRow";
import { PageHeader } from "@/components/app/PageHeader";
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
  accountsQuery,
  createCategory,
  createRecurringCost,
  deleteRecurringCost,
  financeCategoriesQuery,
  financeKeys,
  logRecurringCost,
  recurringCostsQuery,
  skipRecurringCost,
  legacyFrequency,
  recurringInterval,
  updateRecurringCost,
  type RecurringCost,
  type RecurringCostInput,
  type IntervalUnit,
} from "@/data/finance";
import { usePreferences } from "@/hooks/usePreferences";
import { todayISO } from "@/lib/date";

export const Route = createFileRoute("/_authenticated/finance/recurring")({
  head: () => ({
    meta: [
      { title: "Recurring costs · Life OS" },
      {
        name: "description",
        content:
          "Costs you expect again, shown before they arrive. Projections only until you log one.",
      },
      { property: "og:title", content: "Recurring costs · Life OS" },
      {
        property: "og:description",
        content:
          "Costs you expect again, shown before they arrive. Projections only until you log one.",
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
  interval_count: 1,
  interval_unit: "month",
  next_due_at: `${todayISO()}T00:00:00`,
};

export function RecurringList({
  compact = false,
  onEdit,
  onDelete,
}: {
  compact?: boolean;
  /** Tapping a row opens it for editing (the Recurring page). */
  onEdit?: (cost: RecurringCost) => void;
  onDelete?: (cost: RecurringCost) => void;
}) {
  const queryClient = useQueryClient();
  const costs = useQuery(recurringCostsQuery());
  const categories = useQuery(financeCategoriesQuery());
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
      toast.success("Skipped. Nothing was logged.");
    },
    onError,
  });

  if (costs.isLoading || categories.isLoading) return <LoadingState rows={2} />;
  if (costs.error || categories.error)
    return (
      <ErrorState
        error={costs.error ?? categories.error}
        onRetry={() => {
          costs.refetch();
          categories.refetch();
        }}
      />
    );

  const active = (costs.data ?? []).filter((c) => c.active);
  const list = compact ? active.slice(0, 5) : (costs.data ?? []);

  if (list.length === 0) {
    return (
      <EmptyState
        title="Nothing logged yet"
        description="Recurring costs are the bills you know are coming. They stay projections until you log one, so they never move a balance on their own."
      />
    );
  }

  const today = new Date();

  return (
    <RowList>
      {list.map((cost) => {
        const due = parseISO(cost.next_due_date);
        const overdue = due < new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const category = (categories.data ?? []).find((item) => item.id === cost.category_id);
        const interval = recurringInterval(cost);
        return (
          <ListRow
            key={cost.id}
            muted={!cost.active}
            leading={
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-11 min-w-14 px-3"
                aria-label={`Log ${cost.name}`}
                disabled={log.isPending}
                onClick={() => log.mutate(cost)}
              >
                Log
              </Button>
            }
            title={
              <>
                <EntityIcon
                  icon={category?.icon}
                  color={category?.color}
                  containerClassName="size-6 shrink-0 rounded"
                  className="size-3.5"
                />
                <span className="min-w-0 truncate">{cost.name}</span>
              </>
            }
            openLabel={`Edit ${cost.name}`}
            {...(onEdit ? { onOpen: () => onEdit(cost) } : {})}
            meta={
              <>
                <SemanticBadge tone={overdue ? "warning" : "neutral"}>
                  {overdue ? "Past its date" : "Due"} {fmtDate(cost.next_due_date)}
                </SemanticBadge>
                <span>
                  Every {interval.count} {interval.unit}
                  {interval.count === 1 ? "" : "s"}
                </span>
                {!cost.active ? <span>Paused</span> : null}
              </>
            }
            trailing={<span className="font-medium">{fmtMoney(Number(cost.amount))}</span>}
            actions={[
              {
                label: "Skip this one",
                disabled: skip.isPending,
                onSelect: () => skip.mutate(cost),
              },
              ...(onDelete
                ? [{ label: "Delete", destructive: true, onSelect: () => onDelete(cost) }]
                : []),
            ]}
          />
        );
      })}
    </RowList>
  );
}

function RecurringPage() {
  const queryClient = useQueryClient();
  const accounts = useQuery(accountsQuery());
  const categories = useQuery(financeCategoriesQuery());

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringCost | null>(null);
  const [form, setForm] = useState<RecurringCostInput>(emptyForm);
  const [toDelete, setToDelete] = useState<RecurringCost | null>(null);
  /** Name of a category being added from the form; null when not adding one. */
  const [newCategory, setNewCategory] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: financeKeys.recurring });
  const onError = (e: unknown) =>
    toast.error(e instanceof Error ? e.message : "Something went wrong.");

  const save = useMutation({
    mutationFn: () => (editing ? updateRecurringCost(editing.id, form) : createRecurringCost(form)),
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      toast.success(editing ? "Cost updated." : "Cost added.");
    },
    onError,
  });

  const addCategory = useMutation({
    mutationFn: (name: string) =>
      createCategory({ name, kind: "expense", color: null, monthly_budget: null, icon: null }),
    onSuccess: (category) => {
      void queryClient.invalidateQueries({ queryKey: financeKeys.categories });
      setForm((current) => ({ ...current, category_id: category.id }));
      setNewCategory(null);
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
    setNewCategory(null);
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
      interval_count: recurringInterval(cost).count,
      interval_unit: recurringInterval(cost).unit,
      next_due_at: cost.next_due_at,
    });
    setNewCategory(null);
    setDialogOpen(true);
  }

  return (
    <>
      <PageHeader
        title="Recurring costs"
        description="Projections only. Nothing changes a balance until you log it."
        actions={<Button onClick={openCreate}>New cost</Button>}
      />

      <RecurringList onEdit={openEdit} onDelete={setToDelete} />

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
            <DatePicker
              id="cost-date"
              value={form.next_due_date}
              onChange={(value) =>
                setForm({
                  ...form,
                  next_due_date: value,
                  next_due_at: value ? `${value}T00:00:00` : null,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="interval-count">Repeat</Label>
            <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
              <Input
                id="interval-count"
                type="number"
                min="1"
                inputMode="numeric"
                className="h-12 w-20"
                value={form.interval_count}
                onChange={(event) => {
                  const count = Math.max(1, Number(event.target.value) || 1);
                  setForm({
                    ...form,
                    interval_count: count,
                    frequency: legacyFrequency(form.interval_unit, count),
                  });
                }}
              />
              <Select
                value={form.interval_unit}
                onValueChange={(value) => {
                  const unit = value as IntervalUnit;
                  setForm({
                    ...form,
                    interval_unit: unit,
                    frequency: legacyFrequency(unit, form.interval_count),
                  });
                }}
              >
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["day", "week", "month", "year"] as IntervalUnit[]).map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                      {form.interval_count === 1 ? "" : "s"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
                    <span className="flex items-center gap-2">
                      <EntityIcon
                        icon={account.icon}
                        color={account.color}
                        containerClassName="size-5 rounded"
                        className="size-3"
                      />
                      {account.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={form.category_id ?? "none"}
              onValueChange={(v) => {
                if (v === "new") return setNewCategory("");
                setForm({ ...form, category_id: v === "none" ? null : v });
              }}
            >
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No category</SelectItem>
                {(categories.data ?? []).map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    <span className="flex items-center gap-2">
                      <EntityIcon
                        icon={category.icon}
                        color={category.color}
                        containerClassName="size-5 rounded"
                        className="size-3"
                      />
                      {category.name}
                    </span>
                  </SelectItem>
                ))}
                <SelectItem value="new">+ New category</SelectItem>
              </SelectContent>
            </Select>
            {newCategory != null ? (
              <div className="flex gap-2">
                <Input
                  autoFocus
                  aria-label="New category name"
                  placeholder="e.g. Medicine"
                  className="h-11"
                  value={newCategory}
                  onChange={(event) => setNewCategory(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    if (newCategory.trim()) addCategory.mutate(newCategory.trim());
                  }}
                />
                <Button
                  type="button"
                  className="h-11"
                  disabled={!newCategory.trim() || addCategory.isPending}
                  onClick={() => addCategory.mutate(newCategory.trim())}
                >
                  Add
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11"
                  onClick={() => setNewCategory(null)}
                >
                  Cancel
                </Button>
              </div>
            ) : null}
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
    </>
  );
}
