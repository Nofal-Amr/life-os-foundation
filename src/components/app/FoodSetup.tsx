import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { createFood, foodKeys, foodsQuery } from "@/data/food";
import {
  CUISINES,
  FOOD_LIBRARY,
  suggestionsFor,
  toFoodInput,
  type Cuisine,
  type LibraryMeal,
} from "@/data/foodLibrary";
import {
  preferencesKeys,
  preferencesQuery,
  readFoodPrefs,
  savePreferences,
  type FoodPrefs,
} from "@/data/preferences";
import { toError } from "@/lib/supabase-helpers";
import { cn } from "@/lib/utils";

const MEAL_STEPS: { value: LibraryMeal; label: string; question: string }[] = [
  { value: "breakfast", label: "Breakfast", question: "What do you usually have for breakfast?" },
  { value: "lunch", label: "Lunch", question: "And for lunch?" },
  { value: "dinner", label: "Dinner", question: "And for dinner?" },
  { value: "snack", label: "Snacks", question: "Any snacks or drinks you have often?" },
];

/**
 * Setting up what you eat, one question at a time: your cuisines, then your
 * usual foods for each meal. Chosen foods join your library, and logging a
 * meal offers them first. Everything can be changed later.
 */
export function FoodSetup({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const prefs = useQuery(preferencesQuery());
  const foods = useQuery(foodsQuery());
  const [step, setStep] = useState(0); // 0 = cuisines, 1..4 = meals
  const [cuisines, setCuisines] = useState<Cuisine[]>([]);
  const [meals, setMeals] = useState<FoodPrefs["meals"]>({});

  useEffect(() => {
    if (!open) return;
    const saved = readFoodPrefs(prefs.data?.food_prefs);
    setCuisines((saved?.cuisines as Cuisine[] | undefined) ?? ["egyptian"]);
    setMeals(saved?.meals ?? {});
    setStep(0);
    // Only when opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const meal = step > 0 ? MEAL_STEPS[step - 1]! : null;
  const options = useMemo(
    () => (meal ? suggestionsFor(meal.value, cuisines) : []),
    [meal, cuisines],
  );
  const chosen = meal ? (meals[meal.value] ?? []) : [];

  const toggle = (name: string) => {
    if (!meal) return;
    setMeals((current) => {
      const list = current[meal.value] ?? [];
      return {
        ...current,
        [meal.value]: list.includes(name) ? list.filter((item) => item !== name) : [...list, name],
      };
    });
  };

  const finish = useMutation({
    mutationFn: async () => {
      const have = new Set((foods.data ?? []).map((food) => food.name.trim().toLowerCase()));
      const wanted = new Set(Object.values(meals).flat());
      const missing = FOOD_LIBRARY.filter(
        (food) => wanted.has(food.name) && !have.has(food.name.toLowerCase()),
      );
      for (const food of missing) await createFood(toFoodInput(food));
      await savePreferences({ food_prefs: { cuisines, meals } });
      return missing.length;
    },
    onSuccess: (added) => {
      void queryClient.invalidateQueries({ queryKey: foodKeys.foods });
      void queryClient.invalidateQueries({ queryKey: preferencesKeys.current });
      toast.success(
        added
          ? `Saved, and ${added} ${added === 1 ? "food" : "foods"} added to your library.`
          : "Saved.",
      );
      onOpenChange(false);
    },
    onError: (error) => toast.error(toError(error).message),
  });

  const last = step === MEAL_STEPS.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 sm:max-w-lg">
        <DialogTitle>{meal ? meal.question : "Which food do you eat?"}</DialogTitle>
        <DialogDescription className="mt-1">
          {meal
            ? "Tap the ones you have often. They'll show first when you log this meal."
            : "Pick any. It only decides which foods are suggested."}
        </DialogDescription>

        <div className="mt-2 flex gap-1" aria-hidden="true">
          {[0, ...MEAL_STEPS.map((_, index) => index + 1)].map((index) => (
            <span
              key={index}
              className={cn("h-1 flex-1 rounded-full", index <= step ? "bg-primary" : "bg-muted")}
            />
          ))}
        </div>

        <div className="-mx-2 mt-4 min-h-0 flex-1 overflow-y-auto px-2">
          <div className="flex flex-wrap gap-2">
            {meal
              ? options.map((food) => {
                  const selected = chosen.includes(food.name);
                  return (
                    <button
                      key={food.name}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggle(food.name)}
                      className={cn(
                        "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-[background-color,border-color,scale] duration-150 active:scale-[0.97]",
                        selected
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      {selected ? (
                        <Check className="size-3.5 text-primary" aria-hidden="true" />
                      ) : null}
                      {food.name}
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {food.calories}
                      </span>
                    </button>
                  );
                })
              : CUISINES.map((option) => {
                  const selected = cuisines.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        setCuisines((current) =>
                          selected
                            ? current.filter((value) => value !== option.value)
                            : [...current, option.value],
                        )
                      }
                      className={cn(
                        "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm transition-colors",
                        selected
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      {selected ? (
                        <Check className="size-3.5 text-primary" aria-hidden="true" />
                      ) : null}
                      {option.label}
                    </button>
                  );
                })}
          </div>
          {meal && !options.length ? (
            <p className="py-4 text-sm text-muted-foreground">
              Nothing in the list for this meal yet. You can add your own foods on the Food page.
            </p>
          ) : null}
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          <Button variant="ghost" onClick={() => (step ? setStep(step - 1) : onOpenChange(false))}>
            {step ? "Back" : "Not now"}
          </Button>
          {last ? (
            <Button disabled={finish.isPending} onClick={() => finish.mutate()}>
              {finish.isPending ? "Saving…" : "Done"}
            </Button>
          ) : (
            <Button onClick={() => setStep(step + 1)}>
              {meal && !chosen.length ? "Skip" : "Next"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
