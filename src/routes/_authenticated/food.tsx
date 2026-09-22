import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { DateNav } from "@/components/app/DateNav";
import { EntityIcon } from "@/components/app/EntityIdentity";
import { FormDialog } from "@/components/app/FormDialog";
import { FoodLibraryDialog } from "@/components/app/FoodLibraryDialog";
import { PageHeader } from "@/components/app/PageHeader";
import { QuickMeals } from "@/components/app/QuickMeals";
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
  MEALS,
  createFood,
  createFoodLog,
  dayTotals,
  deleteFood,
  deleteFoodLog,
  foodKeys,
  foodLogsQuery,
  foodsQuery,
  logFromFood,
  suggestedFoods,
  type Food,
  type FoodInput,
  type FoodLog,
} from "@/data/food";
import { todayISO } from "@/lib/date";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/food")({
  head: () => ({
    meta: [
      { title: "Food · Life OS" },
      { name: "description", content: "A record of what you ate, with your own food library." },
      { property: "og:title", content: "Food · Life OS" },
      {
        property: "og:description",
        content: "A record of what you ate, with your own food library.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FoodPage,
});

const emptyFood: FoodInput = {
  name: "",
  serving_label: null,
  serving_grams: null,
  calories: 0,
  protein_g: null,
  carbs_g: null,
  fat_g: null,
  icon: null,
};

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function FoodPage() {
  const queryClient = useQueryClient();
  const foods = useQuery(foodsQuery());
  const logs = useQuery(foodLogsQuery());

  const [date, setDate] = useState(todayISO());
  const [meal, setMeal] = useState<string>("breakfast");
  const [pickFood, setPickFood] = useState<Food | null>(null);
  const [servings, setServings] = useState("1");
  const [foodDialog, setFoodDialog] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [foodForm, setFoodForm] = useState<FoodInput>(emptyFood);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickName, setQuickName] = useState("");
  const [quickCalories, setQuickCalories] = useState("");
  const [logToDelete, setLogToDelete] = useState<FoodLog | null>(null);
  const [foodToDelete, setFoodToDelete] = useState<Food | null>(null);

  const onError = (e: unknown) =>
    toast.error(e instanceof Error ? e.message : "Something went wrong.");

  const invalidateLogs = () => queryClient.invalidateQueries({ queryKey: foodKeys.logs });

  const addLog = useMutation({
    mutationFn: () => {
      if (!pickFood) throw new Error("Choose a food.");
      const count = Number(servings);
      if (!count || Number.isNaN(count)) throw new Error("Enter how many servings.");
      return createFoodLog(logFromFood(pickFood, count, date, meal));
    },
    onSuccess: () => {
      invalidateLogs();
      setPickFood(null);
      setServings("1");
      toast.success("Logged.");
    },
    onError,
  });

  const addQuickLog = useMutation({
    mutationFn: () => {
      const calories = Number(quickCalories);
      if (!quickName.trim()) throw new Error("Give it a name.");
      if (!calories || Number.isNaN(calories)) throw new Error("Enter the calories.");
      return createFoodLog({
        food_id: null,
        name: quickName.trim(),
        log_date: date,
        meal,
        servings: 1,
        calories,
        protein_g: null,
        carbs_g: null,
        fat_g: null,
      });
    },
    onSuccess: () => {
      invalidateLogs();
      setQuickOpen(false);
      setQuickName("");
      setQuickCalories("");
      toast.success("Logged.");
    },
    onError,
  });

  const saveFood = useMutation({
    mutationFn: () => createFood(foodForm),
    onSuccess: (food) => {
      queryClient.invalidateQueries({ queryKey: foodKeys.foods });
      setFoodDialog(false);
      setFoodForm(emptyFood);
      setPickFood(food);
      toast.success("Food saved to your library.");
    },
    onError,
  });

  const removeLog = useMutation({
    mutationFn: (id: string) => deleteFoodLog(id),
    onSuccess: () => {
      invalidateLogs();
      setLogToDelete(null);
      toast.success("Entry removed.");
    },
    onError,
  });

  const removeFood = useMutation({
    mutationFn: (id: string) => deleteFood(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: foodKeys.foods });
      setFoodToDelete(null);
      toast.success("Food removed from your library.");
    },
    onError,
  });

  const loading = foods.isLoading || logs.isLoading;
  const error = foods.error ?? logs.error;

  const dayLogs = (logs.data ?? []).filter((log) => log.log_date === date);
  const totals = dayTotals(dayLogs);
  const chips = suggestedFoods(foods.data ?? [], logs.data ?? []);

  return (
    <>
      <FoodLibraryDialog open={libraryOpen} onOpenChange={setLibraryOpen} />
      <PageHeader
        title="Food"
        description="What you logged, exactly as you logged it."
        actions={
          <>
            <Button variant="outline" onClick={() => setLibraryOpen(true)}>
              Common foods
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setFoodForm(emptyFood);
                setFoodDialog(true);
              }}
            >
              <Plus className="size-4" />
              New food
            </Button>
          </>
        }
      />

      <div className="space-y-6">
        <DateNav value={date} onChange={setDate} />

        {loading ? (
          <LoadingState rows={3} />
        ) : error ? (
          <ErrorState
            error={error}
            onRetry={() => {
              foods.refetch();
              logs.refetch();
            }}
          />
        ) : (
          <>
            <section className="system-card p-6">
              <p className="text-sm text-muted-foreground">Logged this day</p>
              <p className="mt-1 text-4xl font-semibold tabular-nums tracking-tight">
                {round(totals.calories)} kcal
              </p>
              <dl className="mt-4 grid min-w-0 gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">Protein</dt>
                  <dd className="tabular-nums">{round(totals.protein)} g</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Carbs</dt>
                  <dd className="tabular-nums">{round(totals.carbs)} g</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Fat</dt>
                  <dd className="tabular-nums">{round(totals.fat)} g</dd>
                </div>
              </dl>
            </section>

            <section className="stat-card p-4">
              <QuickMeals date={date} showDay={false} />
              <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                <Button type="button" size="sm" variant="ghost" onClick={() => setQuickOpen(true)}>
                  One-off with calories and macros
                </Button>
              </div>
            </section>

            <section>
              <h2 className="mb-3 section-title">
                Entries
              </h2>
              {dayLogs.length === 0 ? (
                <EmptyState
                  title="Nothing logged yet today"
                  description="Log what you ate and Life OS adds up the calories from your own entries."
                />
              ) : (
                <div className="space-y-5">
                  {MEALS.filter((option) => dayLogs.some((log) => log.meal === option.value)).map(
                    (option) => {
                      const mealLogs = dayLogs.filter((log) => log.meal === option.value);
                      const mealTotals = dayTotals(mealLogs);
                      return (
                        <div key={option.value}>
                          <div className="mb-2 flex items-baseline justify-between gap-3">
                            <h3 className="text-sm font-medium">{option.label}</h3>
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {round(mealTotals.calories)} kcal
                            </span>
                          </div>
                          <ul className="space-y-2">
                            {mealLogs.map((log) => (
                              <li
                                key={log.id}
                                className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border bg-card p-3"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium">
                                    {log.name ?? "Food"}
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {round(Number(log.servings))}{" "}
                                    {Number(log.servings) === 1 ? "serving" : "servings"} ·{" "}
                                    {round(Number(log.calories))} kcal
                                  </p>
                                </div>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  aria-label="Remove entry"
                                  onClick={() => setLogToDelete(log)}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    },
                  )}
                  {dayLogs.some((log) => !log.meal) ? (
                    <div>
                      <h3 className="mb-2 text-sm font-medium">No meal set</h3>
                      <ul className="space-y-2">
                        {dayLogs
                          .filter((log) => !log.meal)
                          .map((log) => (
                            <li
                              key={log.id}
                              className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border bg-card p-3"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{log.name ?? "Food"}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {round(Number(log.calories))} kcal
                                </p>
                              </div>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                aria-label="Remove entry"
                                onClick={() => setLogToDelete(log)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </li>
                          ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              )}
            </section>

            {(foods.data ?? []).length ? (
              <section>
                <h2 className="mb-3 section-title">
                  Your food library
                </h2>
                <ul className="space-y-2">
                  {(foods.data ?? []).map((food) => (
                    <li
                      key={food.id}
                      className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border bg-card p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{food.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {food.serving_label ? `${food.serving_label} · ` : ""}
                          {round(Number(food.calories))} kcal
                          {food.protein_g == null ? "" : ` · P ${round(Number(food.protein_g))} g`}
                          {food.carbs_g == null ? "" : ` · C ${round(Number(food.carbs_g))} g`}
                          {food.fat_g == null ? "" : ` · F ${round(Number(food.fat_g))} g`}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setPickFood(food);
                            setServings("1");
                          }}
                        >
                          Log
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setFoodToDelete(food)}>
                          Delete
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </div>

      {/* Log a library food */}
      <FormDialog
        open={!!pickFood}
        onOpenChange={(open) => !open && setPickFood(null)}
        title={pickFood ? `Log ${pickFood.name}` : "Log food"}
        submitLabel="Log it"
        pending={addLog.isPending}
        onSubmit={() => addLog.mutate()}
      >
        {pickFood ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="food-servings">Servings</Label>
              <Input
                id="food-servings"
                autoFocus
                inputMode="decimal"
                type="number"
                step="0.25"
                min="0"
                className="h-14 text-lg tabular-nums"
                value={servings}
                onChange={(event) => setServings(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {pickFood.serving_label ? `${pickFood.serving_label} · ` : ""}
                {round(Number(pickFood.calories))} kcal a serving
              </p>
            </div>
            <div className="space-y-2">
              <Label>Meal</Label>
              <Select value={meal} onValueChange={setMeal}>
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEALS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        ) : null}
      </FormDialog>

      {/* One-off entry, not saved to the library */}
      <FormDialog
        open={quickOpen}
        onOpenChange={setQuickOpen}
        title="One-off entry"
        description="Just this once. Nothing is added to your library."
        submitLabel="Log it"
        pending={addQuickLog.isPending}
        onSubmit={() => addQuickLog.mutate()}
      >
        <div className="space-y-2">
          <Label htmlFor="quick-food-name">Name</Label>
          <Input
            id="quick-food-name"
            autoFocus
            className="h-12"
            value={quickName}
            onChange={(event) => setQuickName(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quick-food-calories">Calories</Label>
          <Input
            id="quick-food-calories"
            inputMode="numeric"
            type="number"
            min="0"
            className="h-14 text-lg tabular-nums"
            value={quickCalories}
            onChange={(event) => setQuickCalories(event.target.value)}
          />
        </div>
      </FormDialog>

      {/* New library food */}
      <FormDialog
        open={foodDialog}
        onOpenChange={setFoodDialog}
        title="New food"
        description="Enter it once per serving, then it is one tap to log."
        pending={saveFood.isPending}
        onSubmit={() => saveFood.mutate()}
      >
        <div className="space-y-2">
          <Label htmlFor="new-food-name">Name</Label>
          <Input
            id="new-food-name"
            required
            className="h-12"
            value={foodForm.name}
            onChange={(event) => setFoodForm({ ...foodForm, name: event.target.value })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="new-food-serving">Serving</Label>
            <Input
              id="new-food-serving"
              className="h-12"
              placeholder="1 cup, 1 slice"
              value={foodForm.serving_label ?? ""}
              onChange={(event) =>
                setFoodForm({ ...foodForm, serving_label: event.target.value || null })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-food-grams">Serving in grams</Label>
            <Input
              id="new-food-grams"
              type="number"
              min="0"
              inputMode="numeric"
              className="h-12 tabular-nums"
              value={foodForm.serving_grams ?? ""}
              onChange={(event) =>
                setFoodForm({
                  ...foodForm,
                  serving_grams: event.target.value === "" ? null : Number(event.target.value),
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-food-calories">Calories a serving</Label>
            <Input
              id="new-food-calories"
              required
              type="number"
              min="0"
              inputMode="numeric"
              className="h-12 tabular-nums"
              value={foodForm.calories}
              onChange={(event) =>
                setFoodForm({ ...foodForm, calories: Number(event.target.value) })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-food-protein">Protein (g)</Label>
            <Input
              id="new-food-protein"
              type="number"
              min="0"
              step="0.1"
              inputMode="decimal"
              className="h-12 tabular-nums"
              value={foodForm.protein_g ?? ""}
              onChange={(event) =>
                setFoodForm({
                  ...foodForm,
                  protein_g: event.target.value === "" ? null : Number(event.target.value),
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-food-carbs">Carbs (g)</Label>
            <Input
              id="new-food-carbs"
              type="number"
              min="0"
              step="0.1"
              inputMode="decimal"
              className="h-12 tabular-nums"
              value={foodForm.carbs_g ?? ""}
              onChange={(event) =>
                setFoodForm({
                  ...foodForm,
                  carbs_g: event.target.value === "" ? null : Number(event.target.value),
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-food-fat">Fat (g)</Label>
            <Input
              id="new-food-fat"
              type="number"
              min="0"
              step="0.1"
              inputMode="decimal"
              className="h-12 tabular-nums"
              value={foodForm.fat_g ?? ""}
              onChange={(event) =>
                setFoodForm({
                  ...foodForm,
                  fat_g: event.target.value === "" ? null : Number(event.target.value),
                })
              }
            />
          </div>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={!!logToDelete}
        onOpenChange={(open) => !open && setLogToDelete(null)}
        title="Remove this entry?"
        description="Your totals for the day are worked out again without it."
        onConfirm={() => logToDelete && removeLog.mutate(logToDelete.id)}
      />

      <ConfirmDialog
        open={!!foodToDelete}
        onOpenChange={(open) => !open && setFoodToDelete(null)}
        title="Remove this food?"
        description="Entries you already logged stay as they are."
        onConfirm={() => foodToDelete && removeFood.mutate(foodToDelete.id)}
      />
    </>
  );
}
