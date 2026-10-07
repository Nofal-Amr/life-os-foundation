import { useQuery } from "@tanstack/react-query";
import { Briefcase, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { financeCategoriesQuery, transactionsQuery } from "@/data/finance";
import { workdayCost } from "@/data/workdayCost";
import { usePreferences } from "@/hooks/usePreferences";
import { cn } from "@/lib/utils";

const STORE = "money:workday-cost";
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Setup = { categories: string[]; workdays: number[] };

function readSetup(): Setup {
  try {
    const value = JSON.parse(localStorage.getItem(STORE) ?? "null") as Setup | null;
    if (value && Array.isArray(value.categories) && Array.isArray(value.workdays)) return value;
  } catch {
    // Fall through.
  }
  return { categories: [], workdays: [0, 1, 2, 3, 4] };
}

/**
 * What going to work costs you: your own logged spending in the categories
 * you pick (fuel, transport, lunch out…) on your workdays, last 30 days.
 */
export function WorkdayCostCard() {
  const transactions = useQuery(transactionsQuery());
  const categories = useQuery(financeCategoriesQuery());
  const { fmtMoney } = usePreferences();
  const [setup, setSetup] = useState<Setup>({ categories: [], workdays: [0, 1, 2, 3, 4] });
  const [editing, setEditing] = useState(false);

  useEffect(() => setSetup(readSetup()), []);

  function save(next: Setup) {
    setSetup(next);
    try {
      localStorage.setItem(STORE, JSON.stringify(next));
    } catch {
      // Kept for this session.
    }
  }

  const expenseCategories = (categories.data ?? []).filter((item) => item.kind === "expense");
  const result = workdayCost({
    transactions: transactions.data ?? [],
    categoryIds: setup.categories,
    workdays: setup.workdays,
  });
  const configured = setup.categories.length > 0 && setup.workdays.length > 0;

  return (
    <section className="stat-card space-y-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Briefcase className="size-4" aria-hidden="true" /> Going to work
        </p>
        <Button size="sm" variant="ghost" onClick={() => setEditing((value) => !value)}>
          <Settings2 className="size-4" /> {editing ? "Done" : "Choose"}
        </Button>
      </div>

      {configured && !editing ? (
        result.entries ? (
          <div>
            <p className="text-2xl font-semibold tabular-nums">
              {fmtMoney(result.perWorkday ?? 0)}
              <span className="ml-1 text-sm font-normal text-muted-foreground">a workday</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {fmtMoney(result.total)} over {result.workdays} workdays in the last 30 days, from{" "}
              {result.entries} {result.entries === 1 ? "entry" : "entries"}.
              {result.offDays > 0
                ? ` ${fmtMoney(result.offDays)} on days off in the same categories.`
                : ""}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nothing logged in those categories on workdays in the last 30 days.
          </p>
        )
      ) : null}

      {!configured && !editing ? (
        <p className="text-sm text-muted-foreground">
          Pick the categories that are the cost of going to work (fuel, transport, lunch out) and
          your workdays.
        </p>
      ) : null}

      {editing ? (
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">Workdays</p>
            <div className="flex flex-wrap gap-1.5">
              {DAY_LABELS.map((label, day) => {
                const on = setup.workdays.includes(day);
                return (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      save({
                        ...setup,
                        workdays: on
                          ? setup.workdays.filter((d) => d !== day)
                          : [...setup.workdays, day],
                      })
                    }
                    className={cn(
                      "min-h-9 min-w-11 rounded-md border px-2 text-sm",
                      on ? "border-primary bg-primary/15" : "border-border text-muted-foreground",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">Categories that are work costs</p>
            {expenseCategories.length ? (
              <div className="flex flex-wrap gap-1.5">
                {expenseCategories.map((category) => {
                  const on = setup.categories.includes(category.id);
                  return (
                    <button
                      key={category.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        save({
                          ...setup,
                          categories: on
                            ? setup.categories.filter((id) => id !== category.id)
                            : [...setup.categories, category.id],
                        })
                      }
                      className={cn(
                        "min-h-9 rounded-md border px-3 text-sm",
                        on ? "border-primary bg-primary/15" : "border-border text-muted-foreground",
                      )}
                    >
                      {category.name}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Add spending categories in Money first.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
