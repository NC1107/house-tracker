/**
 * Bank-grade mortgage & affordability math.
 *
 * This module is intentionally pure (no I/O, no framework, no data-source coupling)
 * so its correctness can be unit-tested against known vectors and authoritative
 * calculators. See lib/affordability.test.ts for the validation suite.
 *
 * Sources the formulas and underwriting thresholds are drawn from:
 *  - Standard mortgage amortization (annuity) formula.
 *  - Fannie Mae Selling Guide, B3-6: DTI / LTV and eligibility (Conventional).
 *  - CFPB Ability-to-Repay / Qualified Mortgage rule, 12 CFR 1026.43 (43% DTI backstop).
 *  - FHA Single Family Housing Policy Handbook 4000.1 (31/43 ratios, 3.5% min down, MIP).
 *  - Homeowners Protection Act of 1998 (PMI: borrower-requested cancel at 80% LTV,
 *    automatic termination at 78% LTV of original value).
 *  - FHFA annual conforming loan limits (jumbo threshold).
 *
 * IMPORTANT: results are planning estimates, not a lending decision. Actual approval
 * depends on credit, reserves, AUS findings, and lender overlays not modeled here.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 2025 FHFA baseline conforming loan limit for a 1-unit property (continental US). */
export const CONFORMING_LOAN_LIMIT_1UNIT_2025 = 806_500;

/**
 * Current baseline conforming loan limit (1-unit, continental US). FHFA updates this every
 * November; 2026 baseline ≈ $832,750. Wire to a live FHFA source when available.
 */
export const CONFORMING_LOAN_LIMIT_1UNIT = 832_750;

/** Reasonable planning defaults (all user-overridable). */
export const DEFAULTS = {
  termMonths: 360,
  /** Effective property-tax rate (annual, as fraction of home value). US median ~1.1%. */
  propertyTaxRate: 0.011,
  /** Homeowners insurance (annual, as fraction of home value) when not given a dollar amount. */
  insuranceRate: 0.005,
  /** Conventional PMI (annual, as fraction of loan). Typical 0.3%–1.5%; ~0.5% mid. */
  pmiRate: 0.005,
  /** FHA annual MIP (most 30-yr, LTV > 95%). */
  fhaAnnualMipRate: 0.0055,
  /** FHA upfront MIP, financed into the loan. */
  fhaUpfrontMipRate: 0.0175,
} as const;

export type MortgageInsuranceKind = "pmi" | "mip" | "none";

export interface Guideline {
  key: string;
  label: string;
  /** Front-end (housing) DTI ceiling, or null to not constrain on front-end. */
  frontEndLimit: number | null;
  /** Back-end (total debt) DTI ceiling. */
  backEndLimit: number;
  /** Minimum down payment as a fraction of price. */
  minDownPct: number;
  mortgageInsurance: MortgageInsuranceKind;
  source: string;
}

/**
 * Selectable underwriting guideline sets. These encode the ratios lenders actually use.
 * "Conventional (classic 28/36)" is the conservative rule of thumb; "Conventional (max)"
 * reflects the higher DTIs Fannie/Freddie AUS will accept with compensating factors.
 */
export const GUIDELINES: Record<string, Guideline> = {
  conventional_classic: {
    key: "conventional_classic",
    label: "Conventional (classic 28/36)",
    frontEndLimit: 0.28,
    backEndLimit: 0.36,
    minDownPct: 0.03,
    mortgageInsurance: "pmi",
    source: "Fannie Mae Selling Guide (conservative rule of thumb)",
  },
  conventional_max: {
    key: "conventional_max",
    label: "Conventional max (AUS w/ compensating factors)",
    frontEndLimit: null,
    backEndLimit: 0.5,
    minDownPct: 0.03,
    mortgageInsurance: "pmi",
    source: "Fannie Mae DU / Freddie Mac LPA typical ceiling ~50%",
  },
  qm: {
    key: "qm",
    label: "43% DTI (max-qualifying rule of thumb)",
    frontEndLimit: null,
    backEndLimit: 0.43,
    minDownPct: 0.03,
    mortgageInsurance: "pmi",
    // 43% back-end was the old General QM hard cap (12 CFR 1026.43); the 2021 QM rule
    // replaced it with a price-based (APR-vs-APOR) test. 43% now survives as a rule of thumb
    // for the maximum many lenders will stretch to — not a "comfortable" payment.
    source: "43% back-end DTI, lender max rule of thumb (not the current CFPB QM test)",
  },
  fha: {
    key: "fha",
    label: "FHA (31/43)",
    frontEndLimit: 0.31,
    backEndLimit: 0.43,
    minDownPct: 0.035,
    mortgageInsurance: "mip",
    source: "FHA Handbook 4000.1",
  },
};

