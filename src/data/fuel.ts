/**
 * A vehicle's fuel, worked out from your own fill-ups and odometer readings.
 *
 * - Consumption comes from full-to-full fills: the distance between two
 *   full tanks divided by the litres put in after the first, up to and
 *   including the second. Partial fills in between count toward the litres.
 * - Km left: how far a full tank goes (your tank size × your km per litre,
 *   or your own "a full tank lasts about … km" until there's data), minus
 *   what you've driven since the last full fill, plus any partial top-ups.
 * Nothing is guessed from nothing: a figure is null until it can be known.
 */
import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { currentUserId, unwrap } from "@/lib/supabase-helpers";

export type FuelFillup = Database["public"]["Tables"]["fuel_fillups"]["Row"];
export type FuelGrade = "80" | "92" | "95" | "diesel" | "electric" | "other";

export const FUEL_GRADES: { value: FuelGrade; label: string }[] = [
  { value: "92", label: "92" },
  { value: "95", label: "95" },
  { value: "80", label: "80" },
  { value: "diesel", label: "Diesel" },
  { value: "electric", label: "Electric (kWh)" },
  { value: "other", label: "Other" },
];

export type FillupInput = {
  resource_id: string;
  filled_at: string;
  odometer_km: number;
  litres: number | null;
  price_per_litre: number | null;
  total_cost: number | null;
  grade: FuelGrade | null;
  full_tank: boolean;
  transaction_id?: string | null;
  note?: string | null;
};

export const fuelKeys = { all: ["fuel_fillups"] as const };

export const fuelFillupsQuery = () =>
  queryOptions({
    queryKey: fuelKeys.all,
    queryFn: async () =>
      unwrap(
        await supabase.from("fuel_fillups").select("*").order("filled_at", { ascending: true }),
      ) as FuelFillup[],
  });

export async function createFillup(input: FillupInput): Promise<FuelFillup> {
  const user_id = await currentUserId();
  return unwrap(
    await supabase
      .from("fuel_fillups")
      .insert({ ...input, user_id })
      .select()
      .single(),
  ) as FuelFillup;
}

export async function deleteFillup(id: string): Promise<void> {
  unwrap(await supabase.from("fuel_fillups").delete().eq("id", id).select());
}

/** Any two of litres, price per litre and total give the third. */
export function completeFillup(input: {
  litres: number | null;
  price: number | null;
  total: number | null;
}): { litres: number | null; price: number | null; total: number | null } {
  const { litres, price, total } = input;
  const round = (value: number, digits: number) => Math.round(value * 10 ** digits) / 10 ** digits;
  if (litres && price && total == null) return { litres, price, total: round(litres * price, 2) };
  if (total && price && litres == null) return { litres: round(total / price, 2), price, total };
  if (total && litres && price == null) return { litres, price: round(total / litres, 2), total };
  return { litres, price, total };
}

function litresOf(
  fill: Pick<FuelFillup, "litres" | "total_cost" | "price_per_litre">,
): number | null {
  if (fill.litres) return Number(fill.litres);
  if (fill.total_cost && fill.price_per_litre) {
    return Number(fill.total_cost) / Number(fill.price_per_litre);
  }
  return null;
}

function costOf(
  fill: Pick<FuelFillup, "litres" | "total_cost" | "price_per_litre">,
): number | null {
  if (fill.total_cost != null) return Number(fill.total_cost);
  if (fill.litres && fill.price_per_litre)
    return Number(fill.litres) * Number(fill.price_per_litre);
  return null;
}

export type FuelStats = {
  /** Highest odometer seen, from fill-ups or readings. */
  currentKm: number | null;
  kmPerLitre: number | null;
  litresPer100: number | null;
  costPerKm: number | null;
  /** Distance a full tank covers, and where that figure comes from. */
  fullTankKm: number | null;
  fullTankSource: "tank" | "estimate" | null;
  kmSinceFull: number | null;
  kmLeft: number | null;
  /** Full-to-full stretches the averages come from. */
  stretches: number;
  lastFill: FuelFillup | null;
};

export function fuelStats(args: {
  fillups: FuelFillup[];
  /** Odometer readings (km) logged without a fill-up. */
  odometer?: { reading: number | string; reading_at: string }[];
  tankLitres?: number | null;
  /** Your own starting figure, used until there's data. */
  fullTankEstimateKm?: number | null;
}): FuelStats {
  const fills = [...args.fillups].sort(
    (a, b) =>
      Number(a.odometer_km) - Number(b.odometer_km) || a.filled_at.localeCompare(b.filled_at),
  );
  const readings = (args.odometer ?? []).map((row) => Number(row.reading));
  const allKm = [...fills.map((fill) => Number(fill.odometer_km)), ...readings];
  const currentKm = allKm.length ? Math.max(...allKm) : null;

  // Full-to-full stretches.
  let distance = 0;
  let litres = 0;
  let cost = 0;
  let costKnown = true;
  let stretches = 0;
  let lastFullIndex = -1;
  for (let index = 0; index < fills.length; index++) {
    const fill = fills[index]!;
    if (!fill.full_tank) continue;
    if (lastFullIndex >= 0) {
      const between = fills.slice(lastFullIndex + 1, index + 1);
      const used = between.map(litresOf);
      const km = Number(fill.odometer_km) - Number(fills[lastFullIndex]!.odometer_km);
      if (km > 0 && used.every((value) => value != null)) {
        distance += km;
        litres += used.reduce<number>((sum, value) => sum + (value ?? 0), 0);
        const costs = between.map(costOf);
        if (costs.some((value) => value == null)) costKnown = false;
        else cost += costs.reduce<number>((sum, value) => sum + (value ?? 0), 0);
        stretches += 1;
      }
    }
    lastFullIndex = index;
  }

  const kmPerLitre = stretches && litres > 0 ? distance / litres : null;
  const litresPer100 = kmPerLitre ? 100 / kmPerLitre : null;
  const costPerKm = stretches && costKnown && distance > 0 ? cost / distance : null;

  let fullTankKm: number | null = null;
  let fullTankSource: FuelStats["fullTankSource"] = null;
  if (args.tankLitres && kmPerLitre) {
    fullTankKm = args.tankLitres * kmPerLitre;
    fullTankSource = "tank";
  } else if (args.fullTankEstimateKm) {
    fullTankKm = args.fullTankEstimateKm;
    fullTankSource = "estimate";
  }

  const lastFull = lastFullIndex >= 0 ? fills[lastFullIndex]! : null;
  const kmSinceFull =
    lastFull && currentKm != null ? Math.max(0, currentKm - Number(lastFull.odometer_km)) : null;
  // Partial top-ups after the last full tank add their litres' worth of range.
  const topUpLitres = fills
    .slice(lastFullIndex + 1)
    .reduce((sum, fill) => sum + (litresOf(fill) ?? 0), 0);
  const perLitre =
    kmPerLitre ?? (fullTankKm && args.tankLitres ? fullTankKm / args.tankLitres : null);
  const kmLeft =
    fullTankKm != null && kmSinceFull != null
      ? Math.max(0, fullTankKm - kmSinceFull + (perLitre ? topUpLitres * perLitre : 0))
      : null;

  return {
    currentKm,
    kmPerLitre,
    litresPer100,
    costPerKm,
    fullTankKm,
    fullTankSource,
    kmSinceFull,
    kmLeft,
    stretches,
    lastFill: fills[fills.length - 1] ?? null,
  };
}
