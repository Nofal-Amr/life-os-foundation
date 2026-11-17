import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, FileUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { FormDialog } from "@/components/app/FormDialog";
import { EmptyState } from "@/components/app/States";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  MEALS,
  createFood,
  createFoodLog,
  foodKeys,
  foodsQuery,
  logFromFood,
  updateFood,
  type Food,
  type FoodLog,
} from "@/data/food";
import { WEEKDAY_SHORT } from "@/data/gymRoutines";
import {
  addPlanItems,
  clearPlan,
  deletePlanItem,
  foodCost,
  mealPlanKey,
  parseFoodMarkdown,
  planFor,
  planRowsFrom,
  planTotals,
  type MealPlanItem,
} from "@/data/mealPlan";
import { t } from "@/lib/i18n";
import { toError } from "@/lib/supabase-helpers";
import { cn } from "@/lib/utils";

const round = (value: number) => Math.round(value * 10) / 10;
const mealLabel = (meal: string) => t(MEALS.find((item) => item.value === meal)?.label ?? meal);
const servingsLabel = (servings: number) =>
  `${round(Number(servings))} ${Number(servings) === 1 ? t("serving") : t("servings")}`;

/* ------------------------------------------------------ planned today */

/**
 * Today's planned foods next to the log: "Ate it" logs one as planned. The
 * numbers are planned and logged side by side, with no score.
 */
