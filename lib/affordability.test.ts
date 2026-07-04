import { describe, it, expect } from "vitest";
import {
  monthlyPrincipalAndInterest,
  remainingBalance,
  pmiMonths,
  computePiti,
  computeDti,
  maxAffordablePrice,
  requiredIncomeForPrice,
  breakevenRateForPrice,
  cashToClose,
  GUIDELINES,
  CONFORMING_LOAN_LIMIT_1UNIT_2025,
} from "./affordability";

describe("cashToClose", () => {
  it("sums down payment, closing costs, and reserves", () => {
    const c = cashToClose({ homePrice: 400_000, downPayment: 80_000, monthlyPiti: 2_500 });
    expect(c.closingCosts).toBeCloseTo(12_000, 0); // 3% of 400k
    expect(c.reserves).toBeCloseTo(5_000, 0); // 2 * 2500
    expect(c.total).toBeCloseTo(97_000, 0);
  });
  it("respects custom closing and reserve settings", () => {
    const c = cashToClose({ homePrice: 300_000, downPayment: 60_000, monthlyPiti: 2_000, closingCostPct: 0.05, reserveMonths: 3 });
    expect(c.closingCosts).toBeCloseTo(15_000, 0);
    expect(c.reserves).toBeCloseTo(6_000, 0);
    expect(c.total).toBeCloseTo(81_000, 0);
  });
});

/**
 * The amortization vectors below are exact and match every authoritative mortgage
 * calculator (CFPB, Bankrate, Fannie Mae). They are the ground truth for P&I.
 */
describe("amortization — known vectors", () => {
  it("$300,000 @ 6.5% / 30yr = $1,896.20 P&I", () => {
    expect(monthlyPrincipalAndInterest(300_000, 6.5, 360)).toBeCloseTo(1896.20, 1);
  });

  it("$200,000 @ 5.0% / 30yr = $1,073.64 P&I", () => {
    expect(monthlyPrincipalAndInterest(200_000, 5.0, 360)).toBeCloseTo(1073.64, 1);
  });

  it("$250,000 @ 7.0% / 15yr = $2,247.07 P&I", () => {
    expect(monthlyPrincipalAndInterest(250_000, 7.0, 180)).toBeCloseTo(2247.07, 1);
  });

  it("P&I scales linearly with principal", () => {
    const base = monthlyPrincipalAndInterest(300_000, 6.5, 360);
    expect(monthlyPrincipalAndInterest(320_000, 6.5, 360)).toBeCloseTo(
      base * (320_000 / 300_000),
      4,
    );
  });

  it("handles the 0% edge case", () => {
    expect(monthlyPrincipalAndInterest(120_000, 0, 360)).toBeCloseTo(333.33, 2);
  });

  it("returns 0 for non-positive principal", () => {
    expect(monthlyPrincipalAndInterest(0, 6.5, 360)).toBe(0);
    expect(monthlyPrincipalAndInterest(-100, 6.5, 360)).toBe(0);
  });
});

describe("remaining balance", () => {
  it("equals principal at month 0 and 0 at term end", () => {
    expect(remainingBalance(300_000, 6.5, 360, 0)).toBe(300_000);
    expect(remainingBalance(300_000, 6.5, 360, 360)).toBe(0);
  });

  it("decreases monotonically", () => {
    let prev = remainingBalance(300_000, 6.5, 360, 0);
    for (let m = 12; m <= 360; m += 12) {
      const bal = remainingBalance(300_000, 6.5, 360, m);
      expect(bal).toBeLessThan(prev);
      prev = bal;
    }
  });
});

