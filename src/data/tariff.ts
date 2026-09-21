/**
 * Tiered electricity pricing, stored per meter in resources.tariff.
 *
 * Each tier covers consumption up to `max` kWh in a billing month. A bill in
 * tier k is priced progressively over tiers chainFrom..k, each band charged at
 * its own rate, plus tier k's monthly service fee. A tier whose chainFrom is
 * itself charges the whole consumption at its rate (Egypt's tiers 6 and 7).
 */
export type TariffTier = {
  /** Upper bound in kWh for the month; null for the last tier. */
  max: number | null;
  /** Price per kWh in the bill's currency. */
  rate: number;
  /** Monthly customer service fee for a bill in this tier. */
  fee: number;
  /** 1-based tier number where this tier's progressive pricing starts. */
  chainFrom: number;
};

export type Tariff = {
  name: string;
  source: string;
  tiers: TariffTier[];
};

/**
 * Egypt residential tariff, EgyptERA, April 2026
 * (https://egyptera.org/en/TarrifApril2026.aspx). Rates in EGP per kWh.
 */
export const EGYPT_RESIDENTIAL_2026: Tariff = {
  name: "Egypt residential",
  source: "EgyptERA, April 2026",
  tiers: [
    { max: 50, rate: 0.68, fee: 1, chainFrom: 1 },
    { max: 100, rate: 0.78, fee: 2, chainFrom: 1 },
    { max: 200, rate: 0.95, fee: 6, chainFrom: 3 },
    { max: 350, rate: 1.55, fee: 11, chainFrom: 3 },
    { max: 650, rate: 1.95, fee: 15, chainFrom: 3 },
    { max: 1000, rate: 2.1, fee: 25, chainFrom: 6 },
    { max: null, rate: 2.58, fee: 40, chainFrom: 7 },
  ],
};

export function parseTariff(value: unknown): Tariff | null {
  if (!value || typeof value !== "object") return null;
  const tiers = (value as { tiers?: unknown }).tiers;
  if (!Array.isArray(tiers) || !tiers.length) return null;
  return value as Tariff;
}

/** 1-based tier for a month's consumption. */
export function tierFor(tariff: Tariff, kwh: number): number {
  const index = tariff.tiers.findIndex((tier) => tier.max == null || kwh <= tier.max);
  return (index < 0 ? tariff.tiers.length - 1 : index) + 1;
}

export type Bill = {
  tier: number;
  energy: number;
  fee: number;
  total: number;
  bands: { tier: number; kwh: number; rate: number; cost: number }[];
};

export function billFor(tariff: Tariff, kwh: number): Bill {
  const used = Math.max(0, kwh);
  const tier = tierFor(tariff, used);
  const current = tariff.tiers[tier - 1]!;
  const bands: Bill["bands"] = [];
  let floor = 0;
  for (let n = current.chainFrom; n <= tier; n++) {
    const band = tariff.tiers[n - 1]!;
    const top = n === tier || band.max == null ? used : Math.min(used, band.max);
    const amount = Math.max(0, top - floor);
    bands.push({ tier: n, kwh: amount, rate: band.rate, cost: amount * band.rate });
    floor = band.max ?? floor;
  }
  const energy = bands.reduce((sum, band) => sum + band.cost, 0);
  return { tier, energy, fee: current.fee, total: energy + current.fee, bands };
}

/** kWh left before the month's consumption moves into the next tier. */
export function untilNextTier(tariff: Tariff, kwh: number): { next: number; kwh: number } | null {
  const tier = tierFor(tariff, kwh);
  const max = tariff.tiers[tier - 1]!.max;
  if (max == null) return null;
  return { next: tier + 1, kwh: Math.max(0, max - kwh) };
}

export function tierRangeLabel(tariff: Tariff, tier: number, unit = "kWh"): string {
  const min = tier === 1 ? 0 : (tariff.tiers[tier - 2]!.max ?? 0) + 1;
  const max = tariff.tiers[tier - 1]!.max;
  return max == null ? `over ${min - 1} ${unit}` : `${min}–${max} ${unit}`;
}
