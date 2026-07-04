/**
 * Derived time-series for buyer-facing trend charts. Pure functions over already-ingested
 * national series (FRED median sale price + rate + income). Unit-tested in trends.test.ts.
 */
import { computePiti, GUIDELINES } from "@/lib/affordability";
import type { SeriesPoint } from "@/lib/types";

/** Latest source value dated on or before `date` (both series assumed ascending by date). */
export function asOf(date: string, source: SeriesPoint[]): number | null {
  let val: number | null = null;
  for (const p of source) {
    if (p.date <= date) val = p.value;
    else break;
  }
  return val;
}

/**
 * Monthly payment (PITI) to buy the typical home over time = median price at each date
 * financed at the mortgage rate prevailing then. This is the "true cost" trend that shows
 * how the rate shock reshaped affordability even when prices moved little.
 */
export function paymentToBuySeries(
  prices: SeriesPoint[],
  rates: SeriesPoint[],
  opts: { downPct?: number; propertyTaxRate?: number; insuranceRate?: number } = {},
): SeriesPoint[] {
  const { downPct = 0.15, propertyTaxRate = 0.011, insuranceRate = 0.005 } = opts;
  const out: SeriesPoint[] = [];
  for (const p of prices) {
    const rate = asOf(p.date, rates);
    if (rate === null) continue;
    const piti = computePiti({
      homePrice: p.value,
      downPayment: p.value * downPct,
      annualRatePct: rate,
      propertyTaxRate,
      insuranceRate,
      guideline: GUIDELINES.qm,
    });
    out.push({ date: p.date, value: Math.round(piti.total) });
  }
  return out;
}

/**
 * Home-price-to-income ratio over time — the classic valuation gauge (~3-4x historically
 * "normal", 6x+ stretched). Income is annual, so each price point uses the latest income.
 */
export function priceToIncomeSeries(prices: SeriesPoint[], incomes: SeriesPoint[]): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  for (const p of prices) {
    const income = asOf(p.date, incomes);
    if (income === null || income === 0) continue;
    out.push({ date: p.date, value: +(p.value / income).toFixed(2) });
  }
  return out;
}

/** Spread between the 30-yr mortgage rate and the 10-yr Treasury (why rates move). */
export function rateSpreadSeries(mortgage: SeriesPoint[], treasury: SeriesPoint[]): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  for (const m of mortgage) {
    const t = asOf(m.date, treasury);
    if (t === null) continue;
    out.push({ date: m.date, value: +(m.value - t).toFixed(2) });
  }
  return out;
}
