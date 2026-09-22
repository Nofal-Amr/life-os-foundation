import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createFood, foodKeys, foodsQuery } from "@/data/food";
import { libraryNotYetAdded, toFoodInput, type LibraryFood } from "@/data/foodLibrary";
import { toError } from "@/lib/supabase-helpers";
import { cn } from "@/lib/utils";

/**
 * Everyday foods with typical figures, so the library doesn't start empty.
 * Whatever is added becomes a normal entry you can edit or delete.
 */
export function FoodLibraryDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const foods = useQuery(foodsQuery());
  const [picked, setPicked] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const available = useMemo(() => libraryNotYetAdded(foods.data ?? []), [foods.data]);
  const shown = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? available.filter((food) => food.name.toLowerCase().includes(query))
      : available;
  }, [available, search]);

  const groups = useMemo(() => {
    const map = new Map<string, LibraryFood[]>();
    for (const food of shown) map.set(food.group, [...(map.get(food.group) ?? []), food]);
    return [...map.entries()];
  }, [shown]);

  const add = useMutation({
    mutationFn: async (names: string[]) => {
      const chosen = available.filter((food) => names.includes(food.name));
      for (const food of chosen) await createFood(toFoodInput(food));
      return chosen.length;
    },
    onSuccess: (count) => {
      void queryClient.invalidateQueries({ queryKey: foodKeys.foods });
      toast.success(`${count} ${count === 1 ? "food" : "foods"} added to your library.`);
      setPicked([]);
      onOpenChange(false);
    },
    onError: (error) => toast.error(toError(error).message),
  });

  const toggle = (name: string) =>
    setPicked((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name],
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 sm:max-w-lg">
        <DialogTitle>Add common foods</DialogTitle>
        <DialogDescription className="mt-1">
          Typical figures from public food tables, rounded. Portions and recipes vary, so edit
          anything after adding it.
        </DialogDescription>

        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search foods"
          aria-label="Search foods"
          className="mt-4"
        />

        <div className="-mx-2 mt-3 min-h-0 flex-1 overflow-y-auto px-2">
          {groups.length ? (
            groups.map(([group, items]) => (
              <div key={group} className="mb-4">
                <p className="mb-2 text-xs font-medium text-muted-foreground">{group}</p>
                <ul className="space-y-1.5">
                  {items.map((food) => {
                    const selected = picked.includes(food.name);
                    return (
                      <li key={food.name}>
                        <button
                          type="button"
                          onClick={() => toggle(food.name)}
                          aria-pressed={selected}
                          className={cn(
                            "flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors duration-150",
                            selected ? "border-primary bg-primary/10" : "border-border hover:bg-accent",
                          )}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{food.name}</span>
                            <span className="block text-xs text-muted-foreground">
                              {food.serving_label} · {food.calories} kcal · {food.protein_g} g protein
                            </span>
                          </span>
                          <span
                            aria-hidden="true"
                            className={cn(
                              "flex size-6 shrink-0 items-center justify-center rounded-full border",
                              selected ? "border-primary bg-primary text-primary-foreground" : "border-border",
                            )}
                          >
                            {selected ? <Check className="size-3.5" /> : null}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {available.length
                ? "Nothing matches that search."
                : "Everything from the list is already in your library."}
            </p>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!picked.length || add.isPending} onClick={() => add.mutate(picked)}>
            {add.isPending
              ? "Adding…"
              : picked.length
                ? `Add ${picked.length}`
                : "Add"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