// ---------------------------------------------------------------------------
// Core amortization
// ---------------------------------------------------------------------------

/**
 * Fixed-rate monthly principal & interest payment (annuity formula).
 *   M = P * r(1+r)^n / ((1+r)^n - 1),  r = annualRatePct/100/12,  n = termMonths
 * Returns 0 for a non-positive principal. Handles the r = 0 edge case.
 */
export function monthlyPrincipalAndInterest(
  principal: number,
  annualRatePct: number,
  termMonths: number,
): number {
  if (principal <= 0 || termMonths <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / termMonths;
  const factor = Math.pow(1 + r, termMonths);
  return (principal * r * factor) / (factor - 1);
}

/**
 * Remaining loan balance after `monthsElapsed` payments on a fully-amortizing loan.
 *   B(m) = P * ((1+r)^n - (1+r)^m) / ((1+r)^n - 1)
 */
export function remainingBalance(
  principal: number,
  annualRatePct: number,
  termMonths: number,
  monthsElapsed: number,
): number {
  if (principal <= 0 || termMonths <= 0) return 0;
  if (monthsElapsed <= 0) return principal;
  if (monthsElapsed >= termMonths) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal * (1 - monthsElapsed / termMonths);
  const powN = Math.pow(1 + r, termMonths);
  const powM = Math.pow(1 + r, monthsElapsed);
  return (principal * (powN - powM)) / (powN - 1);
}

/**
 * Number of scheduled months until conventional PMI automatically terminates.
 * Per the Homeowners Protection Act, PMI ends automatically when the scheduled
 * balance reaches 78% of the *original* home value. Returns 0 if PMI never applied
 * (down payment >= 20%).
 */
export function pmiMonths(
  homePrice: number,
  loanAmount: number,
  annualRatePct: number,
  termMonths: number,
): number {
  if (homePrice <= 0 || loanAmount <= 0) return 0;
  if (loanAmount / homePrice <= 0.8) return 0; // started with >= 20% equity
  const target = 0.78 * homePrice;
  for (let m = 1; m <= termMonths; m++) {
    if (remainingBalance(loanAmount, annualRatePct, termMonths, m) <= target) {
      return m;
    }
  }
  return termMonths;
}

// ---------------------------------------------------------------------------
// PITI breakdown
// ---------------------------------------------------------------------------

export interface PitiInputs {
  homePrice: number;
  downPayment: number; // dollars
  annualRatePct: number;
  termMonths?: number;
  /** Annual property-tax rate as fraction of price (e.g. 0.011). */
  propertyTaxRate?: number;
  /** Annual homeowners-insurance cost in dollars; if omitted, derived from insuranceRate. */
  annualInsurance?: number;
  insuranceRate?: number;
  monthlyHoa?: number;
  guideline?: Guideline;
  /** Override conventional PMI annual rate (fraction of loan). */
  pmiRate?: number;
}

export interface PitiBreakdown {
  loanAmount: number;
  ltv: number;
  principalAndInterest: number;
  propertyTax: number;
  insurance: number;
  mortgageInsurance: number;
  hoa: number;
  /** Full monthly housing payment (PITI + MI + HOA). */
  total: number;
  /** Upfront MIP financed into the loan (FHA only), else 0. */
  financedUpfrontMip: number;
}

/**
 * Compute the true monthly housing cost (PITI + mortgage insurance + HOA).
 * For FHA, upfront MIP is financed into the loan and annual MIP is added monthly.
 * For conventional with LTV > 80%, PMI is added monthly.
 */
export function computePiti(inputs: PitiInputs): PitiBreakdown {
  const {
    homePrice,
    downPayment,
    annualRatePct,
    termMonths = DEFAULTS.termMonths,
    propertyTaxRate = DEFAULTS.propertyTaxRate,
    annualInsurance,
    insuranceRate = DEFAULTS.insuranceRate,
    monthlyHoa = 0,
    guideline = GUIDELINES.conventional_classic,
    pmiRate = DEFAULTS.pmiRate,
  } = inputs;

  const baseLoan = Math.max(0, homePrice - downPayment);
  const ltv = homePrice > 0 ? baseLoan / homePrice : 0;

  // FHA finances upfront MIP into the loan balance.
  let financedUpfrontMip = 0;
  let loanAmount = baseLoan;
  if (guideline.mortgageInsurance === "mip") {
    financedUpfrontMip = baseLoan * DEFAULTS.fhaUpfrontMipRate;
    loanAmount = baseLoan + financedUpfrontMip;
  }

  const principalAndInterest = monthlyPrincipalAndInterest(
    loanAmount,
    annualRatePct,
    termMonths,
  );

  const propertyTax = (homePrice * propertyTaxRate) / 12;
  const insurance =
    (annualInsurance ?? homePrice * insuranceRate) / 12;

  let mortgageInsurance = 0;
  if (guideline.mortgageInsurance === "pmi" && ltv > 0.8) {
    mortgageInsurance = (baseLoan * pmiRate) / 12;
  } else if (guideline.mortgageInsurance === "mip") {
    // FHA annual MIP is charged on the (financed) loan balance.
    mortgageInsurance = (loanAmount * DEFAULTS.fhaAnnualMipRate) / 12;
  }

  const total =
    principalAndInterest + propertyTax + insurance + mortgageInsurance + monthlyHoa;

  return {
    loanAmount,
    ltv,
    principalAndInterest,
    propertyTax,
    insurance,
    mortgageInsurance,
    hoa: monthlyHoa,
    total,
    financedUpfrontMip,
  };
}

// ---------------------------------------------------------------------------
// DTI qualification
// ---------------------------------------------------------------------------

export interface DtiResult {
  frontEnd: number;
  backEnd: number;
  frontEndPass: boolean;
  backEndPass: boolean;
  qualifies: boolean;
}

/**
 * Debt-to-income ratios given a housing payment, other monthly debts, and gross income.
 * Front-end = housing / income; back-end = (housing + other debts) / income.
 */
export function computeDti(
  monthlyHousing: number,
  monthlyOtherDebts: number,
  grossMonthlyIncome: number,
  guideline: Guideline,
): DtiResult {
  if (grossMonthlyIncome <= 0) {
    return {
      frontEnd: Infinity,
      backEnd: Infinity,
      frontEndPass: false,
      backEndPass: false,
      qualifies: false,
    };
  }
  const frontEnd = monthlyHousing / grossMonthlyIncome;
  const backEnd = (monthlyHousing + monthlyOtherDebts) / grossMonthlyIncome;
  const frontEndPass =
    guideline.frontEndLimit === null || frontEnd <= guideline.frontEndLimit + 1e-9;
  const backEndPass = backEnd <= guideline.backEndLimit + 1e-9;
  return {
    frontEnd,
    backEnd,
    frontEndPass,
    backEndPass,
    qualifies: frontEndPass && backEndPass,
  };
}

// ---------------------------------------------------------------------------
// Reverse solver: maximum affordable home price
// ---------------------------------------------------------------------------

export type DownPaymentMode =
  | { kind: "amount"; amount: number }
  | { kind: "percent"; percent: number };

export interface AffordabilityInputs {
  grossAnnualIncome: number;
  monthlyDebts: number;
  downPayment: DownPaymentMode;
  annualRatePct: number;
  termMonths?: number;
  propertyTaxRate?: number;
  insuranceRate?: number;
  monthlyHoa?: number;
  guideline?: Guideline;
  pmiRate?: number;
  conformingLimit?: number;
}

export interface AffordabilityResult {
  maxHomePrice: number;
  downPayment: number;
  piti: PitiBreakdown;
  dti: DtiResult;
  isJumbo: boolean;
  guideline: Guideline;
}

/**
 * Solve for the maximum home price the borrower qualifies for under the given guideline.
 *
 * The housing payment (and thus both DTI ratios) is monotonically increasing in home
 * price — taxes, insurance, loan, and PMI all rise with price — so we bisect on price
 * and keep the largest price where both DTI constraints still pass. This inner iteration
 * is required because tax/insurance/PMI depend on the very price we're solving for.
 */
export function maxAffordablePrice(inputs: AffordabilityInputs): AffordabilityResult {
  const {
    grossAnnualIncome,
    monthlyDebts,
    downPayment,
    annualRatePct,
    termMonths = DEFAULTS.termMonths,
    propertyTaxRate = DEFAULTS.propertyTaxRate,
    insuranceRate = DEFAULTS.insuranceRate,
    monthlyHoa = 0,
    guideline = GUIDELINES.conventional_classic,
    pmiRate = DEFAULTS.pmiRate,
    conformingLimit = CONFORMING_LOAN_LIMIT_1UNIT,
  } = inputs;

  const grossMonthlyIncome = grossAnnualIncome / 12;

  const downPaymentFor = (price: number): number =>
    downPayment.kind === "amount"
      ? Math.min(downPayment.amount, price)
      : price * downPayment.percent;

  const qualifiesAt = (price: number): boolean => {
    const dp = downPaymentFor(price);
    // Enforce the guideline's minimum down payment.
    if (price > 0 && dp / price < guideline.minDownPct - 1e-9) return false;
    const piti = computePiti({
      homePrice: price,
      downPayment: dp,
      annualRatePct,
      termMonths,
      propertyTaxRate,
      insuranceRate,
      monthlyHoa,
      guideline,
      pmiRate,
    });
    return computeDti(piti.total, monthlyDebts, grossMonthlyIncome, guideline).qualifies;
  };

  // Bisection bounds. Upper bound generous enough for any realistic income.
  let lo = 0;
  let hi = Math.max(1, grossAnnualIncome * 30 + 2_000_000);
  // Ensure hi does NOT qualify so the invariant (lo qualifies, hi doesn't) holds.
  // If even hi qualifies (e.g. huge down payment covers everything), return hi.
  if (qualifiesAt(hi)) {
    const dp = downPaymentFor(hi);
    const piti = computePiti({
      homePrice: hi, downPayment: dp, annualRatePct, termMonths,
      propertyTaxRate, insuranceRate, monthlyHoa, guideline, pmiRate,
    });
    return buildResult(hi, dp, piti, monthlyDebts, grossMonthlyIncome, guideline, conformingLimit);
  }

  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (qualifiesAt(mid)) lo = mid;
    else hi = mid;
  }

  const price = Math.floor(lo);
  const dp = downPaymentFor(price);
  const piti = computePiti({
    homePrice: price, downPayment: dp, annualRatePct, termMonths,
    propertyTaxRate, insuranceRate, monthlyHoa, guideline, pmiRate,
  });
  return buildResult(price, dp, piti, monthlyDebts, grossMonthlyIncome, guideline, conformingLimit);
}