describe("PMI", () => {
  it("is zero when down payment >= 20%", () => {
    expect(pmiMonths(400_000, 320_000, 6.5, 360)).toBe(0);
    const piti = computePiti({ homePrice: 400_000, downPayment: 80_000, annualRatePct: 6.5 });
    expect(piti.mortgageInsurance).toBe(0);
  });

  it("applies and eventually terminates when down payment < 20%", () => {
    // 10% down -> LTV 90%, PMI applies.
    const piti = computePiti({ homePrice: 400_000, downPayment: 40_000, annualRatePct: 6.5 });
    expect(piti.mortgageInsurance).toBeGreaterThan(0);
    // PMI = loan * pmiRate / 12 = 360000 * 0.005 / 12 = 150
    expect(piti.mortgageInsurance).toBeCloseTo(150, 2);
    const months = pmiMonths(400_000, 360_000, 6.5, 360);
    expect(months).toBeGreaterThan(0);
    expect(months).toBeLessThan(360); // terminates at 78% LTV before payoff
  });
});

describe("PITI breakdown", () => {
  it("assembles a correct 20%-down conventional payment", () => {
    const piti = computePiti({
      homePrice: 400_000,
      downPayment: 80_000,
      annualRatePct: 6.5,
      propertyTaxRate: 0.011,
      insuranceRate: 0.005,
    });
    expect(piti.loanAmount).toBe(320_000);
    expect(piti.ltv).toBeCloseTo(0.8, 6);
    expect(piti.principalAndInterest).toBeCloseTo(2022.61, 1); // 1896.20 * 320/300
    expect(piti.propertyTax).toBeCloseTo(366.67, 2); // 400k * 1.1% / 12
    expect(piti.insurance).toBeCloseTo(166.67, 2); // 400k * 0.5% / 12
    expect(piti.mortgageInsurance).toBe(0);
    expect(piti.total).toBeCloseTo(2555.94, 1);
  });

  it("FHA finances upfront MIP and charges annual MIP", () => {
    const piti = computePiti({
      homePrice: 300_000,
      downPayment: 10_500, // 3.5% down
      annualRatePct: 6.5,
      guideline: GUIDELINES.fha,
    });
    // base loan 289,500; upfront MIP 1.75% financed in
    expect(piti.financedUpfrontMip).toBeCloseTo(289_500 * 0.0175, 2);
    expect(piti.loanAmount).toBeCloseTo(289_500 * 1.0175, 1);
    expect(piti.mortgageInsurance).toBeGreaterThan(0);
  });
});

describe("DTI qualification", () => {
  it("passes/fails against conventional 28/36", () => {
    const g = GUIDELINES.conventional_classic;
    // income 10k/mo, housing 2600 (26%), debts 500 -> back 31%: passes
    const ok = computeDti(2600, 500, 10_000, g);
    expect(ok.frontEnd).toBeCloseTo(0.26, 4);
    expect(ok.backEnd).toBeCloseTo(0.31, 4);
    expect(ok.qualifies).toBe(true);

    // housing 3000 (30% > 28 front) -> fails on front-end
    const badFront = computeDti(3000, 0, 10_000, g);
    expect(badFront.frontEndPass).toBe(false);
    expect(badFront.qualifies).toBe(false);

    // housing 2600 (26% ok) but debts 1200 -> back 38% > 36: fails on back-end
    const badBack = computeDti(2600, 1200, 10_000, g);
    expect(badBack.frontEndPass).toBe(true);
    expect(badBack.backEndPass).toBe(false);
  });

  it("QM ignores front-end and caps back-end at 43%", () => {
    const g = GUIDELINES.qm;
    const r = computeDti(3500, 300, 10_000, g); // front 35%, back 38%
    expect(r.frontEndPass).toBe(true); // no front constraint
    expect(r.qualifies).toBe(true);
    expect(computeDti(3800, 700, 10_000, g).qualifies).toBe(false); // back 45% > 43
  });
});

