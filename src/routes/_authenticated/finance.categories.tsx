import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
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
  CATEGORY_KINDS,
  STARTER_CATEGORIES,
  addStarterCategories,
  createCategory,
  deleteCategory,
  financeCategoriesQuery,
  financeKeys,
  transactionsQuery,
  updateCategory,
  type CategoryInput,
  type FinanceCategory,
} from "@/data/finance";
import { usePreferences } from "@/hooks/usePreferences";

export const Route = createFileRoute("/_authenticated/finance/categories")({
  head: () => ({
    meta: [
      { title: "Money categories — Life OS" },
      { name: "description", content: "Your own spending and income categories, with optional monthly budgets." },
      { property: "og:title", content: "Money categories — Life OS" },
      {
        property: "og:description",
        content: "Your own spending and income categories, with optional monthly budgets.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CategoriesPage,
});

const emptyForm: CategoryInput = {
  name: "",
  kind: "expense",
  color: null,
  monthly_budget: null,
};

function CategoriesPage() {
  const queryClient = useQueryClient();
  const categories = useQuery(financeCategoriesQuery());
  const transactions = useQuery(transactionsQuery());
  const { fmtMoney } = usePreferences();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceCategory | null>(null);
  const [form, setForm] = useState<CategoryInput>(emptyForm);
  const [toDelete, setToDelete] = useState<FinanceCategory | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: financeKeys.categories });
  const onError = (e: unknown) =>
    toast.error(e instanceof Error ? e.message : "Something went wrong.");

  const save = useMutation({
    mutationFn: () => (editing ? updateCategory(editing.id, form) : createCategory(form)),
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      toast.success(editing ? "Category updated." : "Category added.");
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: financeKeys.transactions });
      setToDelete(null);
      toast.success("Category deleted.");
    },
    onError,
  });

  const starter = useMutation({
    mutationFn: () => addStarterCategories(),
    onSuccess: () => {
      invalidate();
      toast.success("Starter categories added — edit or remove any of them.");
    },
    onError,
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(category: FinanceCategory) {
    setEditing(category);
    setForm({
      name: category.name,
      kind: category.kind,
      color: category.color,
      monthly_budget: category.monthly_budget == null ? null : Number(category.monthly_budget),
    });
    setDialogOpen(true);
  }

  const list = categories.data ?? [];

  return (
    <>
      <PageHeader
        title="Categories"
        description="Your own labels for where money goes and comes from."
        actions={<Button onClick={openCreate}>New category</Button>}
      />

      {categories.isLoading ? (
        <LoadingState />
      ) : categories.error ? (
        <ErrorState error={categories.error} onRetry={() => categories.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState
          title="Nothing logged yet"
          description={`Start from a plain set of labels — ${STARTER_CATEGORIES.map((c) => c.name).join(", ")} — and change anything you like. They come with no amounts.`}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => starter.mutate()} disabled={starter.isPending}>
                {starter.isPending ? "Adding…" : "Add starter categories"}
              </Button>
              <Button variant="outline" onClick={openCreate}>
                Create my own
              </Button>
            </div>
          }
        />
      ) : (
        <ul className="space-y-3">
          {list.map((category) => {
            const used = (transactions.data ?? []).filter(
              (t) => t.category_id === category.id,
            ).length;
            return (
              <li
                key={category.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium">
                    {category.color ? (
                      <span
                        aria-hidden="true"
                        className="size-3 rounded-full border border-border"
                        style={{ backgroundColor: category.color }}
                      />
                    ) : null}
                    {category.name}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <SemanticBadge tone={category.kind === "income" ? "positive" : "neutral"}>
                      {category.kind === "income" ? "Income" : "Expense"}
                    </SemanticBadge>
                    {category.monthly_budget != null ? (
                      <span className="tabular-nums">
                        Monthly budget {fmtMoney(Number(category.monthly_budget))}
                      </span>
                    ) : null}
                    <span>
                      {used === 0
                        ? "Nothing logged yet"
                        : `${used} ${used === 1 ? "transaction" : "transactions"}`}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(category)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setToDelete(category)}>
                    Delete
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? "Edit category" : "New category"}
        pending={save.isPending}
        onSubmit={() => save.mutate()}
      >
        <div className="space-y-2">
          <Label htmlFor="category-name">Name</Label>
          <Input
            id="category-name"
            required
            className="h-12"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Kind</Label>
            <Select
              value={form.kind}
              onValueChange={(v) => setForm({ ...form, kind: v as CategoryInput["kind"] })}
            >
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_KINDS.map((k) => (
                  <SelectItem key={k.value} value={k.value}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="category-colour">Colour</Label>
            <Input
              id="category-colour"
              type="color"
              className="h-12 w-20 p-1"
              value={form.color ?? "#64748b"}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category-budget">Monthly budget (optional)</Label>
            <Input
              id="category-budget"
              type="number"
              step="0.01"
              min="0"
              className="h-12 tabular-nums"
              value={form.monthly_budget ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  monthly_budget: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </div>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete this category?"
        description={(() => {
          const used = (transactions.data ?? []).filter(
            (t) => t.category_id === toDelete?.id,
          ).length;
          return used > 0
            ? `${used} ${used === 1 ? "transaction uses" : "transactions use"} this category. They keep their amounts but will no longer have a category.`
            : "This cannot be undone.";
        })()}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />

      <QuickAddTransactionButton />
    </>
  );
}
