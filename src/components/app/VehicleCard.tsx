import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Fuel, Gauge, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { FillupDialog } from "@/components/app/FillupDialog";
import { ResourceUsage } from "@/components/app/ResourceUsage";
import { Button } from "@/components/ui/button";
import { FUEL_GRADES, deleteFillup, fuelKeys, fuelStats, type FuelFillup } from "@/data/fuel";
import type { Resource, ResourceReading } from "@/data/resources";
import { usePreferences } from "@/hooks/usePreferences";
import { toError } from "@/lib/supabase-helpers";

const round = (value: number, digits = 1) => Math.round(value * 10 ** digits) / 10 ** digits;

/**
 * A vehicle: km left before the next fill-up, real consumption from full
 * tanks, cost per km, and distance driven per day or month.
 */
export function VehicleCard({
  vehicle,
  fillups,
  readings,
  onUpdateKm,
}: {
  vehicle: Resource;
  fillups: FuelFillup[];
  readings: ResourceReading[];
  onUpdateKm: () => void;
}) {
  const queryClient = useQueryClient();
  const { fmtMoney, fmtDate } = usePreferences();
  const [fillOpen, setFillOpen] = useState(false);
  const own = fillups.filter((fill) => fill.resource_id === vehicle.id);
  const stats = fuelStats({
    fillups: own,
    odometer: readings,
    tankLitres: vehicle.quota_amount == null ? null : Number(vehicle.quota_amount),
    fullTankEstimateKm: vehicle.full_tank_km == null ? null : Number(vehicle.full_tank_km),
  });
  const remove = useMutation({
    mutationFn: deleteFillup,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: fuelKeys.all }),
    onError: (error) => toast.error(toError(error).message),
  });

  // Odometer over time, from fill-ups and plain readings, for the distance chart.
  const odometer = [
    ...own.map((fill) => ({ reading: Number(fill.odometer_km), reading_at: fill.filled_at })),
    ...readings.map((row) => ({ reading: Number(row.reading), reading_at: row.reading_at })),
  ];
  const last = stats.lastFill;

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {stats.kmLeft != null ? (
            <>
              <p className="text-3xl font-semibold leading-none tabular-nums">
                {Math.round(stats.kmLeft)}{" "}
                <span className="text-base font-normal text-muted-foreground">km left</span>
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {stats.fullTankSource === "tank"
                  ? `A full tank goes about ${Math.round(stats.fullTankKm!)} km at your consumption`
                  : `Using your estimate of ${Math.round(stats.fullTankKm!)} km per full tank`}
                {stats.kmSinceFull != null
                  ? ` · ${Math.round(stats.kmSinceFull)} km since the last full tank`
                  : ""}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {own.length
                ? "Km left shows once there's a full-tank fill-up and your tank size or a full-tank estimate (Edit)."
                : "Log a fill-up to start. Two full tanks give your real km per litre."}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setFillOpen(true)}>
            <Fuel className="size-4" aria-hidden="true" />
            Fill-up
          </Button>
          <Button size="sm" variant="outline" onClick={onUpdateKm}>
            <Gauge className="size-4" aria-hidden="true" />
            Update km
          </Button>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Km per litre</dt>
          <dd className="tabular-nums">{stats.kmPerLitre ? round(stats.kmPerLitre) : "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">L per 100 km</dt>
          <dd className="tabular-nums">{stats.litresPer100 ? round(stats.litresPer100) : "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Cost per km</dt>
          <dd className="tabular-nums">
            {stats.costPerKm ? fmtMoney(round(stats.costPerKm, 2)) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Odometer</dt>
          <dd className="tabular-nums">
            {stats.currentKm != null ? `${stats.currentKm} km` : "—"}
          </dd>
        </div>
      </dl>
      {stats.stretches ? (
        <p className="text-xs text-muted-foreground">
          From {stats.stretches} full-to-full {stats.stretches === 1 ? "tank" : "tanks"}.
        </p>
      ) : null}

      {odometer.length >= 2 ? (
        <ResourceUsage kind="meter" unit="km" color={vehicle.color} readings={odometer} />
      ) : null}

      {own.length ? (
        <details className="text-sm">
          <summary className="min-h-8 cursor-pointer select-none py-1 text-xs text-muted-foreground">
            Fill-ups ({own.length}){last ? ` · last ${fmtDate(last.filled_at.slice(0, 10))}` : ""}
          </summary>
          <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
            {[...own].reverse().map((fill) => (
              <li key={fill.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="min-w-0 tabular-nums">
                  {format(new Date(fill.filled_at), "d MMM")} · {Number(fill.odometer_km)} km
                  <span className="text-muted-foreground">
                    {" · "}
                    {FUEL_GRADES.find((grade) => grade.value === fill.grade)?.label ?? "Fuel"}
                    {fill.litres ? ` · ${Number(fill.litres)} L` : ""}
                    {fill.total_cost ? ` · ${fmtMoney(Number(fill.total_cost))}` : ""}
                    {fill.full_tank ? " · full" : ""}
                  </span>
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Delete this fill-up"
                  onClick={() => remove.mutate(fill.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <FillupDialog
        vehicle={vehicle}
        fillups={own}
        currentKm={stats.currentKm}
        open={fillOpen}
        onOpenChange={setFillOpen}
      />
    </div>
  );
}
