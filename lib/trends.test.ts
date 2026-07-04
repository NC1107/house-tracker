import { describe, it, expect } from "vitest";
import { asOf, paymentToBuySeries, priceToIncomeSeries, rateSpreadSeries, housingBurdenSeries, buyingPowerSeries, realIndexSeries, yoyChangeSeries } from "./trends";
import { costOfWaiting } from "./costofwaiting";

describe("asOf", () => {
  const src = [
    { date: "2020-01-01", value: 10 },
    { date: "2021-01-01", value: 20 },
    { date: "2022-01-01", value: 30 },
  ];
  it("returns the latest value on or before the date", () => {
    expect(asOf("2021-06-01", src)).toBe(20);
    expect(asOf("2022-01-01", src)).toBe(30);
  });
  it("returns null before any source point", () => {
    expect(asOf("2019-01-01", src)).toBeNull();
  });
});

describe("paymentToBuySeries", () => {
  const prices = [
    { date: "2021-07-01", value: 400_000 },
    { date: "2023-07-01", value: 420_000 },
  ];
  const rates = [
    { date: "2021-01-01", value: 3.0 },
    { date: "2023-01-01", value: 6.8 },
  ];
  it("payment jumps with the rate shock even for a small price rise", () => {
    const s = paymentToBuySeries(prices, rates);
    expect(s).toHaveLength(2);
    // higher rate + higher price -> materially higher payment
    expect(s[1].value).toBeGreaterThan(s[0].value * 1.3);
  });
  it("skips points with no rate available yet", () => {
    const s = paymentToBuySeries([{ date: "2019-01-01", value: 300_000 }], rates);
    expect(s).toHaveLength(0);
  });
});

describe("priceToIncomeSeries", () => {
  it("computes price / latest income", () => {
    const s = priceToIncomeSeries(
      [{ date: "2023-06-01", value: 400_000 }],
      [{ date: "2023-01-01", value: 80_000 }],
    );
    expect(s[0].value).toBeCloseTo(5, 2);
  });
});

describe("rateSpreadSeries", () => {
  it("computes mortgage minus treasury", () => {
    const s = rateSpreadSeries(
      [{ date: "2024-01-05", value: 6.8 }],
      [{ date: "2024-01-01", value: 4.0 }],
    );
    expect(s[0].value).toBeCloseTo(2.8, 2);
  });
});

describe("housingBurdenSeries", () => {
  it("is higher when rates are higher (same price)", () => {
    const prices = [{ date: "2021-07-01", value: 400_000 }, { date: "2023-07-01", value: 400_000 }];
    const rates = [{ date: "2021-01-01", value: 3.0 }, { date: "2023-01-01", value: 7.0 }];
    const incomes = [{ date: "2020-01-01", value: 80_000 }];
    const s = housingBurdenSeries(prices, rates, incomes);
    expect(s[1].value).toBeGreaterThan(s[0].value);
  });
});

describe("buyingPowerSeries", () => {
  it("falls as rates rise (same income)", () => {
    const incomes = [{ date: "2020-01-01", value: 100_000 }];
    const rates = [{ date: "2021-01-01", value: 3.0 }, { date: "2023-02-01", value: 7.5 }];
    const s = buyingPowerSeries(rates, incomes);
    expect(s).toHaveLength(2);
    expect(s[1].value).toBeLessThan(s[0].value);
  });
});

describe("realIndexSeries", () => {
  it("is flat when nominal prices merely track inflation", () => {
    const nominal = [{ date: "2020-01-01", value: 100 }, { date: "2021-01-01", value: 110 }];
    const cpi = [{ date: "2020-01-01", value: 100 }, { date: "2021-01-01", value: 110 }];
    const s = realIndexSeries(nominal, cpi);
    expect(s[0].value).toBeCloseTo(100, 1);
    expect(s[1].value).toBeCloseTo(100, 1); // real growth ~0
  });
  it("rises when prices outpace inflation", () => {
    const nominal = [{ date: "2020-01-01", value: 100 }, { date: "2021-01-01", value: 130 }];
    const cpi = [{ date: "2020-01-01", value: 100 }, { date: "2021-01-01", value: 105 }];
    const s = realIndexSeries(nominal, cpi);
    expect(s[1].value).toBeGreaterThan(115);
  });
});

describe("yoyChangeSeries", () => {
  // 13 contiguous months: 2024-01 .. 2025-01
  const months = Array.from({ length: 13 }, (_, i) => {
    const y = 2024 + Math.floor(i / 12);
    const m = (i % 12) + 1;
    return `${y}-${String(m).padStart(2, "0")}-01`;
  });
  it("computes 12-month percent change matched by date", () => {
    const s = months.map((date) => ({ date, value: 100 }));
    s[12].value = 110; // 2025-01 vs 2024-01 = +10%
    const out = yoyChangeSeries(s);
    expect(out.at(-1)!.value).toBeCloseTo(10, 1);
  });
  it("skips when there is no comparable point ~1yr back (gap too large)", () => {
    const s = [
      { date: "2020-01-01", value: 100 },
      { date: "2024-01-01", value: 150 }, // 4yr gap, no ~1yr-prior point
    ];
    expect(yoyChangeSeries(s)).toHaveLength(0);
  });
  it("returns empty for a single point", () => {
    expect(yoyChangeSeries([{ date: "2024-01-01", value: 100 }])).toHaveLength(0);
  });
});

describe("costOfWaiting", () => {
  const base = {
    homePrice: 415_000,
    downPct: 0.2,
    currentRate: 6.5,
    annualPriceChangePct: 0.04,
    rateChangePts: 0.5,
    waitMonths: 12,
  };
  it("waiting with rising prices and rates costs more", () => {
    const r = costOfWaiting(base);
    expect(r.laterPrice).toBeGreaterThan(r.nowPrice);
    expect(r.monthlyDelta).toBeGreaterThan(0);
    expect(r.downPaymentDelta).toBeGreaterThan(0);
    expect(r.waitingCostsMore).toBe(true);
  });
  it("waiting can save money if prices and rates fall", () => {
    const r = costOfWaiting({ ...base, annualPriceChangePct: -0.05, rateChangePts: -1 });
    expect(r.monthlyDelta).toBeLessThan(0);
    expect(r.waitingCostsMore).toBe(false);
  });
  it("price change compounds over the wait horizon", () => {
    const oneYr = costOfWaiting(base);
    const twoYr = costOfWaiting({ ...base, waitMonths: 24 });
    expect(twoYr.laterPrice).toBeGreaterThan(oneYr.laterPrice);
  });
});
