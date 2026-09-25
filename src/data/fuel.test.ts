import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { completeFillup, fuelStats, type FuelFillup } from "./fuel";

const fill = (over: Partial<FuelFillup>): FuelFillup =>
  ({
    id: Math.random().toString(36),
    resource_id: "car",
    filled_at: "2026-09-01T10:00:00Z",
    odometer_km: 0,
    litres: null,
    price_per_litre: null,
    total_cost: null,
    grade: "92",
    full_tank: true,
    transaction_id: null,
    note: null,
    ...over,
  }) as FuelFillup;

describe("completeFillup", () => {
  it("works out the third figure from any two", () => {
    expect(completeFillup({ litres: 30, price: 15, total: null })).toEqual({
      litres: 30,
      price: 15,
      total: 450,
    });
    expect(completeFillup({ litres: null, price: 15, total: 450 })).toEqual({
      litres: 30,
      price: 15,
      total: 450,
    });
    expect(completeFillup({ litres: 30, price: null, total: 450 })).toEqual({
      litres: 30,
      price: 15,
      total: 450,
    });
  });
});

describe("fuelStats", () => {
  it("knows nothing from a single fill-up", () => {
    const stats = fuelStats({ fillups: [fill({ odometer_km: 10_000, litres: 40 })] });
    expect(stats.kmPerLitre).toBeNull();
    expect(stats.kmLeft).toBeNull();
    expect(stats.currentKm).toBe(10_000);
  });

  it("uses your own full-tank estimate on day one", () => {
    const stats = fuelStats({
      fillups: [fill({ odometer_km: 10_000, litres: 40 })],
      odometer: [{ reading: 10_120, reading_at: "2026-09-03T09:00:00Z" }],
      fullTankEstimateKm: 300,
    });
    expect(stats.kmSinceFull).toBe(120);
    expect(stats.kmLeft).toBe(180);
    expect(stats.fullTankSource).toBe("estimate");
  });

  it("measures consumption full to full, counting partial fills", () => {
    const stats = fuelStats({
      fillups: [
        fill({ odometer_km: 10_000, litres: 40, total_cost: 600 }),
        fill({ odometer_km: 10_150, litres: 10, total_cost: 150, full_tank: false }),
        fill({ odometer_km: 10_400, litres: 30, price_per_litre: 15 }),
      ],
      odometer: [{ reading: 10_500, reading_at: "2026-09-10T09:00:00Z" }],
      tankLitres: 45,
    });
    // 400 km on 10 + 30 litres.
    expect(stats.kmPerLitre).toBe(10);
    expect(stats.litresPer100).toBe(10);
    expect(stats.costPerKm).toBeCloseTo((150 + 450) / 400);
    expect(stats.fullTankKm).toBe(450);
    expect(stats.kmSinceFull).toBe(100);
    expect(stats.kmLeft).toBe(350);
  });

  it("adds a partial top-up after the last full tank to the range", () => {
    const stats = fuelStats({
      fillups: [
        fill({ odometer_km: 0, litres: 40 }),
        fill({ odometer_km: 400, litres: 40 }),
        fill({ odometer_km: 500, litres: 5, full_tank: false }),
      ],
      tankLitres: 40,
    });
    // 10 km/L, 400 km tank, 100 km driven, 5 L top-up = 50 km more.
    expect(stats.kmLeft).toBe(350);
  });
});