describe("max affordable price (reverse solver)", () => {
  it("matches a hand calculation and binds on the correct ratio", () => {
    // $120k income, no debts, 20% down, 6.5%, tax 1.1%, ins 0.5%, conventional 28/36.
    // Front-end (28%) binds -> max housing 2800/mo -> hand calc price ~ $438,194.
    const res = maxAffordablePrice({
      grossAnnualIncome: 120_000,
      monthlyDebts: 0,
      downPayment: { kind: "percent", percent: 0.2 },
      annualRatePct: 6.5,
      propertyTaxRate: 0.011,
      insuranceRate: 0.005,
      guideline: GUIDELINES.conventional_classic,
    });
    expect(res.maxHomePrice).toBeGreaterThan(433_000);
    expect(res.maxHomePrice).toBeLessThan(443_000);
    // At the max price the binding ratio sits essentially at its limit.
    expect(res.dti.frontEnd).toBeCloseTo(0.28, 2);
  });

  it("looser guidelines allow more house", () => {
    const base = {
      grossAnnualIncome: 120_000,
      monthlyDebts: 400,
      downPayment: { kind: "percent" as const, percent: 0.2 },
      annualRatePct: 6.5,
    };
    const classic = maxAffordablePrice({ ...base, guideline: GUIDELINES.conventional_classic });
    const qm = maxAffordablePrice({ ...base, guideline: GUIDELINES.qm });
    const max = maxAffordablePrice({ ...base, guideline: GUIDELINES.conventional_max });
    expect(qm.maxHomePrice).toBeGreaterThan(classic.maxHomePrice);
    expect(max.maxHomePrice).toBeGreaterThan(qm.maxHomePrice);
  });

  it("higher rates reduce affordability", () => {
    const base = {
      grossAnnualIncome: 120_000,
      monthlyDebts: 0,
      downPayment: { kind: "percent" as const, percent: 0.2 },
      guideline: GUIDELINES.qm,
    };
    const low = maxAffordablePrice({ ...base, annualRatePct: 5 });
    const high = maxAffordablePrice({ ...base, annualRatePct: 8 });
    expect(high.maxHomePrice).toBeLessThan(low.maxHomePrice);
  });

  it("flags jumbo loans above the conforming limit", () => {
    const res = maxAffordablePrice({
      grossAnnualIncome: 500_000,
      monthlyDebts: 0,
      downPayment: { kind: "percent", percent: 0.2 },
      annualRatePct: 6.5,
      guideline: GUIDELINES.conventional_max,
    });
    expect(res.piti.loanAmount).toBeGreaterThan(CONFORMING_LOAN_LIMIT_1UNIT_2025);
    expect(res.isJumbo).toBe(true);
  });
});

describe("required income <-> max price round trip", () => {
  it("required income for the solved max price recovers the input income", () => {
    const income = 150_000;
    const common = {
      monthlyDebts: 500,
      downPayment: { kind: "percent" as const, percent: 0.2 },
      annualRatePct: 6.5,
      guideline: GUIDELINES.qm,
    };
    const max = maxAffordablePrice({ ...common, grossAnnualIncome: income });
    const req = requiredIncomeForPrice({ ...common, homePrice: max.maxHomePrice });
    // Should be within ~1% (bisection + integer flooring of price).
    expect(req.requiredAnnualIncome).toBeGreaterThan(income * 0.985);
    expect(req.requiredAnnualIncome).toBeLessThan(income * 1.015);
  });
});

describe("breakeven rate for a target price", () => {
  const base = {
    grossAnnualIncome: 80_610,
    monthlyDebts: 0,
    downPayment: { kind: "percent", percent: 0.15 } as const,
  };

  it("returns the highest rate that still affords the price", () => {
    const rate = breakevenRateForPrice({ ...base, homePrice: 300_000 });
    expect(rate).not.toBeNull();
    const affordsAtBreakeven = maxAffordablePrice({ ...base, annualRatePct: rate! }).maxHomePrice;
    const affordsAbove = maxAffordablePrice({ ...base, annualRatePct: rate! + 0.5 }).maxHomePrice;
    expect(affordsAtBreakeven).toBeGreaterThanOrEqual(300_000 * 0.995);
    expect(affordsAbove).toBeLessThan(300_000);
  });

  it("returns null when the price is out of reach even at the floor rate", () => {
    expect(breakevenRateForPrice({ ...base, homePrice: 2_000_000 })).toBeNull();
  });

  it("returns the ceiling when affordable across the whole range", () => {
    expect(breakevenRateForPrice({ ...base, homePrice: 50_000 })).toBe(15);
  });
});
