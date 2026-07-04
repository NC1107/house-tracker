import { describe, it, expect } from "vitest";
import { computeStateAffordability, affordabilityColor } from "./stateAffordability";

describe("computeStateAffordability", () => {
  const income = 80_000;
  it("a cheap state is affordable to the median household", () => {
    const r = computeStateAffordability(200_000, income, 6.5);
    expect(r.priceToIncome).toBeCloseTo(2.5, 1);
    expect(r.affordable).toBe(true);
    expect(r.requiredIncome).toBeLessThan(income);
  });
  it("an expensive state is not", () => {
    const r = computeStateAffordability(800_000, income, 6.5);
    expect(r.priceToIncome).toBeCloseTo(10, 1);
    expect(r.affordable).toBe(false);
    expect(r.requiredIncome).toBeGreaterThan(income);
  });
  it("required income rises with price and rate", () => {
    const lowRate = computeStateAffordability(500_000, income, 5);
    const highRate = computeStateAffordability(500_000, income, 8);
    expect(highRate.requiredIncome).toBeGreaterThan(lowRate.requiredIncome);
  });
});

describe("affordabilityColor", () => {
  it("maps ratios to the green→red scale", () => {
    expect(affordabilityColor(2.5)).toBe("#16a34a");
    expect(affordabilityColor(3.5)).toBe("#84cc16");
    expect(affordabilityColor(6)).toBe("#f97316");
    expect(affordabilityColor(9)).toBe("#dc2626");
  });
});
