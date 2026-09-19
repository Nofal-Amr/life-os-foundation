import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { EntityIcon } from "@/components/app/EntityIdentity";
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
import {
  accountsQuery,
  createCategory,
  createTransaction,
  financeCategoriesQuery,
  financeKeys,
  signedAmount,
  transactionsQuery,
  type CategoryKind,
} from "@/data/finance";
import { todayISO } from "@/lib/date";
import { cn } from "@/lib/utils";

/**
 * Fast money capture: amount plus a one-tap category, with the last-used
 * account and category already selected.
 */
export function QuickAddTransactionDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const accounts = useQuery(accountsQuery());
  const categories = useQuery(financeCategoriesQuery());
  const transactions = useQuery(transactionsQuery());

  const [kind, setKind] = useState<CategoryKind>("expense");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [note, setNote] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const activeAccounts = useMemo(
    () => (accounts.data ?? []).filter((a) => a.active),
    [accounts.data],
  );

  const lastUsed = (transactions.data ?? [])[0];

  // Pre-select the last-used account each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    const fallback = activeAccounts[0]?.id ?? "";
    setAccountId(lastUsed?.account_id ?? fallback);
    setCategoryId(lastUsed?.category_id ?? "");
    setKind(lastUsed && Number(lastUsed.amount) > 0 ? "income" : "expense");
    setAmount("");
    setNote("");
    setShowNewCategory(false);
    setNewCategoryName("");
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Most-used categories first, so the common taps are always on top. */
  const chips = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of transactions.data ?? []) {
      if (t.category_id) counts.set(t.category_id, (counts.get(t.category_id) ?? 0) + 1);
    }
    return (categories.data ?? [])
      .filter((c) => c.kind === kind)
      .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))
      .slice(0, 8);
  }, [categories.data, transactions.data, kind]);

  const add = useMutation({
    mutationFn: async () => {
      const value = Number(amount);
      if (!accountId) throw new Error("Add an account first.");
      if (!value || Number.isNaN(value)) throw new Error("Enter an amount.");
      return createTransaction({
        account_id: accountId,
        category_id: categoryId || null,
        amount: signedAmount(value, kind === "income" ? "income" : "expense"),
        kind: kind === "income" ? "income" : "expense",
        description: note.trim() || null,
        date: todayISO(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeKeys.transactions });
      onOpenChange(false);
      toast.success("Logged.");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Something went wrong."),
  });

  const addCategory = useMutation({
    mutationFn: () => createCategory({ name: newCategoryName.trim(), kind, color: null, icon: null, monthly_budget: null }),
    onSuccess: (category) => {
      queryClient.invalidateQueries({ queryKey: financeKeys.categories });
      setCategoryId(category.id);
      setNewCategoryName("");
      setShowNewCategory(false);
      toast.success("Category created and selected.");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Something went wrong."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log money</DialogTitle>
          <DialogDescription>Amount and category. Everything else is optional.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            add.mutate();
          }}
        >
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Direction">
            {(["expense", "income"] as CategoryKind[]).map((option) => (
              <Button
                key={option}
                type="button"
                variant={kind === option ? "default" : "outline"}
                className="h-12"
                aria-pressed={kind === option}
                onClick={() => {
                  setKind(option);
                  setCategoryId("");
                }}
              >
                {option === "expense" ? "Money out" : "Money in"}
              </Button>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="quick-amount">Amount</Label>
            <Input
              id="quick-amount"
              autoFocus
              inputMode="decimal"
              type="number"
              step="0.01"
              min="0"
              className="h-14 text-lg tabular-nums"
              value={amount}
              placeholder="0.00"
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>

          {chips.length > 0 ? (
            <div className="space-y-2">
              <Label>Category</Label>
              <div className="flex flex-wrap gap-2">
                {chips.map((category) => (
                  <Button
                    key={category.id}
                    type="button"
                    variant="outline"
                    aria-pressed={categoryId === category.id}
                    onClick={() => setCategoryId(categoryId === category.id ? "" : category.id)}
                    className={cn(
                      "min-h-11 rounded-full px-4 text-sm",
                      categoryId === category.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "",
                    )}
                  >
                    <EntityIcon icon={category.icon} color={categoryId === category.id ? null : category.color} containerClassName="size-5 rounded border-0 bg-transparent" className="size-3" />
                    {category.name}
                    {categoryId === category.id ? <Check className="size-3" /> : null}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <Button type="button" variant="ghost" size="sm" className="px-0" onClick={() => setShowNewCategory((current) => !current)}>
              <Plus className="size-4" /> New category
            </Button>
            {showNewCategory ? (
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <Input aria-label="New category name" value={newCategoryName} placeholder="Category name" onChange={(event) => setNewCategoryName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); if (newCategoryName.trim()) addCategory.mutate(); } }} />
                <Button type="button" disabled={!newCategoryName.trim() || addCategory.isPending} onClick={() => addCategory.mutate()}>Add</Button>
              </div>
            ) : null}
          </div>

          {activeAccounts.length > 1 ? (
            <div className="space-y-2">
              <Label>Account</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Choose an account" />
                </SelectTrigger>
                <SelectContent>
                  {activeAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="quick-note">Note</Label>
            <Input
              id="quick-note"
              className="h-12"
              value={note}
              placeholder="Optional"
              onChange={(event) => setNote(event.target.value)}
            />
          </div>

          {activeAccounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add an account on the Money page first, then you can log straight away.
            </p>
          ) : null}

          <Button
            type="submit"
            className="h-12 w-full"
            disabled={add.isPending || activeAccounts.length === 0}
          >
            {add.isPending ? "Saving…" : "Log it"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Persistent floating money-capture control. */
export function QuickAddTransactionButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        aria-label="Log money"
        title="Log money"
        className={
          className ??
          "fixed bottom-24 right-[max(1.25rem,env(safe-area-inset-right))] z-40 size-14 rounded-full shadow-lg md:bottom-8 md:right-8"
        }
        onClick={() => setOpen(true)}
      >
        <Wallet className="size-6" />
      </Button>
      <QuickAddTransactionDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