function buildResult(
  price: number,
  downPayment: number,
  piti: PitiBreakdown,
  monthlyDebts: number,
  grossMonthlyIncome: number,
  guideline: Guideline,
  conformingLimit: number,
): AffordabilityResult {
  const dti = computeDti(piti.total, monthlyDebts, grossMonthlyIncome, guideline);
  return {
    maxHomePrice: price,
    downPayment,
    piti,
    dti,
    isJumbo: piti.loanAmount > conformingLimit,
    guideline,
  };
}

// ---------------------------------------------------------------------------
// Cash needed to close (the "how much do I actually need saved?" answer)
// ---------------------------------------------------------------------------

export interface CashToClose {
  downPayment: number;
  closingCosts: number;
  reserves: number;
  total: number;
}

/**
 * Total upfront cash a buyer needs: down payment + closing costs (typically 2–5% of price;
 * default 3%) + lender reserves (a couple months of the full payment). DTI qualification
 * alone ignores this, which is the most common way buyers overstate what they can actually
 * fund — so it's surfaced explicitly.
 */
export function cashToClose(inputs: {
  homePrice: number;
  downPayment: number;
  monthlyPiti: number;
  closingCostPct?: number;
  reserveMonths?: number;
}): CashToClose {
  const { homePrice, downPayment, monthlyPiti, closingCostPct = 0.03, reserveMonths = 2 } = inputs;
  const closingCosts = homePrice * closingCostPct;
  const reserves = monthlyPiti * reserveMonths;
  return {
    downPayment,
    closingCosts,
    reserves,
    total: downPayment + closingCosts + reserves,
  };
}

