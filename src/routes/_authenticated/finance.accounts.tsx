import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { EntityIcon, EntityIdentityPicker } from "@/components/app/EntityIdentity";
import { FormDialog } from "@/components/app/FormDialog";
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
  ACCOUNT_TYPES,
  POCKET_KINDS,
  accountBalance,
  accountPocketsQuery,
  accountsQuery,
  countsTowardSpendable,
  createAccount,
  createPocket,
  deleteAccount,
  deletePocket,
  financeKeys,
  pocketBalance,
  pocketKindLabel,
  transactionsQuery,
  updateAccount,
  type Account,
  type AccountInput,
} from "@/data/finance";
import { usePreferences } from "@/hooks/usePreferences";

export const Route = createFileRoute("/_authenticated/finance/accounts")({
  head: () => ({
    meta: [
      { title: "Accounts · Life OS" },
      {
        name: "description",
        content: "Your accounts and pockets, with balances from what you log.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { new?: boolean } =>
    search["new"] ? { new: true } : {},
  component: AccountsPage,
});

const emptyAccount: AccountInput = {
  name: "",
  type: "checking",
  opening_balance: 0,
  currency: null,
  active: true,
  icon: null,
  color: null,
  counts_toward_spendable: true,
};

/** Accounts on their own page: add, edit, split into pockets, delete. */
function AccountsPage() {
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const accounts = useQuery(accountsQuery());
  const transactions = useQuery(transactionsQuery());
  const pockets = useQuery(accountPocketsQuery());
  const { fmtMoney } = usePreferences();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState<AccountInput>(emptyAccount);
  const [toDelete, setToDelete] = useState<Account | null>(null);
  const [pocketName, setPocketName] = useState("");
  const [pocketKind, setPocketKind] = useState("cash");
  const [pocketOpening, setPocketOpening] = useState("");

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
      queryClient.invalidateQueries({ queryKey: financeKeys.pockets });
      setToDelete(null);
      toast.success("Account deleted.");
    },
    onError,
  });

  const addPocket = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error("Save the account first.");
      if (!pocketName.trim()) throw new Error("Give the pocket a name.");
      return createPocket({
        account_id: editing.id,
        name: pocketName.trim(),
        kind: pocketKind,
        opening_balance: pocketOpening === "" ? 0 : Number(pocketOpening),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeKeys.pockets });
      setPocketName("");
      setPocketOpening("");
      toast.success("Pocket added.");
    },
    onError,
  });

  const removePocket = useMutation({
    mutationFn: (id: string) => deletePocket(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeKeys.pockets });
      toast.success("Pocket removed.");
    },
    onError,
  });

  const loading = accounts.isLoading || transactions.isLoading || pockets.isLoading;
  const error = accounts.error ?? transactions.error ?? pockets.error;
  const hasAccounts = (accounts.data ?? []).length > 0;
  const editingPockets = editing
    ? (pockets.data ?? []).filter((pocket) => pocket.account_id === editing.id)
    : [];

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
      counts_toward_spendable: countsTowardSpendable(account),
    });
    setPocketName("");
    setPocketKind("cash");
    setPocketOpening("");
    setDialogOpen(true);
  }

  // Arriving with ?new=1 (from "Add an account" elsewhere) opens the form once.
  useEffect(() => {
    if (!search.new) return;
    openCreate();
    void navigate({ search: {}, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.new]);

  return (
    <>
      <PageHeader
        title="Accounts"
        description="Where your money is. Balances are worked out from the opening balance and what you log."
        actions={<Button onClick={openCreate}>New account</Button>}
      />

      {loading ? (
        <LoadingState rows={3} />
      ) : error ? (
        <ErrorState
          error={error}
          onRetry={() => {
            accounts.refetch();
            transactions.refetch();
            pockets.refetch();
          }}
        />
      ) : (
        <>
          {!hasAccounts ? (
            <EmptyState
              title="Nothing logged yet"
              description="An account holds your money. Add it with its opening balance, and every balance after that is worked out from what you log."
              action={<Button onClick={openCreate}>Add an account</Button>}
            />
          ) : (
            <ul className="space-y-3">
              {(accounts.data ?? []).map((account) => {
                const accountPockets = (pockets.data ?? []).filter(
                  (pocket) => pocket.account_id === account.id,
                );
                return (
                  <li key={account.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <EntityIcon icon={account.icon} color={account.color} />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{account.name}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <SemanticBadge tone={account.type === "credit" ? "info" : "neutral"}>
                              {ACCOUNT_TYPES.find((t) => t.value === account.type)?.label}
                            </SemanticBadge>
                            {!account.active ? (
                              <SemanticBadge tone="quiet">Inactive</SemanticBadge>
                            ) : null}
                            {!countsTowardSpendable(account) ? (
                              <SemanticBadge tone="quiet">Kept separate</SemanticBadge>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-medium tabular-nums">
                          {fmtMoney(
                            accountBalance(account, transactions.data ?? [], pockets.data ?? []),
                          )}
                        </span>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(account)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setToDelete(account)}>
                          Delete
                        </Button>
                      </div>
                    </div>
                    {accountPockets.length ? (
                      <ul className="mt-3 space-y-1.5 border-l border-border pl-3">
                        {accountPockets.map((pocket) => (
                          <li
                            key={pocket.id}
                            className="flex min-w-0 items-center justify-between gap-3 text-sm"
                          >
                            <span className="min-w-0 truncate">
                              {pocket.name}
                              <span className="ml-2 text-xs text-muted-foreground">
                                {pocketKindLabel(pocket.kind)}
                              </span>
                            </span>
                            <span className="shrink-0 tabular-nums">
                              {fmtMoney(pocketBalance(pocket, transactions.data ?? []))}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </>
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
        <EntityIdentityPicker
          value={{ icon: form.icon, color: form.color }}
          onChange={(identity) => setForm({ ...form, ...identity })}
        />
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
          <div className="space-y-2">
            <Label>Left to spend</Label>
            <Select
              value={form.counts_toward_spendable ? "counts" : "separate"}
              onValueChange={(v) => setForm({ ...form, counts_toward_spendable: v === "counts" })}
            >
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="counts">Counts toward it</SelectItem>
                <SelectItem value="separate">Kept separate</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {!form.counts_toward_spendable ? (
          <p className="text-xs text-muted-foreground">
            Still tracked with its own balance and history, but left out of left to spend. Useful
            for a home fund or money you look after for someone else.
          </p>
        ) : null}

        {editing ? (
          <div className="space-y-3 rounded-lg border border-border p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Pockets</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Split one account into parts, like cash in hand and the bank balance.
              </p>
            </div>
            {editingPockets.length ? (
              <ul className="space-y-1.5">
                {editingPockets.map((pocket) => (
                  <li
                    key={pocket.id}
                    className="flex min-w-0 items-center justify-between gap-2 text-sm"
                  >
                    <span className="min-w-0 truncate">
                      {pocket.name}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {pocketKindLabel(pocket.kind)}
                      </span>
                    </span>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="tabular-nums">
                        {fmtMoney(pocketBalance(pocket, transactions.data ?? []))}
                      </span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Remove ${pocket.name}`}
                        onClick={() => removePocket.mutate(pocket.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">No pockets yet.</p>
            )}
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_7rem_auto]">
              <Input
                aria-label="Pocket name"
                placeholder="Pocket name"
                value={pocketName}
                onChange={(event) => setPocketName(event.target.value)}
              />
              <Select value={pocketKind} onValueChange={setPocketKind}>
                <SelectTrigger aria-label="Pocket kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POCKET_KINDS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                aria-label="Pocket opening balance"
                inputMode="decimal"
                type="number"
                step="0.01"
                placeholder="0.00"
                className="tabular-nums"
                value={pocketOpening}
                onChange={(event) => setPocketOpening(event.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                disabled={!pocketName.trim() || addPocket.isPending}
                onClick={() => addPocket.mutate()}
              >
                <Plus className="size-4" />
                Add
              </Button>
            </div>
          </div>
        ) : null}
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
    </>
  );
}
