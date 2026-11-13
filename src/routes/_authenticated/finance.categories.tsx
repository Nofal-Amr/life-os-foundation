import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { EntityIcon, EntityIdentityPicker } from "@/components/app/EntityIdentity";
import { ListRow, RowList } from "@/components/app/ListRow";
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
      { title: "Money categories · Life OS" },
      {
        name: "description",
        content: "Your own spending and income categories, with optional monthly budgets.",
      },
      { property: "og:title", content: "Money categories · Life OS" },
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
  icon: null,
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
      toast.success("Starter categories added. Edit or remove any of them.");
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
      icon: category.icon,
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
          description={`Start from a plain set of labels (${STARTER_CATEGORIES.map((c) => c.name).join(", ")}) and change anything you like. They come with no amounts.`}
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
        <RowList>
          {list.map((category) => {
            const used = (transactions.data ?? []).filter(
              (t) => t.category_id === category.id,
            ).length;
            return (
              <ListRow
                key={category.id}
                leading={
                  <span className="flex size-11 items-center justify-center">
                    <EntityIcon icon={category.icon} color={category.color} />
                  </span>
                }
                title={<span className="truncate">{category.name}</span>}
                openLabel={`Edit ${category.name}`}
                onOpen={() => openEdit(category)}
                meta={
                  <>
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
                  </>
                }
                actions={[
                  { label: "Delete", destructive: true, onSelect: () => setToDelete(category) },
                ]}
              />
            );
          })}
        </RowList>
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
        <EntityIdentityPicker
          value={{ icon: form.icon, color: form.color }}
          onChange={(identity) => setForm({ ...form, ...identity })}
        />
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
    </>
  );
}
