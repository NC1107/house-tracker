import { describe, it, expect } from "vitest";
import { marketHeat, labelFor } from "./marketheat";

describe("market heat scoring", () => {
  it("returns null score when no signals are provided", () => {
    const r = marketHeat({});
    expect(r.score).toBeNull();
    expect(r.components).toHaveLength(0);
  });

  it("scores a hot seller's market low (buyer leverage)", () => {
    const r = marketHeat({
      monthsOfSupply: 1.5,
      daysOnMarket: 10,
      priceDropsShare: 0.05,
      saleToList: 1.03,
      inventoryTrendYoY: -0.25,
    });
    expect(r.score!).toBeLessThan(20);
    expect(r.label).toBe("Strong seller's market");
  });

  it("scores a soft buyer's market high", () => {
    const r = marketHeat({
      monthsOfSupply: 9,
      daysOnMarket: 90,
      priceDropsShare: 0.4,
      saleToList: 0.95,
      inventoryTrendYoY: 0.25,
    });
    expect(r.score!).toBeGreaterThan(80);
    expect(r.label).toBe("Strong buyer's market");
  });

  it("scores a balanced market near the middle", () => {
    const r = marketHeat({
      monthsOfSupply: 6,
      daysOnMarket: 52,
      priceDropsShare: 0.25,
      saleToList: 0.985,
      inventoryTrendYoY: 0,
    });
    expect(r.score!).toBeGreaterThan(40);
    expect(r.score!).toBeLessThan(60);
  });

  it("more inventory raises buyer leverage", () => {
    const low = marketHeat({ monthsOfSupply: 3 }).score!;
    const high = marketHeat({ monthsOfSupply: 8 }).score!;
    expect(high).toBeGreaterThan(low);
  });

  it("renormalizes weights when only some signals are present", () => {
    const r = marketHeat({ monthsOfSupply: 6 });
    expect(r.components).toHaveLength(1);
    expect(r.components[0].weight).toBeCloseTo(1, 6);
  });

  it("clamps extreme values into range", () => {
    const r = marketHeat({ daysOnMarket: 500, monthsOfSupply: 50 });
    expect(r.score!).toBeLessThanOrEqual(100);
    expect(r.score!).toBeGreaterThanOrEqual(0);
  });
});

describe("labelFor", () => {
  it("maps score bands to labels", () => {
    expect(labelFor(90)).toBe("Strong buyer's market");
    expect(labelFor(60)).toBe("Buyer-leaning");
    expect(labelFor(50)).toBe("Balanced");
    expect(labelFor(30)).toBe("Seller-leaning");
    expect(labelFor(10)).toBe("Strong seller's market");
  });
});
