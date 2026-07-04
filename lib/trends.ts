/**
 * Derived time-series for buyer-facing trend charts. Pure functions over already-ingested
 * national series (FRED median sale price + rate + income). Unit-tested in trends.test.ts.
 */
import { computePiti, maxAffordablePrice, GUIDELINES } from "@/lib/affordability";
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

/**
 * Housing-cost burden over time = monthly payment on the median home ÷ median monthly
 * income, as a percent. The classic "is a normal household stretched?" gauge — lower is
 * better for buyers (>30% is considered cost-burdened).
 */
export function housingBurdenSeries(prices: SeriesPoint[], rates: SeriesPoint[], incomes: SeriesPoint[]): SeriesPoint[] {
  const payments = paymentToBuySeries(prices, rates);
  const out: SeriesPoint[] = [];
  for (const p of payments) {
    const income = asOf(p.date, incomes);
    if (income === null || income === 0) continue;
    out.push({ date: p.date, value: +((p.value / (income / 12)) * 100).toFixed(1) });
  }
  return out;
}

/**
 * Buying power over time = the max home price the median household qualifies for at each
 * date's mortgage rate. Higher is better for buyers — it shows how the rate shock shrank
 * how much house the same income can buy.
 */
export function buyingPowerSeries(rates: SeriesPoint[], incomes: SeriesPoint[], downPct = 0.15): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  // Downsample to one point per month to keep the solve light.
  let lastMonth = "";
  for (const r of rates) {
    const ym = r.date.slice(0, 7);
    if (ym === lastMonth) continue;
    lastMonth = ym;
    const income = asOf(r.date, incomes);
    if (income === null) continue;
    const aff = maxAffordablePrice({
      grossAnnualIncome: income,
      monthlyDebts: 0,
      downPayment: { kind: "percent", percent: downPct },
      annualRatePct: r.value,
      guideline: GUIDELINES.qm,
    });
    out.push({ date: r.date, value: Math.round(aff.maxHomePrice) });
  }
  return out;
}

/**
 * Year-over-year percent change of a monthly series (each point vs. ~12 months earlier).
 * For home values, lower/negative is better for buyers (a cooling or falling market).
 */
export function yoyChangeSeries(series: SeriesPoint[]): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  for (let i = 12; i < series.length; i++) {
    const prev = series[i - 12].value;
    if (!prev) continue;
    out.push({ date: series[i].date, value: +(((series[i].value - prev) / prev) * 100).toFixed(1) });
  }
  return out;
}

/**
 * Inflation-adjusted ("real") index: deflate a nominal series by CPI and rebase to 100 at
 * the first point, so the line shows appreciation *above inflation* — flat means prices
 * merely kept pace with the cost of living.
 */
export function realIndexSeries(nominal: SeriesPoint[], cpi: SeriesPoint[]): SeriesPoint[] {
  const deflated: SeriesPoint[] = [];
  for (const n of nominal) {
    const c = asOf(n.date, cpi);
    if (c === null || c === 0) continue;
    deflated.push({ date: n.date, value: n.value / c });
  }
  if (deflated.length === 0) return [];
  const base = deflated[0].value;
  return deflated.map((d) => ({ date: d.date, value: +((d.value / base) * 100).toFixed(1) }));
}
