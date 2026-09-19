import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { DatePicker } from "@/components/app/DatePicker";
import { EntityIcon } from "@/components/app/EntityIdentity";
import { FormDialog } from "@/components/app/FormDialog";
import { PageHeader } from "@/components/app/PageHeader";
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
  accountPocketsQuery,
  accountsQuery,
  createCategory,
  deleteTransaction,
  financeCategoriesQuery,
  financeKeys,
  pocketKindLabel,
  signedAmount,
  transactionsQuery,
  updateTransaction,
  type Transaction,
  type TransactionInput,
} from "@/data/finance";

import { usePreferences } from "@/hooks/usePreferences";
import { amountDirectionLabel, amountTone } from "@/lib/semantics";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/finance/transactions")({
  head: () => ({
    meta: [
      { title: "Transactions — Life OS" },
      { name: "description", content: "Everything you have logged, grouped by day." },
      { property: "og:title", content: "Transactions — Life OS" },
      { property: "og:description", content: "Everything you have logged, grouped by day." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TransactionsPage,
});

function TransactionsPage() {
  const queryClient = useQueryClient();
  const transactions = useQuery(transactionsQuery());
  const accounts = useQuery(accountsQuery());
  const categories = useQuery(financeCategoriesQuery());
  const pockets = useQuery(accountPocketsQuery());

  const { fmtDate, fmtSignedMoney } = usePreferences();

  const [accountFilter, setAccountFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [editing, setEditing] = useState<Transaction | null>(null);
  const [form, setForm] = useState<TransactionInput | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [toDelete, setToDelete] = useState<Transaction | null>(null);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const onError = (e: unknown) =>
    toast.error(e instanceof Error ? e.message : "Something went wrong.");

  const save = useMutation({
    mutationFn: () => {
      if (!editing || !form) throw new Error("Nothing to save.");
      return updateTransaction(editing.id, form);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeKeys.transactions });
      setEditing(null);
      toast.success("Transaction updated.");
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteTransaction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeKeys.transactions });
      setToDelete(null);
      toast.success("Transaction deleted.");
    },
    onError,
  });

  const addCategory = useMutation({
    mutationFn: () => createCategory({
      name: newCategoryName.trim(),
      kind: form?.amount && form.amount > 0 ? "income" : "expense",
      color: null,
      icon: null,
      monthly_budget: null,
    }),
    onSuccess: (category) => {
      queryClient.invalidateQueries({ queryKey: financeKeys.categories });
      setForm((current) => current ? { ...current, category_id: category.id } : current);
      setNewCategoryName("");
      setShowNewCategory(false);
      toast.success("Category created and selected.");
    },
    onError,
  });

  const accountName = (id: string) =>
    (accounts.data ?? []).find((a) => a.id === id)?.name ?? "—";
  const categoryName = (id: string | null) =>
    id ? ((categories.data ?? []).find((c) => c.id === id)?.name ?? "—") : "No category";

  const groups = useMemo(() => {
    const filtered = (transactions.data ?? []).filter((t) => {
      if (accountFilter !== "all" && t.account_id !== accountFilter) return false;
      if (categoryFilter !== "all" && (t.category_id ?? "none") !== categoryFilter) return false;
      if (from && t.date < from) return false;
      if (to && t.date > to) return false;
      return true;
    });
    const map = new Map<string, Transaction[]>();
    for (const t of filtered) {
      const list = map.get(t.date) ?? [];
      list.push(t);
      map.set(t.date, list);
    }
    return [...map.entries()];
  }, [transactions.data, accountFilter, categoryFilter, from, to]);

  function openEdit(transaction: Transaction) {
    setEditing(transaction);
    setForm({
      account_id: transaction.account_id,
      category_id: transaction.category_id,
      amount: Number(transaction.amount),
      kind: transaction.kind,
      description: transaction.description,
      date: transaction.date,
      pocket_id: transaction.pocket_id,
    });

    setEditAmount(Math.abs(Number(transaction.amount)).toFixed(2));
    setShowNewCategory(false);
    setNewCategoryName("");
  }

  return (
    <>
      <PageHeader title="Transactions" description="Grouped by the day you logged them for." />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <Label>Account</Label>
          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              {(accounts.data ?? []).map((a) => (
                <SelectItem key={a.id} value={a.id}>
                     <span className="flex items-center gap-2"><EntityIcon icon={a.icon} color={a.color} containerClassName="size-5 rounded" className="size-3" />{a.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Category</Label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              <SelectItem value="none">No category</SelectItem>
              {(categories.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                   <span className="flex items-center gap-2"><EntityIcon icon={c.icon} color={c.color} containerClassName="size-5 rounded" className="size-3" />{c.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="filter-from">From</Label>
          <DatePicker id="filter-from" value={from} onChange={setFrom} className="[&_button]:h-11" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="filter-to">To</Label>
          <DatePicker id="filter-to" value={to} onChange={setTo} className="[&_button]:h-11" />
        </div>
      </div>

      {transactions.isLoading ? (
        <LoadingState />
      ) : transactions.error ? (
        <ErrorState error={transactions.error} onRetry={() => transactions.refetch()} />
      ) : groups.length === 0 ? (
        <EmptyState
          title="Nothing logged yet"
          description="Use the button in the corner to log money in or out."
        />
      ) : (
        <div className="space-y-6">
          {groups.map(([date, items]) => (
            <section key={date}>
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">{fmtDate(date)}</h2>
              <ul className="space-y-2">
                {items.map((t) => {
                  const money = fmtSignedMoney(Number(t.amount));
                  const tone = amountTone(Number(t.amount));
                  return (
                    <li
                      key={t.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
                    >
                      <div className="min-w-0">
                         <p className="flex min-w-0 items-center gap-2 font-medium">
                           {(() => { const category = (categories.data ?? []).find((item) => item.id === t.category_id); return category ? <EntityIcon icon={category.icon} color={category.color} containerClassName="size-6 rounded" className="size-3" /> : null; })()}
                           <span className="truncate">{t.description || categoryName(t.category_id)}</span>
                         </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {categoryName(t.category_id)} · {accountName(t.account_id)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "text-right tabular-nums",
                            tone === "warning" ? "tone-warning" : "tone-positive",
                            "border-0 bg-transparent px-0",
                          )}
                        >
                          <span className="block font-medium">{money.amount}</span>
                          <span className="block text-xs text-muted-foreground">
                            {amountDirectionLabel(Number(t.amount))}
                          </span>
                        </span>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(t)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setToDelete(t)}>
                          Delete
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <FormDialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        title="Edit transaction"
        pending={save.isPending}
        onSubmit={() => save.mutate()}
      >
        {form ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-amount">Amount</Label>
                <Input
                  id="edit-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  className="h-12 tabular-nums"
                   value={editAmount}
                   onChange={(e) => {
                     setEditAmount(e.target.value);
                     setForm({ ...form, amount: signedAmount(Number(e.target.value), form.kind) });
                   }}
                   onBlur={() => { const value = Number(editAmount); if (!Number.isNaN(value)) setEditAmount(value.toFixed(2)); }}
                />
              </div>
              <div className="space-y-2">
                <Label>Direction</Label>
                <Select
                  value={form.amount < 0 ? "expense" : "income"}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      kind: v as TransactionInput["kind"],
                      amount: signedAmount(form.amount, v as TransactionInput["kind"]),
                    })
                  }
                >
                  <SelectTrigger className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Money out</SelectItem>
                    <SelectItem value="income">Money in</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-date">Date</Label>
                <DatePicker id="edit-date" value={form.date} onChange={(value) => setForm({ ...form, date: value })} />
              </div>
              <div className="space-y-2">
                <Label>Account</Label>
                <Select
                  value={form.account_id}
                  onValueChange={(v) => setForm({ ...form, account_id: v })}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(accounts.data ?? []).map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                         <span className="flex items-center gap-2"><EntityIcon icon={a.icon} color={a.color} containerClassName="size-5 rounded" className="size-3" />{a.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {(pockets.data ?? []).some((pocket) => pocket.account_id === form.account_id) ? (
                <div className="space-y-2">
                  <Label>Pocket</Label>
                  <Select
                    value={form.pocket_id ?? "none"}
                    onValueChange={(v) => setForm({ ...form, pocket_id: v === "none" ? null : v })}
                  >
                    <SelectTrigger className="h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No pocket</SelectItem>
                      {(pockets.data ?? [])
                        .filter((pocket) => pocket.account_id === form.account_id)
                        .map((pocket) => (
                          <SelectItem key={pocket.id} value={pocket.id}>
                            {pocket.name} · {pocketKindLabel(pocket.kind)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
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
                    {(categories.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                         <span className="flex items-center gap-2"><EntityIcon icon={c.icon} color={c.color} containerClassName="size-5 rounded" className="size-3" />{c.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" size="sm" variant="ghost" className="px-0" onClick={() => setShowNewCategory((current) => !current)}>+ New category</Button>
                {showNewCategory ? <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"><Input aria-label="New category name" value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} /><Button type="button" disabled={!newCategoryName.trim() || addCategory.isPending} onClick={() => addCategory.mutate()}>Add</Button></div> : null}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-note">Note</Label>
              <Input
                id="edit-note"
                className="h-12"
                value={form.description ?? ""}
                onChange={(e) => setForm({ ...form, description: e.target.value || null })}
              />
            </div>
          </>
        ) : null}
      </FormDialog>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete this transaction?"
        description="Your account balance will be worked out again without it."
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />

    </>
  );
}
