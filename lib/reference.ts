/**
 * National reference figures for the "average American household" view. These are dated
 * public benchmarks used to make the dashboard informative before any region-specific
 * ingestion runs; live DB values override them where available.
 */
import {
  maxAffordablePrice,
  computePiti,
  requiredIncomeForPrice,
  GUIDELINES,
  type DownPaymentMode,
} from "@/lib/affordability";

export const NATIONAL = {
  medianHouseholdIncome: 80_610, // US Census ACS 2023
  medianHomePrice: 415_000, // approx US existing-home median (NAR, 2025)
  medianAskingRent: 1_650, // approx US median asking rent
  typicalDownPaymentPct: 0.15, // approx median down payment across buyers
  savingsRateOfGross: 0.1, // assumption: saves 10% of gross income/yr toward a home
  sources: "Income: Census ACS 2023. Home price/rent: NAR / national estimates (approx).",
} as const;

export interface BuyerSnapshot {
  rate: number;
  medianIncome: number;
  medianHomePrice: number;
  /** Home-price-to-income ratio (a classic affordability gauge; ~3 is healthy, >5 strained). */
  priceToIncome: number;
  /** Max price the median household qualifies for (QM, typical down). */
  medianMaxPrice: number;
  /** Monthly PITI on the median-priced home at typical down + this rate. */
  medianHomePayment: number;
  /** That payment as a share of median gross monthly income (housing burden; >0.3 is burdened). */
  housingBurden: number;
  /** Income required to comfortably buy the median-priced home. */
  incomeForMedianHome: number;
  /** 20% down payment on the median home, and years to save it at the assumed rate. */
  downPayment20: number;
  yearsToSaveDownPayment: number;
  /** True if the median household can afford the median-priced home. */
  medianCanAfford: boolean;
}

export function buyerSnapshot(rate: number): BuyerSnapshot {
  const income = NATIONAL.medianHouseholdIncome;
  const price = NATIONAL.medianHomePrice;
  const down: DownPaymentMode = { kind: "percent", percent: NATIONAL.typicalDownPaymentPct };
  const guideline = GUIDELINES.qm;

  const aff = maxAffordablePrice({
    grossAnnualIncome: income,
    monthlyDebts: 0,
    downPayment: down,
    annualRatePct: rate,
    guideline,
  });

  const piti = computePiti({
    homePrice: price,
    downPayment: price * NATIONAL.typicalDownPaymentPct,
    annualRatePct: rate,
    guideline,
  });

  const req = requiredIncomeForPrice({
    homePrice: price,
    downPayment: down,
    monthlyDebts: 0,
    annualRatePct: rate,
    guideline,
  });

  const housingBurden = piti.total / (income / 12);
  const downPayment20 = price * 0.2;
  const annualSavings = income * NATIONAL.savingsRateOfGross;

  return {
    rate,
    medianIncome: income,
    medianHomePrice: price,
    priceToIncome: price / income,
    medianMaxPrice: aff.maxHomePrice,
    medianHomePayment: piti.total,
    housingBurden,
    incomeForMedianHome: req.requiredAnnualIncome,
    downPayment20,
    yearsToSaveDownPayment: annualSavings > 0 ? downPayment20 / annualSavings : 0,
    medianCanAfford: aff.maxHomePrice >= price,
  };
}
