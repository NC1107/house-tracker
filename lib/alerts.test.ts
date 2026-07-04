import { describe, it, expect } from "vitest";
import { evaluateAlert, type AlertRule } from "./alerts";

describe("rate_threshold", () => {
  const rule: AlertRule = { id: 1, type: "rate_threshold", params: { product: "30yr", below: 6 } };
  it("fires when the rate is at or below the target", () => {
    const r = evaluateAlert(rule, { rate: 5.9, date: "2026-07-02" });
    expect(r.fired).toBe(true);
    expect(r.dedupeKey).toBe("rate<=6@2026-07-02");
    expect(r.message).toContain("5.90%");
  });
  it("does not fire above the target", () => {
    expect(evaluateAlert(rule, { rate: 6.4, date: "2026-07-02" }).fired).toBe(false);
  });
  it("does not fire with no data", () => {
    expect(evaluateAlert(rule, { rate: null, date: null }).fired).toBe(false);
  });
});

describe("price_move", () => {
  it("fires on a drop when direction is down", () => {
    const rule: AlertRule = { id: 2, type: "price_move", params: { pctThreshold: 3, direction: "down" }, regionName: "Texas" };
    const r = evaluateAlert(rule, { yoyPct: -4.2, date: "2026-05-01" });
    expect(r.fired).toBe(true);
    expect(r.message).toContain("Texas");
    expect(r.message).toContain("down");
  });
  it("does not fire on a rise when direction is down", () => {
    const rule: AlertRule = { id: 2, type: "price_move", params: { pctThreshold: 3, direction: "down" } };
    expect(evaluateAlert(rule, { yoyPct: 5, date: "2026-05-01" }).fired).toBe(false);
  });
  it("fires on a rise when direction is up", () => {
    const rule: AlertRule = { id: 3, type: "price_move", params: { pctThreshold: 3, direction: "up" } };
    expect(evaluateAlert(rule, { yoyPct: 4, date: "2026-05-01" }).fired).toBe(true);
  });
});

describe("market_heat", () => {
  const rule: AlertRule = { id: 4, type: "market_heat", params: { minScore: 60 }, regionName: "Ohio" };
  it("fires when the score meets the threshold", () => {
    expect(evaluateAlert(rule, { score: 65, date: "2026-05-01" }).fired).toBe(true);
  });
  it("does not fire below the threshold", () => {
    expect(evaluateAlert(rule, { score: 40, date: "2026-05-01" }).fired).toBe(false);
  });
});

describe("affordability", () => {
  const rule: AlertRule = { id: 5, type: "affordability", params: {}, regionName: "Colorado" };
  it("fires when required income drops to/below the user's income", () => {
    const r = evaluateAlert(rule, { requiredIncome: 95_000, income: 100_000, date: "2026-05-01" });
    expect(r.fired).toBe(true);
    expect(r.message).toContain("Colorado");
  });
  it("does not fire when still out of budget", () => {
    expect(evaluateAlert(rule, { requiredIncome: 120_000, income: 100_000, date: "2026-05-01" }).fired).toBe(false);
  });
});

describe("dedupe keys are stable per period", () => {
  it("same condition + date yields the same key", () => {
    const rule: AlertRule = { id: 1, type: "rate_threshold", params: { below: 6 } };
    const a = evaluateAlert(rule, { rate: 5.5, date: "2026-07-02" });
    const b = evaluateAlert(rule, { rate: 5.4, date: "2026-07-02" });
    expect(a.dedupeKey).toBe(b.dedupeKey);
  });
});

describe("listing_match", () => {
  const rule: AlertRule = {
    id: 9,
    type: "listing_match",
    params: { stateName: "Ohio", maxPrice: 400_000, minBeds: 4, minBaths: 2, minStories: 2, basement: true },
  };
  const listing = (n: number) => ({
    address: `${n} Main St`,
    city: "Columbus",
    price: 350_000 + n,
    url: `https://example.com/${n}`,
    mls: `MLS${n}`,
  });

  it("does not fire with no new listings", () => {
    const ev = evaluateAlert(rule, { newListings: [], date: "2026-07-04" });
    expect(ev.fired).toBe(false);
  });

  it("fires with a summary of the filters and linked listings", () => {
    const ev = evaluateAlert(rule, { newListings: [listing(1), listing(2)], date: "2026-07-04" });
    expect(ev.fired).toBe(true);
    expect(ev.message).toContain("2 new listings in Ohio");
    expect(ev.message).toContain("4+ bd");
    expect(ev.message).toContain("2+ stories");
    expect(ev.message).toContain("basement");
    expect(ev.message).toContain("under $400,000");
    expect(ev.message).toContain('href="https://example.com/1"');
    expect(ev.dedupeKey!.length).toBeLessThanOrEqual(128);
  });

  it("caps the listing detail at five and counts the rest", () => {
    const many = Array.from({ length: 8 }, (_, i) => listing(i));
    const ev = evaluateAlert(rule, { newListings: many, date: "2026-07-04" });
    expect(ev.message).toContain("and 3 more");
  });
});
