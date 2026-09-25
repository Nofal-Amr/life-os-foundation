import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  MEALS,
  createFoodLog,
  dayTotals,
  deleteFoodLog,
  foodKeys,
  foodLogsQuery,
  foodsQuery,
  logFromFood,
  mealForTime,
  recentOneOffs,
  suggestedFoods,
  type Food,
  type FoodLog,
  type FoodLogInput,
  type Meal,
} from "@/data/food";
import { FoodSetup } from "@/components/app/FoodSetup";
import { preferencesQuery, readFoodPrefs } from "@/data/preferences";
import { track } from "@/lib/analytics";
import { toError } from "@/lib/supabase-helpers";
import { cn } from "@/lib/utils";

/**
 * Log a meal in one or two taps: the meal is picked from the time of day,
 * your usual foods are one tap each, and typing any name + Enter logs it.
 * Every log can be undone from the toast.
 */
export function QuickMeals({
  date,
  showLink = false,
  showDay = true,
}: {
  date: string;
  showLink?: boolean;
  /** List what was logged this day (off where the page lists it already). */
  showDay?: boolean;
}) {
  const queryClient = useQueryClient();
  const foods = useQuery(foodsQuery());
  const logs = useQuery(foodLogsQuery());
  const [meal, setMeal] = useState<Meal>(() => mealForTime());
  const [text, setText] = useState("");
  const [calories, setCalories] = useState("");

  const all = logs.data ?? [];
  const today = all.filter((log) => log.log_date === date);
  const totals = dayTotals(today);
  const prefs = useQuery(preferencesQuery());
  const usual = readFoodPrefs(prefs.data?.food_prefs);
  const [setupOpen, setSetupOpen] = useState(false);
  // Your usual foods for this meal come first, in the order you picked them.
  const chosenNames = (usual?.meals[meal] ?? []).map((name) => name.toLowerCase());
  const chosenFoods = chosenNames
    .map((name) => (foods.data ?? []).find((food) => food.name.toLowerCase() === name))
    .filter((food): food is Food => !!food);
  const suggestions = [
    ...chosenFoods,
    ...suggestedFoods(foods.data ?? [], all, 8, meal).filter(
      (food) => !chosenFoods.some((chosen) => chosen.id === food.id),
    ),
  ].slice(0, 8);
  const usualAtMeal = all.some((log) => log.meal === meal && log.food_id);
  // Typed-in foods from this meal first, then any meal.
  const oneOffs = [...recentOneOffs(all.filter((log) => log.meal === meal), 4), ...recentOneOffs(all, 4)]
    .filter((log, index, list) => list.findIndex((other) => other.name === log.name) === index)
    .slice(0, 4);
  const matches = useMemo(() => {
    const q = text.trim().toLowerCase();
    if (!q) return [];
    return (foods.data ?? []).filter((food) => food.name.toLowerCase().includes(q)).slice(0, 5);
  }, [text, foods.data]);

  const add = useMutation({
    mutationFn: (input: FoodLogInput) => createFoodLog(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: foodKeys.logs });
      const previous = queryClient.getQueryData<FoodLog[]>(foodKeys.logs);
      const now = new Date().toISOString();
      queryClient.setQueryData<FoodLog[]>(foodKeys.logs, (rows = []) => [
        ...rows,
        { ...input, id: `local-${now}`, created_at: now, updated_at: now, user_id: "" } as FoodLog,
      ]);
      return previous;
    },
    onSuccess: (saved, input) => {
      track("meal_logged", { library: !!input.food_id });
      toast(`${input.name ?? "Food"} added to ${meal}`, {
        action: { label: "Undo", onClick: () => remove.mutate(saved.id) },
      });
    },
    onError: (error, _input, previous) => {
      if (previous) queryClient.setQueryData(foodKeys.logs, previous);
      toast.error(toError(error).message);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: foodKeys.logs }),
  });

  const remove = useMutation({
    mutationFn: deleteFoodLog,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: foodKeys.logs });
      const previous = queryClient.getQueryData<FoodLog[]>(foodKeys.logs);
      queryClient.setQueryData<FoodLog[]>(foodKeys.logs, (rows = []) =>
        rows.filter((r) => r.id !== id),
      );
      return previous;
    },
    onError: (error, _id, previous) => {
      if (previous) queryClient.setQueryData(foodKeys.logs, previous);
      toast.error(toError(error).message);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: foodKeys.logs }),
  });

  const logFood = (food: Food) => add.mutate(logFromFood(food, 1, date, meal));
  const logTyped = () => {
    const name = text.trim();
    if (!name) return;
    const exact = (foods.data ?? []).find((food) => food.name.toLowerCase() === name.toLowerCase());
    if (exact) logFood(exact);
    else {
      add.mutate({
        food_id: null,
        name,
        log_date: date,
        meal,
        servings: 1,
        calories: Number(calories) || 0,
        protein_g: null,
        carbs_g: null,
        fat_g: null,
      });
    }
    setText("");
    setCalories("");
  };

  return (
    <div className="space-y-4">
      {/* Which meal: preselected from the time of day. */}
      <div className="flex gap-1 rounded-xl bg-secondary p-1" role="radiogroup" aria-label="Meal">
        {MEALS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={meal === option.value}
            onClick={() => setMeal(option.value)}
            className={cn(
              "flex-1 rounded-lg py-2 text-xs font-medium transition-colors",
              meal === option.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Type anything; Enter logs it. */}
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          logTyped();
        }}
      >
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={`What did you have for ${meal}?`}
          aria-label="Food"
          enterKeyHint="done"
          className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {text.trim() && !matches.length ? (
          <input
            value={calories}
            onChange={(event) => setCalories(event.target.value)}
            placeholder="kcal"
            aria-label="Calories (optional)"
            inputMode="numeric"
            className="h-11 w-20 rounded-xl border border-input bg-background px-3 text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        ) : null}
        <Button
          type="submit"
          size="icon"
          className="size-11 shrink-0"
          aria-label="Log it"
          disabled={!text.trim()}
        >
          <Plus className="size-5" />
        </Button>
      </form>

      {/* Matches while typing, else your usual foods: one tap each. */}
      {!matches.length && (suggestions.length || oneOffs.length) ? (
        <p className="-mb-2 text-xs text-muted-foreground">
          {chosenFoods.length || usualAtMeal ? `Usually at ${meal}` : "Your foods"}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        {(matches.length ? matches : suggestions).map((food) => (
          <button
            key={food.id}
            type="button"
            onClick={() => {
              logFood(food);
              setText("");
            }}
            className="rounded-full border border-border px-3 py-1.5 text-sm transition-colors hover:bg-accent active:scale-[0.97]"
          >
            {food.name}
            {Number(food.calories) ? (
              <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">
                {Math.round(Number(food.calories))}
              </span>
            ) : null}
          </button>
        ))}
        {!matches.length
          ? oneOffs.map((log) => (
              <button
                key={log.id}
                type="button"
                onClick={() =>
                  add.mutate({
                    food_id: null,
                    name: log.name,
                    log_date: date,
                    meal,
                    servings: 1,
                    calories: Number(log.calories) || 0,
                    protein_g: log.protein_g,
                    carbs_g: log.carbs_g,
                    fat_g: log.fat_g,
                  })
                }
                className="rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent active:scale-[0.97]"
              >
                {log.name}
              </button>
            ))
          : null}
      </div>

      {/* Today, by meal. */}
      {!showDay ? null : today.length ? (
        <div className="space-y-2">
          {MEALS.filter((option) =>
            today.some((log) => (log.meal ?? "snack") === option.value),
          ).map((option) => (
            <div key={option.value} className="flex flex-wrap items-center gap-1.5">
              <span className="w-20 text-xs text-muted-foreground">{option.label}</span>
              {today
                .filter((log) => (log.meal ?? "snack") === option.value)
                .map((log) => (
                  <span
                    key={log.id}
                    className="inline-flex items-center gap-1 rounded-full bg-secondary py-1 pl-3 pr-1 text-sm"
                  >
                    {log.name ?? "Food"}
                    {Number(log.servings) !== 1 ? (
                      <span className="text-xs text-muted-foreground">×{Number(log.servings)}</span>
                    ) : null}
                    <button
                      type="button"
                      aria-label={`Remove ${log.name ?? "food"}`}
                      onClick={() => remove.mutate(log.id)}
                      className="rounded-full p-1 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
            </div>
          ))}
          {totals.calories > 0 ? (
            <p className="text-xs tabular-nums text-muted-foreground">
              {Math.round(totals.calories).toLocaleString()} kcal
              {totals.protein ? ` · ${Math.round(totals.protein)} g protein` : ""} from what you
              logged
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Nothing logged for this day yet.</p>
      )}

      {!usual && !prefs.isLoading ? (
        <button
          type="button"
          onClick={() => setSetupOpen(true)}
          className="block text-left text-xs text-muted-foreground underline underline-offset-4"
        >
          Tell Life OS what you usually eat, and it offers those first
        </button>
      ) : null}
      <FoodSetup open={setupOpen} onOpenChange={setSetupOpen} />
      {showLink ? (
        <Link
          to="/food"
          className="inline-block text-xs text-muted-foreground underline underline-offset-4"
        >
          Food library and details
        </Link>
      ) : null}
    </div>
  );
}