// ---------------------------------------------------------------------------
// Forward: income required to afford a target price
// ---------------------------------------------------------------------------

export interface RequiredIncomeResult {
  requiredAnnualIncome: number;
  piti: PitiBreakdown;
  bindingRatio: "front" | "back";
}

/**
 * Minimum gross annual income needed to qualify for a specific home price under a
 * guideline. The binding constraint is whichever ratio demands more income:
 *   income >= PITI / frontLimit   and   income >= (PITI + debts) / backLimit
 * Powers the "required-income gap" buyer-edge feature.
 */
export function requiredIncomeForPrice(inputs: {
  homePrice: number;
  downPayment: DownPaymentMode;
  monthlyDebts: number;
  annualRatePct: number;
  termMonths?: number;
  propertyTaxRate?: number;
  insuranceRate?: number;
  monthlyHoa?: number;
  guideline?: Guideline;
  pmiRate?: number;
}): RequiredIncomeResult {
  const {
    homePrice,
    downPayment,
    monthlyDebts,
    annualRatePct,
    termMonths = DEFAULTS.termMonths,
    propertyTaxRate = DEFAULTS.propertyTaxRate,
    insuranceRate = DEFAULTS.insuranceRate,
    monthlyHoa = 0,
    guideline = GUIDELINES.conventional_classic,
    pmiRate = DEFAULTS.pmiRate,
  } = inputs;

  const dp =
    downPayment.kind === "amount"
      ? Math.min(downPayment.amount, homePrice)
      : homePrice * downPayment.percent;

  const piti = computePiti({
    homePrice, downPayment: dp, annualRatePct, termMonths,
    propertyTaxRate, insuranceRate, monthlyHoa, guideline, pmiRate,
  });

  const backIncome = (piti.total + monthlyDebts) / guideline.backEndLimit;
  const frontIncome =
    guideline.frontEndLimit === null ? 0 : piti.total / guideline.frontEndLimit;

  const monthly = Math.max(backIncome, frontIncome);
  return {
    requiredAnnualIncome: monthly * 12,
    piti,
    bindingRatio: frontIncome > backIncome ? "front" : "back",
  };
}

