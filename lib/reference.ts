/**
 * National reference figures for the "average American household" view. These are dated
 * public benchmarks used to make the dashboard informative before any region-specific
 * ingestion runs; live DB values override them where available.
 */
import {
  maxAffordablePrice,
  computePiti,
  requiredIncomeForPrice,
  cashToClose,
  GUIDELINES,
  type DownPaymentMode,
  type CashToClose,
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
  /** Price the median household can COMFORTABLY afford (28/36 rule, ≤28% of income on housing). */
  comfortableMaxPrice: number;
  /** Price a lender may stretch to (43% back-end DTI) — the maximum, not comfortable. */
  lenderMaxPrice: number;
  /** Monthly PITI on the median-priced home at typical down + this rate. */
  medianHomePayment: number;
  /** That payment as a share of median gross monthly income (housing burden; >0.3 is burdened). */
  housingBurden: number;
  /** Income required to comfortably (28/36) buy the median-priced home. */
  incomeForMedianHome: number;
  /** Total upfront cash (down + closing + reserves) for the median home at typical down. */
  cashToClose: CashToClose;
  /** 20% down payment on the median home, and years to save it. */
  downPayment20: number;
  yearsToSaveDownPayment: number;
  /** FHA minimum down (3.5%) on the median home, and years to save it — the low-down path. */
  fhaDownPayment: number;
  fhaYearsToSave: number;
  /** True if the median household can comfortably afford the median-priced home. */
  medianCanAfford: boolean;
}

export function buyerSnapshot(rate: number): BuyerSnapshot {
  const income = NATIONAL.medianHouseholdIncome;
  const price = NATIONAL.medianHomePrice;
  const down: DownPaymentMode = { kind: "percent", percent: NATIONAL.typicalDownPaymentPct };

  // "Comfortable" uses the conservative 28/36 rule; "lender max" uses the 43% back-end.
  const comfortable = maxAffordablePrice({
    grossAnnualIncome: income,
    monthlyDebts: 0,
    downPayment: down,
    annualRatePct: rate,
    guideline: GUIDELINES.conventional_classic,
  });
  const lenderMax = maxAffordablePrice({
    grossAnnualIncome: income,
    monthlyDebts: 0,
    downPayment: down,
    annualRatePct: rate,
    guideline: GUIDELINES.qm,
  });

  const piti = computePiti({
    homePrice: price,
    downPayment: price * NATIONAL.typicalDownPaymentPct,
    annualRatePct: rate,
    guideline: GUIDELINES.conventional_classic,
  });

  const req = requiredIncomeForPrice({
    homePrice: price,
    downPayment: down,
    monthlyDebts: 0,
    annualRatePct: rate,
    guideline: GUIDELINES.conventional_classic,
  });

  const housingBurden = piti.total / (income / 12);
  const downPayment20 = price * 0.2;
  const fhaDownPayment = price * 0.035;
  const annualSavings = income * NATIONAL.savingsRateOfGross;

  return {
    rate,
    medianIncome: income,
    medianHomePrice: price,
    priceToIncome: price / income,
    comfortableMaxPrice: comfortable.maxHomePrice,
    lenderMaxPrice: lenderMax.maxHomePrice,
    medianHomePayment: piti.total,
    housingBurden,
    incomeForMedianHome: req.requiredAnnualIncome,
    cashToClose: cashToClose({
      homePrice: price,
      downPayment: price * NATIONAL.typicalDownPaymentPct,
      monthlyPiti: piti.total,
    }),
    downPayment20,
    yearsToSaveDownPayment: annualSavings > 0 ? downPayment20 / annualSavings : 0,
    fhaDownPayment,
    fhaYearsToSave: annualSavings > 0 ? fhaDownPayment / annualSavings : 0,
    medianCanAfford: comfortable.maxHomePrice >= price,
  };
}
