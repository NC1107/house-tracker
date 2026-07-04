/**
 * Rent-vs-buy analysis using the net-worth method (the approach the NYT calculator uses):
 * simulate month by month and compare the buyer's and renter's net worth if each liquidated
 * at that point. Buying "wins" from the first month the buyer's net worth overtakes the
 * renter's — that month is the breakeven horizon.
 *
 * Key ideas modeled:
 *  - Buyer's upfront cash (down payment + closing costs) is money the renter instead invests.
 *  - Each month, whoever has the lower housing outflow invests the difference at the assumed
 *    investment return (opportunity cost of cash).
 *  - Buyer builds equity via amortization + home appreciation; pays selling costs on exit.
 *  - PMI is charged while the loan balance exceeds 80% of the original price, then drops.
 *
 * Pure and unit-tested (lib/rentvsbuy.test.ts). Estimates for planning, not advice.
 */
import { monthlyPrincipalAndInterest, DEFAULTS } from "@/lib/affordability";

export interface RentVsBuyInputs {
  homePrice: number;
  downPayment: number; // dollars
  annualRatePct: number;
  termMonths?: number;

  propertyTaxRate?: number; // annual, fraction of current home value
  insuranceRate?: number; // annual, fraction of current home value
  maintenanceRate?: number; // annual, fraction of current home value
  monthlyHoa?: number;
  pmiRate?: number; // annual, fraction of original loan

  buyClosingPct?: number; // fraction of price, paid upfront by buyer
  sellClosingPct?: number; // fraction of sale price, paid on exit

  monthlyRent: number;
  annualRentGrowth?: number; // e.g. 0.03
  annualHomeAppreciation?: number; // e.g. 0.03
  annualInvestmentReturn?: number; // opportunity cost, e.g. 0.05

  horizonYears: number;
}

export interface RentVsBuyPoint {
  month: number;
  buyerNetWorth: number;
  renterNetWorth: number;
  homeValue: number;
  loanBalance: number;
}

export interface RentVsBuyResult {
  breakevenMonth: number | null; // first month buying >= renting; null if never within horizon
  series: RentVsBuyPoint[];
  /** Net worth at the horizon. */
  finalBuyerNetWorth: number;
  finalRenterNetWorth: number;
  recommendation: "buy" | "rent" | "close";
}

const DEF = {
  maintenanceRate: 0.01,
  buyClosingPct: 0.02,
  sellClosingPct: 0.07,
  annualRentGrowth: 0.03,
  annualHomeAppreciation: 0.03,
  annualInvestmentReturn: 0.05,
};

const monthlyRate = (annual: number) => Math.pow(1 + annual, 1 / 12) - 1;

export function rentVsBuy(inputs: RentVsBuyInputs): RentVsBuyResult {
  const {
    homePrice,
    downPayment,
    annualRatePct,
    termMonths = DEFAULTS.termMonths,
    propertyTaxRate = DEFAULTS.propertyTaxRate,
    insuranceRate = DEFAULTS.insuranceRate,
    maintenanceRate = DEF.maintenanceRate,
    monthlyHoa = 0,
    pmiRate = DEFAULTS.pmiRate,
    buyClosingPct = DEF.buyClosingPct,
    sellClosingPct = DEF.sellClosingPct,
    monthlyRent,
    annualRentGrowth = DEF.annualRentGrowth,
    annualHomeAppreciation = DEF.annualHomeAppreciation,
    annualInvestmentReturn = DEF.annualInvestmentReturn,
    horizonYears,
  } = inputs;

  const loan = Math.max(0, homePrice - downPayment);
  const pi = monthlyPrincipalAndInterest(loan, annualRatePct, termMonths);
  const rMonth = annualRatePct / 100 / 12;

  const apprM = monthlyRate(annualHomeAppreciation);
  const rentGM = monthlyRate(annualRentGrowth);
  const invM = monthlyRate(annualInvestmentReturn);

  const buyClosing = homePrice * buyClosingPct;

  let balance = loan;
  let homeValue = homePrice;
  let rent = monthlyRent;
  // Renter starts by investing the cash the buyer sank into the purchase.
  let renterPortfolio = downPayment + buyClosing;
  let buyerSide = 0;

  const horizonMonths = Math.round(horizonYears * 12);
  const series: RentVsBuyPoint[] = [];
  let breakevenMonth: number | null = null;

  for (let m = 1; m <= horizonMonths; m++) {
    // Amortization step
    const interest = balance * rMonth;
    const principal = Math.min(Math.max(pi - interest, 0), balance);
    balance -= principal;

    // Monthly carrying costs (based on current home value)
    const tax = (homeValue * propertyTaxRate) / 12;
    const insurance = (homeValue * insuranceRate) / 12;
    const maintenance = (homeValue * maintenanceRate) / 12;
    const pmi = balance / homePrice > 0.8 ? (loan * pmiRate) / 12 : 0;
    const buyerOutflow = pi + tax + insurance + maintenance + monthlyHoa + pmi;
    const renterOutflow = rent;

    // Whoever pays less invests the difference.
    const diff = buyerOutflow - renterOutflow;
    if (diff > 0) renterPortfolio += diff;
    else buyerSide += -diff;

    // Grow investments, home value, and rent.
    renterPortfolio *= 1 + invM;
    buyerSide *= 1 + invM;
    homeValue *= 1 + apprM;
    rent *= 1 + rentGM;

    // Net worth if each liquidated now.
    const buyerNetWorth = homeValue * (1 - sellClosingPct) - balance + buyerSide;
    const renterNetWorth = renterPortfolio;

    if (breakevenMonth === null && buyerNetWorth >= renterNetWorth) {
      breakevenMonth = m;
    }
    series.push({ month: m, buyerNetWorth, renterNetWorth, homeValue, loanBalance: balance });
  }

  const last = series[series.length - 1];
  const gap = last ? last.buyerNetWorth - last.renterNetWorth : 0;
  const scale = Math.max(1, homePrice);
  const recommendation =
    Math.abs(gap) / scale < 0.02 ? "close" : gap > 0 ? "buy" : "rent";

  return {
    breakevenMonth,
    series,
    finalBuyerNetWorth: last?.buyerNetWorth ?? 0,
    finalRenterNetWorth: last?.renterNetWorth ?? 0,
    recommendation,
  };
}
