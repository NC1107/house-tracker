import { describe, it, expect } from "vitest";
import { rentVsBuy, type RentVsBuyInputs } from "./rentvsbuy";

const base: RentVsBuyInputs = {
  homePrice: 400_000,
  downPayment: 80_000, // 20%
  annualRatePct: 6.5,
  propertyTaxRate: 0.011,
  insuranceRate: 0.005,
  monthlyRent: 2_200,
  annualRentGrowth: 0.03,
  annualHomeAppreciation: 0.03,
  annualInvestmentReturn: 0.05,
  horizonYears: 15,
};

describe("rent vs buy — structure", () => {
  it("produces a monthly series over the horizon", () => {
    const r = rentVsBuy(base);
    expect(r.series).toHaveLength(15 * 12);
    expect(r.series[0].month).toBe(1);
    // Renter starts ahead (buyer's cash is sunk into down payment + closing).
    expect(r.series[0].renterNetWorth).toBeGreaterThan(r.series[0].buyerNetWorth);
  });

  it("amortizes the loan toward zero and appreciates the home", () => {
    const r = rentVsBuy({ ...base, horizonYears: 30 });
    const last = r.series[r.series.length - 1];
    expect(last.loanBalance).toBeLessThan(1); // paid off by 30y
    expect(last.homeValue).toBeGreaterThan(base.homePrice); // appreciated
  });
});

describe("rent vs buy — directional sanity", () => {
  it("buying eventually wins when rent is high and you stay long enough", () => {
    const r = rentVsBuy({ ...base, monthlyRent: 2_600, horizonYears: 15 });
    expect(r.breakevenMonth).not.toBeNull();
    expect(r.breakevenMonth!).toBeLessThan(15 * 12);
    expect(r.recommendation).toBe("buy");
  });

  it("higher rent makes buying break even sooner", () => {
    const low = rentVsBuy({ ...base, monthlyRent: 2_200 });
    const high = rentVsBuy({ ...base, monthlyRent: 3_200 });
    expect(high.breakevenMonth).not.toBeNull();
    if (low.breakevenMonth !== null) {
      expect(high.breakevenMonth!).toBeLessThanOrEqual(low.breakevenMonth);
    }
  });

  it("cheap rent + short horizon favors renting", () => {
    const r = rentVsBuy({ ...base, monthlyRent: 1_400, horizonYears: 3 });
    expect(r.recommendation).toBe("rent");
  });

  it("faster home appreciation favors buying", () => {
    const slow = rentVsBuy({ ...base, annualHomeAppreciation: 0.01 });
    const fast = rentVsBuy({ ...base, annualHomeAppreciation: 0.06 });
    expect(fast.finalBuyerNetWorth).toBeGreaterThan(slow.finalBuyerNetWorth);
  });

  it("higher investment return favors renting (bigger opportunity cost)", () => {
    const lowReturn = rentVsBuy({ ...base, annualInvestmentReturn: 0.03 });
    const highReturn = rentVsBuy({ ...base, annualInvestmentReturn: 0.09 });
    expect(highReturn.finalRenterNetWorth).toBeGreaterThan(lowReturn.finalRenterNetWorth);
  });
});