/**
 * The highest mortgage rate at which the borrower still qualifies for `homePrice` under
 * the guideline (their "breakeven rate"). Affordability falls as the rate rises, so we
 * bisect on rate. Returns null when the price is out of reach even at `minRatePct`, and
 * `maxRatePct` when they qualify across the whole range. Powers the "rates at or below
 * X% put this home in reach" line on the rate charts.
 */
export function breakevenRateForPrice(inputs: {
  homePrice: number;
  grossAnnualIncome: number;
  monthlyDebts: number;
  downPayment: DownPaymentMode;
  guideline?: Guideline;
  minRatePct?: number;
  maxRatePct?: number;
}): number | null {
  const { homePrice, grossAnnualIncome, monthlyDebts, downPayment } = inputs;
  const guideline = inputs.guideline ?? GUIDELINES.conventional_classic;
  const minRatePct = inputs.minRatePct ?? 0.5;
  const maxRatePct = inputs.maxRatePct ?? 15;

  const affordsAt = (annualRatePct: number): boolean =>
    maxAffordablePrice({ grossAnnualIncome, monthlyDebts, downPayment, annualRatePct, guideline })
      .maxHomePrice >= homePrice;

  if (!affordsAt(minRatePct)) return null;
  if (affordsAt(maxRatePct)) return maxRatePct;

  let lo = minRatePct; // affords
  let hi = maxRatePct; // does not afford
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (affordsAt(mid)) lo = mid;
    else hi = mid;
  }
  return Math.round(lo * 100) / 100;
}
