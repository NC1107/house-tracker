/**
 * Market-heat / deal-signal scoring: turn a region's latest market metrics into a single
 * 0-100 "buyer leverage" score (100 = strongly favors buyers). Each signal is normalized to
 * 0-100 against thresholds grounded in how the housing market is normally read (e.g. ~6
 * months of supply is balanced), then combined as a weighted average over whatever signals
 * are available (weights renormalize when some are missing).
 *
 * Pure and unit-tested (lib/marketheat.test.ts).
 */

export interface MarketInputs {
  /** Months of supply (inventory / sales pace). ~6 is balanced. */
  monthsOfSupply?: number;
  /** Median days on market. Higher = buyers have more leverage. */
  daysOnMarket?: number;
  /** Share of active listings with a price drop (fraction 0..1). */
  priceDropsShare?: number;
  /** Sale-to-list price ratio (~1.0). Below 1 favors buyers. */
  saleToList?: number;
  /** Year-over-year inventory change (fraction). Rising inventory favors buyers. */
  inventoryTrendYoY?: number;
}

export interface Signal {
  key: keyof MarketInputs;
  label: string;
  value: number;
  score: number; // 0..100, buyer-favorable
  weight: number;
}

export interface MarketHeatResult {
  /** 0..100 buyer leverage, or null if no signals were provided. */
  score: number | null;
  label: string;
  components: Signal[];
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

/** Linear map of `v` from [a,b] onto [0,100], clamped. b may be < a to invert direction. */
function lin(v: number, a: number, b: number): number {
  if (a === b) return 50;
  return clamp(((v - a) / (b - a)) * 100);
}

interface SignalDef {
  key: keyof MarketInputs;
  label: string;
  weight: number;
  score: (v: number) => number;
}

const SIGNALS: SignalDef[] = [
  // 3 mo -> seller (0), 9 mo -> buyer (100), 6 mo balanced (50)
  { key: "monthsOfSupply", label: "Months of supply", weight: 0.3, score: (v) => lin(v, 3, 9) },
  // 15 days -> hot/seller, 90 days -> buyer
  { key: "daysOnMarket", label: "Days on market", weight: 0.25, score: (v) => lin(v, 15, 90) },
  // 10% of listings cut -> low, 40% -> high buyer leverage
  { key: "priceDropsShare", label: "Listings with price cuts", weight: 0.2, score: (v) => lin(v, 0.1, 0.4) },
  // 1.02 (over ask) -> seller, 0.95 (under ask) -> buyer  (inverted range)
  { key: "saleToList", label: "Sale-to-list ratio", weight: 0.15, score: (v) => lin(v, 1.02, 0.95) },
  // -20% YoY inventory -> seller, +20% -> buyer
  { key: "inventoryTrendYoY", label: "Inventory trend (YoY)", weight: 0.1, score: (v) => lin(v, -0.2, 0.2) },
];

export function labelFor(score: number): string {
  if (score >= 75) return "Strong buyer's market";
  if (score >= 58) return "Buyer-leaning";
  if (score > 42) return "Balanced";
  if (score > 25) return "Seller-leaning";
  return "Strong seller's market";
}

export function marketHeat(inputs: MarketInputs): MarketHeatResult {
  const present = SIGNALS.filter((s) => {
    const v = inputs[s.key];
    return v !== undefined && v !== null && Number.isFinite(v);
  });

  if (present.length === 0) {
    return { score: null, label: "No market data", components: [] };
  }

  const totalWeight = present.reduce((sum, s) => sum + s.weight, 0);
  const components: Signal[] = present.map((s) => {
    const value = inputs[s.key] as number;
    return {
      key: s.key,
      label: s.label,
      value,
      score: Math.round(s.score(value)),
      weight: s.weight / totalWeight,
    };
  });

  const score = Math.round(
    components.reduce((sum, c) => sum + c.score * c.weight, 0),
  );

  return { score, label: labelFor(score), components };
}
