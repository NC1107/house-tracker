/**
 * "Cost of waiting" — quantifies what delaying a purchase does to monthly payment, cash
 * needed, and lifetime interest if prices and/or rates move. Pure and unit-tested. This is
 * the tool that turns "let's just wait" into concrete dollars.
 */
import { computePiti, monthlyPrincipalAndInterest, GUIDELINES, DEFAULTS } from "@/lib/affordability";

export interface CostOfWaitingInputs {
  homePrice: number;
  downPct: number; // fraction, e.g. 0.2
  currentRate: number; // annual %
  annualPriceChangePct: number; // fraction, e.g. 0.04
  rateChangePts: number; // percentage points added to rate over the wait
  waitMonths: number;
  termMonths?: number;
  propertyTaxRate?: number;
  insuranceRate?: number;
}

export interface CostOfWaitingResult {
  nowPrice: number;
  laterPrice: number;
  nowPayment: number;
  laterPayment: number;
  monthlyDelta: number;
  nowDownPayment: number;
  laterDownPayment: number;
  downPaymentDelta: number;
  lifetimeInterestDelta: number;
  /** true when waiting makes buying more expensive overall. */
  waitingCostsMore: boolean;
}

export function costOfWaiting(inputs: CostOfWaitingInputs): CostOfWaitingResult {
  const {
    homePrice,
    downPct,
    currentRate,
    annualPriceChangePct,
    rateChangePts,
    waitMonths,
    termMonths = DEFAULTS.termMonths,
    propertyTaxRate = DEFAULTS.propertyTaxRate,
    insuranceRate = DEFAULTS.insuranceRate,
  } = inputs;

  const laterPrice = homePrice * Math.pow(1 + annualPriceChangePct, waitMonths / 12);
  const laterRate = Math.max(0.01, currentRate + rateChangePts);

  const g = GUIDELINES.qm;
  const pitiNow = computePiti({ homePrice, downPayment: homePrice * downPct, annualRatePct: currentRate, termMonths, propertyTaxRate, insuranceRate, guideline: g });
  const pitiLater = computePiti({ homePrice: laterPrice, downPayment: laterPrice * downPct, annualRatePct: laterRate, termMonths, propertyTaxRate, insuranceRate, guideline: g });

  const loanNow = homePrice * (1 - downPct);
  const loanLater = laterPrice * (1 - downPct);
  const interestNow = monthlyPrincipalAndInterest(loanNow, currentRate, termMonths) * termMonths - loanNow;
  const interestLater = monthlyPrincipalAndInterest(loanLater, laterRate, termMonths) * termMonths - loanLater;

  return {
    nowPrice: homePrice,
    laterPrice: Math.round(laterPrice),
    nowPayment: Math.round(pitiNow.total),
    laterPayment: Math.round(pitiLater.total),
    monthlyDelta: Math.round(pitiLater.total - pitiNow.total),
    nowDownPayment: Math.round(homePrice * downPct),
    laterDownPayment: Math.round(laterPrice * downPct),
    downPaymentDelta: Math.round((laterPrice - homePrice) * downPct),
    lifetimeInterestDelta: Math.round(interestLater - interestNow),
    waitingCostsMore: pitiLater.total > pitiNow.total,
  };
}
