import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import { accountsQuery, createTransaction, financeKeys, signedAmount } from "@/data/finance";
import {
  FUEL_GRADES,
  completeFillup,
  createFillup,
  fuelKeys,
  type FuelFillup,
  type FuelGrade,
} from "@/data/fuel";
import type { Resource } from "@/data/resources";
import { usePreferences } from "@/hooks/usePreferences";
import { todayISO } from "@/lib/date";
import { toError } from "@/lib/supabase-helpers";
import { cn } from "@/lib/utils";

const num = (text: string) => (text.trim() === "" ? null : Number(text));

/**
 * One fill-up: odometer, grade, price per litre, and litres or what you paid
 * (the third is worked out). Optionally logged as spending too.
 */
export function FillupDialog({
  vehicle,
  fillups,
  currentKm,
  open,
  onOpenChange,
}: {
  vehicle: Resource;
  fillups: FuelFillup[];
  currentKm: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const accounts = useQuery(accountsQuery());
  const { fmtMoney } = usePreferences();
  const [odometer, setOdometer] = useState("");
  const [grade, setGrade] = useState<FuelGrade>("92");
  const [price, setPrice] = useState("");
  const [litres, setLitres] = useState("");
  const [total, setTotal] = useState("");
  const [full, setFull] = useState(true);
  const [accountId, setAccountId] = useState<string>("none");

  const lastPrice = (forGrade: FuelGrade) =>
    [...fillups].reverse().find((fill) => fill.grade === forGrade && fill.price_per_litre)
      ?.price_per_litre;

  useEffect(() => {
    if (!open) return;
    const lastGrade = ([...fillups].reverse().find((fill) => fill.grade)?.grade ??
      "92") as FuelGrade;
    setOdometer(currentKm != null ? String(currentKm) : "");
    setGrade(lastGrade);
    setPrice(lastPrice(lastGrade) != null ? String(lastPrice(lastGrade)) : "");
    setLitres("");
    setTotal("");
    setFull(true);
    setAccountId(vehicle.account_id ?? "none");
    // Only when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const figures = completeFillup({ litres: num(litres), price: num(price), total: num(total) });
  const tooLow = currentKm != null && num(odometer) != null && num(odometer)! < currentKm;
  const ready =
    num(odometer) != null && (figures.litres != null || figures.total != null) && !tooLow;

  const save = useMutation({
    mutationFn: async () => {
      const gradeLabel = FUEL_GRADES.find((option) => option.value === grade)?.label ?? grade;
      let transaction_id: string | null = null;
      if (accountId !== "none" && figures.total) {
        const transaction = await createTransaction({
          account_id: accountId,
          kind: "expense",
          amount: signedAmount(figures.total, "expense"),
          date: todayISO(),
          description: `Fuel ${gradeLabel}${figures.litres ? ` · ${figures.litres} L` : ""}`,
          category_id: vehicle.category_id,
        } as never);
        transaction_id = (transaction as { id: string }).id;
      }
      return createFillup({
        resource_id: vehicle.id,
        filled_at: new Date().toISOString(),
        odometer_km: num(odometer)!,
        litres: figures.litres,
        price_per_litre: figures.price,
        total_cost: figures.total,
        grade,
        full_tank: full,
        transaction_id,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: fuelKeys.all });
      void queryClient.invalidateQueries({ queryKey: financeKeys.transactions });
      toast.success("Fill-up logged.");
      onOpenChange(false);
    },
    onError: (error) => toast.error(toError(error).message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fill-up · {vehicle.name}</DialogTitle>
          <DialogDescription>
            Any two of litres, price and total; the third is worked out.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (ready) save.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="fill-odometer">Odometer now (km)</Label>
            <Input
              id="fill-odometer"
              inputMode="numeric"
              className="h-12 tabular-nums"
              value={odometer}
              onChange={(event) => setOdometer(event.target.value)}
            />
            {tooLow ? (
              <p className="text-xs text-muted-foreground">
                That's below the last reading ({currentKm} km).
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Fuel</Label>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Fuel grade">
              {FUEL_GRADES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={grade === option.value}
                  onClick={() => {
                    setGrade(option.value);
                    const last = lastPrice(option.value);
                    if (last != null) setPrice(String(last));
                  }}
                  className={cn(
                    "min-h-9 rounded-full border px-3 text-sm transition-colors",
                    grade === option.value
                      ? "border-transparent bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:bg-accent",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-2">
              <Label htmlFor="fill-price">Price / L</Label>
              <Input
                id="fill-price"
                inputMode="decimal"
                className="h-12 tabular-nums"
                value={price}
                placeholder={figures.price != null && !price ? String(figures.price) : ""}
                onChange={(event) => setPrice(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fill-litres">Litres</Label>
              <Input
                id="fill-litres"
                inputMode="decimal"
                className="h-12 tabular-nums"
                value={litres}
                placeholder={figures.litres != null && !litres ? String(figures.litres) : ""}
                onChange={(event) => setLitres(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fill-total">Paid</Label>
              <Input
                id="fill-total"
                inputMode="decimal"
                className="h-12 tabular-nums"
                value={total}
                placeholder={figures.total != null && !total ? String(figures.total) : ""}
                onChange={(event) => setTotal(event.target.value)}
              />
            </div>
          </div>
          {figures.total != null && figures.litres != null ? (
            <p className="text-xs text-muted-foreground tabular-nums">
              {figures.litres} L for {fmtMoney(figures.total)}
            </p>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="fill-full" className="block">
              Filled to full
              <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                Full tanks are what km per litre is measured between.
              </span>
            </Label>
            <Switch id="fill-full" checked={full} onCheckedChange={setFull} />
          </div>

          <div className="space-y-2">
            <Label>Also log as spending</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Don't log spending</SelectItem>
                {(accounts.data ?? [])
                  .filter((account) => account.active)
                  .map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      From {account.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" className="h-12 w-full" disabled={!ready || save.isPending}>
            {save.isPending ? "Saving…" : "Log fill-up"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