export function PlannedToday({
  date,
  foods,
  plan,
  logs,
}: {
  date: string;
  foods: Food[];
  plan: MealPlanItem[];
  logs: FoodLog[];
}) {
  const queryClient = useQueryClient();
  const weekday = new Date(`${date}T12:00:00`).getDay();
  const items = planFor(plan, weekday);
  const byId = new Map(foods.map((food) => [food.id, food]));
  const dayLogs = logs.filter((log) => log.log_date === date);
  const ate = useMutation({
    mutationFn: (item: MealPlanItem) => {
      const food = byId.get(item.food_id);
      if (!food) throw new Error(t("That food is no longer in your library."));
      return createFoodLog(logFromFood(food, Number(item.servings), date, item.meal));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: foodKeys.logs });
      toast.success(t("Logged."));
    },
    onError: (error: unknown) => toast.error(toError(error).message),
  });
  if (!items.length) return null;
  const planned = planTotals(items, foods);
  const logged = dayLogs.reduce((sum, log) => sum + Number(log.calories ?? 0), 0);

  return (
    <section className="stat-card space-y-3 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">{t("Planned for this day")}</h2>
        <p className="text-xs tabular-nums text-muted-foreground">
          {`${t("Planned")} ${Math.round(planned.calories)} kcal · ${t("Logged")} ${Math.round(logged)} kcal`}
        </p>
      </div>
      <ul className="space-y-2">
        {items.map((item) => {
          const food = byId.get(item.food_id);
          if (!food) return null;
          const done = dayLogs.some(
            (log) => log.food_id === item.food_id && log.meal === item.meal,
          );
          return (
            <li key={item.id} className="flex min-w-0 items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{food.name}</p>
                <p className="text-xs text-muted-foreground">
                  {`${mealLabel(item.meal)} · ${servingsLabel(item.servings)} · ${Math.round(Number(food.calories) * Number(item.servings))} kcal`}
                </p>
              </div>
              {done ? (
                <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  <Check className="size-3.5" aria-hidden="true" /> {t("Logged")}
                </span>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  disabled={ate.isPending}
                  onClick={() => ate.mutate(item)}
                >
                  {t("Ate it")}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ----------------------------------------------------------- plan tab */

export function FoodPlanTab({
  foods,
  plan,
  currency,
}: {
  foods: Food[];
  plan: MealPlanItem[];
  currency: string;
}) {
  const queryClient = useQueryClient();
  const [weekday, setWeekday] = useState(new Date().getDay());
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: mealPlanKey });
  const remove = useMutation({
    mutationFn: deletePlanItem,
    onSuccess: refresh,
    onError: (error: unknown) => toast.error(toError(error).message),
  });
  const clear = useMutation({
    mutationFn: () => clearPlan(plan),
    onSuccess: () => {
      refresh();
      setClearing(false);
      toast.success(t("The plan is empty. Your foods are still in the library."));
    },
    onError: (error: unknown) => toast.error(toError(error).message),
  });

  const items = planFor(plan, weekday);
  const byId = new Map(foods.map((food) => [food.id, food]));
  const day = planTotals(items, foods);
  const week = planTotals(plan, foods);
  const money = (value: number) => `${Math.round(value).toLocaleString()} ${currency}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => setAdding(true)} disabled={!foods.length}>
          <Plus className="size-4" /> {t("Add to the plan")}
        </Button>
        <Button type="button" variant="outline" onClick={() => setImporting(true)}>
          <FileUp className="size-4" /> {t("Import from a file")}
        </Button>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl bg-secondary p-1" role="tablist">
        {WEEKDAY_SHORT.map((label, index) => (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={weekday === index}
            onClick={() => setWeekday(index)}
            className={cn(
              "min-w-11 flex-1 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors",
              weekday === index ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            {t(label)}
          </button>
        ))}
      </div>

      {items.length ? (
        <section className="stat-card space-y-4 p-4">
          {MEALS.map((meal) => {
            const rows = items.filter((item) => item.meal === meal.value);
            if (!rows.length) return null;
            return (
              <div key={meal.value} className="space-y-1.5">
                <h3 className="text-sm font-medium">{t(meal.label)}</h3>
                <ul className="space-y-1.5">
                  {rows.map((item) => {
                    const food = byId.get(item.food_id);
                    if (!food) return null;
                    const cost = foodCost(food);
                    return (
                      <li key={item.id} className="flex min-w-0 items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm">{food.name}</p>
                          <p className="text-xs tabular-nums text-muted-foreground">
                            {`${servingsLabel(item.servings)} · ${Math.round(Number(food.calories) * Number(item.servings))} kcal`}
                            {cost != null ? ` · ${money(cost * Number(item.servings))}` : ""}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label={t("Remove from the plan")}
                          onClick={() => remove.mutate(item.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
          <dl className="grid grid-cols-2 gap-2 border-t border-border pt-3 text-sm sm:grid-cols-4">
            <Stat label={t("Calories")} value={`${Math.round(day.calories)} kcal`} />
            <Stat label={t("Protein")} value={`${round(day.protein)} g`} />
            <Stat label={t("Carbs")} value={`${round(day.carbs)} g`} />
            <Stat
              label={t("Rough cost")}
              value={day.cost || !day.withoutCost ? money(day.cost) : "—"}
            />
          </dl>
          {day.withoutCost ? (
            <p className="text-xs text-muted-foreground">
              {`${day.withoutCost} ${t("planned foods have no cost yet; add one in Foods.")}`}
            </p>
          ) : null}
        </section>
      ) : (
        <EmptyState
          title="Nothing planned for this day"
          description="Add foods from your library, or import a week's menu from a Markdown file."
        />
      )}

      {plan.length ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span className="tabular-nums">
            {`${t("The whole week")}: ${Math.round(week.calories).toLocaleString()} kcal`}
            {week.cost ? ` · ${money(week.cost)}` : ""}
          </span>
          <Button type="button" size="sm" variant="ghost" onClick={() => setClearing(true)}>
            {t("Clear the plan")}
          </Button>
        </div>
      ) : null}

      <AddPlanDialog
        open={adding}
        onOpenChange={setAdding}
        foods={foods}
        weekday={weekday}
        onSaved={refresh}
      />
      <ImportFoodDialog open={importing} onOpenChange={setImporting} plan={plan} />
      <ConfirmDialog
        open={clearing}
        onOpenChange={setClearing}
        title="Clear the whole week's plan?"
        description="Your foods, recipes and what you logged stay as they are."
        onConfirm={() => clear.mutate()}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function AddPlanDialog({
  open,
  onOpenChange,
  foods,
  weekday,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  foods: Food[];
  weekday: number;
  onSaved: () => void;
}) {
  const [foodId, setFoodId] = useState("");
  const [meal, setMeal] = useState<string>("breakfast");
  const [servings, setServings] = useState("1");
  const [days, setDays] = useState<number[]>([]);
  const chosenDays = days.length ? days : [weekday];
  const save = useMutation({
    mutationFn: () => {
      const id = foodId || foods[0]?.id;
      const count = Number(servings);
      if (!id) throw new Error(t("Choose a food."));
      if (!(count > 0 && count <= 50)) throw new Error(t("Enter how many servings."));
      return addPlanItems(
        chosenDays.map((day) => ({ weekday: day, meal, food_id: id, servings: count })),
      );
    },
    onSuccess: () => {
      onSaved();
      toast.success(t("Added to the plan."));
      setDays([]);
      setServings("1");
      onOpenChange(false);
    },
    onError: (error: unknown) => toast.error(toError(error).message),
  });
  const select = "h-11 w-full rounded-lg border border-border bg-card px-2 text-sm";

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("Add to the plan")}
      submitLabel={t("Add")}
      pending={save.isPending}
      onSubmit={() => save.mutate()}
    >
      <div className="space-y-2">
        <Label htmlFor="plan-food">{t("Food")}</Label>
        <select
          id="plan-food"
          className={select}
          value={foodId || foods[0]?.id || ""}
          onChange={(event) => setFoodId(event.target.value)}
        >
          {foods.map((food) => (
            <option key={food.id} value={food.id}>
              {`${food.name} · ${Math.round(Number(food.calories))} kcal`}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="plan-meal">{t("Meal")}</Label>
          <select
            id="plan-meal"
            className={select}
            value={meal}
            onChange={(event) => setMeal(event.target.value)}
          >
            {MEALS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.label)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="plan-servings">{t("Servings")}</Label>
          <Input
            id="plan-servings"
            inputMode="decimal"
            className="h-11 tabular-nums"
            value={servings}
            onChange={(event) => setServings(event.target.value)}
          />
        </div>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t("Days")}</legend>
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAY_SHORT.map((label, index) => {
            const on = chosenDays.includes(index);
            return (
              <button
                key={label}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setDays(
                    on
                      ? chosenDays.filter((day) => day !== index)
                      : [...chosenDays, index].sort((a, b) => a - b),
                  )
                }
                className={cn(
                  "h-9 min-w-11 rounded-lg border px-2 text-sm",
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground",
                )}
              >
                {t(label)}
              </button>
            );
          })}
        </div>
      </fieldset>
    </FormDialog>
  );
}

/* ------------------------------------------------------------- import */

const EXAMPLE = `# Foods
## Oat bowl
Serving: 1 bowl
Calories: 350 · Protein: 15 · Carbs: 50 · Fat: 8
Cost: 25
Recipe:
1. Warm the milk.
2. Stir in the oats and a banana.

# Plan
## Sun, Tue, Thu
- Breakfast: Oat bowl
- Lunch: Chicken breast, cooked x2
## Every day
- Snack: Banana`;

/**
 * Foods (with recipe and cost) and a weekly menu from a Markdown file. Foods
 * with a name already in the library are updated; new ones are added.
 */
export function ImportFoodDialog({
  open,
  onOpenChange,
  plan,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: MealPlanItem[];
}) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [replace, setReplace] = useState(false);
  const parsed = parseFoodMarkdown(text);
  const save = useMutation({
    mutationFn: async () => {
      const library = await queryClient.fetchQuery(foodsQuery());
      const byName = new Map(library.map((food) => [food.name.trim().toLowerCase(), food]));
      for (const item of parsed.foods) {
        const existing = byName.get(item.name.trim().toLowerCase());
        const { icon: _icon, ...fields } = item;
        if (existing) {
          const patch = Object.fromEntries(
            Object.entries(fields).filter(([key, value]) => value != null && key !== "name"),
          );
          // A food without numbers in the file keeps the numbers it has.
          if (!item.calories) delete patch["calories"];
          await updateFood(existing.id, patch);
        } else {
          await createFood(item);
        }
      }
      const fresh = await queryClient.fetchQuery({ ...foodsQuery(), staleTime: 0 });
      const { rows, missing } = planRowsFrom(parsed.plan, fresh);
      if (replace && rows.length) await clearPlan(plan);
      await addPlanItems(rows);
      return { foods: parsed.foods.length, rows: rows.length, missing };
    },
    onSuccess: ({ foods, rows, missing }) => {
      void queryClient.invalidateQueries({ queryKey: foodKeys.foods });
      void queryClient.invalidateQueries({ queryKey: mealPlanKey });
      toast.success(`${foods} ${t("foods")} · ${rows} ${t("plan items")}`);
      if (missing.length)
        toast.warning(`${t("Not in your library, so left out")}: ${missing.join(", ")}`);
      setText("");
      onOpenChange(false);
    },
    onError: (error: unknown) => toast.error(toError(error).message),
  });
  const nothing = !parsed.foods.length && !parsed.plan.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("Import foods and a plan")}</DialogTitle>
          <DialogDescription>
            {t("A Markdown file (.md) or pasted text: foods under # Foods, the week under # Plan.")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            type="file"
            accept=".md,.markdown,.txt,text/markdown,text/plain"
            aria-label={t("Choose a file")}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (file) setText((await file.text()).slice(0, 200_000));
            }}
          />
          <Textarea
            rows={9}
            value={text}
            placeholder={EXAMPLE}
            aria-label={t("Foods and plan as text")}
            className="font-mono text-xs"
            onChange={(event) => setText(event.target.value)}
          />
          {!nothing ? (
            <div className="space-y-1 rounded-lg bg-secondary p-2.5 text-sm">
              <p>
                {`${parsed.foods.length} ${t("foods")}`}
                {parsed.foods.length
                  ? `: ${parsed.foods
                      .map((food) => food.name)
                      .slice(0, 6)
                      .join(", ")}${parsed.foods.length > 6 ? "…" : ""}`
                  : ""}
              </p>
              <p>{`${parsed.plan.length} ${t("plan lines")}`}</p>
            </div>
          ) : text.trim() ? (
            <p className="text-sm text-muted-foreground">
              {t("Nothing found yet. Put foods under # Foods and the week under # Plan.")}
            </p>
          ) : null}
          {parsed.plan.length && plan.length ? (
            <label className="flex items-center justify-between gap-3 text-sm">
              {t("Replace the current plan")}
              <Switch checked={replace} onCheckedChange={setReplace} />
            </label>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" disabled={nothing || save.isPending} onClick={() => save.mutate()}>
            {t("Import")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------ recipe & cost */

export function RecipeDialog({
  food,
  onOpenChange,
  currency,
}: {
  food: Food | null;
  onOpenChange: (open: boolean) => void;
  currency: string;
}) {
  const queryClient = useQueryClient();
  const [recipe, setRecipe] = useState<string | null>(null);
  const [cost, setCost] = useState<string | null>(null);
  const shownRecipe = recipe ?? (food as (Food & { recipe?: string | null }) | null)?.recipe ?? "";
  const shownCost = cost ?? (food && foodCost(food) != null ? String(foodCost(food)) : "");
  const save = useMutation({
    mutationFn: () => {
      if (!food) throw new Error(t("Choose a food."));
      const value = shownCost.trim() === "" ? null : Number(shownCost);
      if (value != null && !(value >= 0)) throw new Error(t("Enter the cost as a number."));
      return updateFood(food.id, { recipe: shownRecipe.trim() || null, cost: value });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: foodKeys.foods });
      toast.success(t("Saved."));
      setRecipe(null);
      setCost(null);
      onOpenChange(false);
    },
    onError: (error: unknown) => toast.error(toError(error).message),
  });

  return (
    <FormDialog
      open={!!food}
      onOpenChange={(open) => {
        if (!open) {
          setRecipe(null);
          setCost(null);
        }
        onOpenChange(open);
      }}
      title={food ? food.name : t("Recipe and cost")}
      description={t("A recipe to follow and a rough cost per serving. Both are optional.")}
      pending={save.isPending}
      onSubmit={() => save.mutate()}
    >
      <div className="space-y-2">
        <Label htmlFor="food-recipe">{t("Recipe")}</Label>
        <Textarea
          id="food-recipe"
          rows={8}
          maxLength={8000}
          value={shownRecipe}
          placeholder={t("1. …")}
          onChange={(event) => setRecipe(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="food-cost">{`${t("Rough cost per serving")} (${currency})`}</Label>
        <Input
          id="food-cost"
          inputMode="decimal"
          className="h-11 tabular-nums"
          value={shownCost}
          onChange={(event) => setCost(event.target.value)}
        />
      </div>
    </FormDialog>
  );
}
