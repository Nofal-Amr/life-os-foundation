import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useXp } from "@/hooks/useXp";

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
  accountPocketsQuery,
  accountsQuery,
  createCategory,
  createTransaction,
  financeCategoriesQuery,
  financeKeys,
  nowTime,
  signedAmount,
  transactionsQuery,
  type CategoryKind,
} from "@/data/finance";
import { todayISO } from "@/lib/date";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/**
 * Fast money capture: amount plus a one-tap category, with the last-used
 * account and category already selected.
 */
export function QuickAddTransactionDialog({
  open,
  onOpenChange,
  initialKind,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Start on spending or income; defaults to whatever was logged last. */
  initialKind?: CategoryKind;
}) {
  const queryClient = useQueryClient();
  const xp = useXp();
  const accounts = useQuery(accountsQuery());
  const pockets = useQuery(accountPocketsQuery());

  const categories = useQuery(financeCategoriesQuery());
  const transactions = useQuery(transactionsQuery());

  const [kind, setKind] = useState<CategoryKind>("expense");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [pocketId, setPocketId] = useState("");

  const [categoryId, setCategoryId] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState(nowTime());
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
    setPocketId(lastUsed?.pocket_id ?? "");

    setCategoryId(lastUsed?.category_id ?? "");
    setKind(initialKind ?? (lastUsed && Number(lastUsed.amount) > 0 ? "income" : "expense"));
    setAmount("");
    setNote("");
    setDate(todayISO());
    setTime(nowTime());
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
        date: date || todayISO(),
        occurred_time: time || null,
        pocket_id: pocketId || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeKeys.transactions });
      track("money_logged", { kind });
      onOpenChange(false);
      toast.success("Logged." + xp.suffix({ kind: "transaction" }));
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Something went wrong."),
  });

  const addCategory = useMutation({
    mutationFn: () =>
      createCategory({
        name: newCategoryName.trim(),
        kind,
        color: null,
        icon: null,
        monthly_budget: null,
      }),
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
                    <EntityIcon
                      icon={category.icon}
                      color={categoryId === category.id ? null : category.color}
                      containerClassName="size-5 rounded border-0 bg-transparent"
                      className="size-3"
                    />
                    {category.name}
                    {categoryId === category.id ? <Check className="size-3" /> : null}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="px-0"
              onClick={() => setShowNewCategory((current) => !current)}
            >
              <Plus className="size-4" /> New category
            </Button>
            {showNewCategory ? (
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <Input
                  aria-label="New category name"
                  value={newCategoryName}
                  placeholder="Category name"
                  onChange={(event) => setNewCategoryName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      if (newCategoryName.trim()) addCategory.mutate();
                    }
                  }}
                />
                <Button
                  type="button"
                  disabled={!newCategoryName.trim() || addCategory.isPending}
                  onClick={() => addCategory.mutate()}
                >
                  Add
                </Button>
              </div>
            ) : null}
          </div>

          {(pockets.data ?? []).some((pocket) => pocket.account_id === accountId) ? (
            <div className="space-y-2">
              <Label>Pocket</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  aria-pressed={pocketId === ""}
                  className={cn(
                    "min-h-11 rounded-full px-4 text-sm",
                    pocketId === "" ? "border-primary bg-primary text-primary-foreground" : "",
                  )}
                  onClick={() => setPocketId("")}
                >
                  No pocket
                </Button>
                {(pockets.data ?? [])
                  .filter((pocket) => pocket.account_id === accountId)
                  .map((pocket) => (
                    <Button
                      key={pocket.id}
                      type="button"
                      variant="outline"
                      aria-pressed={pocketId === pocket.id}
                      className={cn(
                        "min-h-11 rounded-full px-4 text-sm",
                        pocketId === pocket.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : "",
                      )}
                      onClick={() => setPocketId(pocket.id)}
                    >
                      {pocket.name}
                    </Button>
                  ))}
              </div>
            </div>
          ) : null}

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

          <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-3">
            <div className="space-y-2">
              <Label htmlFor="quick-date">Date</Label>
              <Input
                id="quick-date"
                type="date"
                className="h-12"
                value={date}
                max={todayISO()}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-time">Time</Label>
              <Input
                id="quick-time"
                type="time"
                className="h-12 tabular-nums"
                value={time}
                onChange={(event) => setTime(event.target.value)}
              />
            </div>
          </div>

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
              Add an account under Money, Accounts first, then you can log straight away.
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
