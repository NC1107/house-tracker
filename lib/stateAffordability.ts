/**
 * Per-state affordability for the median US household. Pure + unit-tested. Combines each
 * state's typical home value (Zillow ZHVI) with the national median income and the current
 * mortgage rate to answer "where can a normal household actually afford to buy?"
 */
import { requiredIncomeForPrice, GUIDELINES } from "@/lib/affordability";

export interface StateAffordability {
  homeValue: number;
  /** Home value ÷ national median income (valuation gauge; lower is more affordable). */
  priceToIncome: number;
  /** Income needed to comfortably buy this state's typical home. */
  requiredIncome: number;
  /** Monthly PITI on the typical home at 15% down. */
  monthlyPayment: number;
  /** True if the national-median household qualifies for the typical home here. */
  affordable: boolean;
}

export function computeStateAffordability(
  homeValue: number,
  nationalIncome: number,
  rate: number,
): StateAffordability {
  const req = requiredIncomeForPrice({
    homePrice: homeValue,
    downPayment: { kind: "percent", percent: 0.15 },
    monthlyDebts: 0,
    annualRatePct: rate,
    guideline: GUIDELINES.qm,
  });
  return {
    homeValue,
    priceToIncome: +(homeValue / nationalIncome).toFixed(1),
    requiredIncome: Math.round(req.requiredAnnualIncome),
    monthlyPayment: Math.round(req.piti.total),
    affordable: req.requiredAnnualIncome <= nationalIncome,
  };
}

/** 5-band color scale keyed to price-to-income (green = affordable → red = stretched). */
export function affordabilityColor(priceToIncome: number): string {
  if (priceToIncome <= 3) return "#16a34a";
  if (priceToIncome <= 4) return "#84cc16";
  if (priceToIncome <= 5) return "#eab308";
  if (priceToIncome <= 7) return "#f97316";
  return "#dc2626";
}

export const AFFORDABILITY_LEGEND = [
  { label: "≤3× income", color: "#16a34a" },
  { label: "3–4×", color: "#84cc16" },
  { label: "4–5×", color: "#eab308" },
  { label: "5–7×", color: "#f97316" },
  { label: ">7×", color: "#dc2626" },
];
