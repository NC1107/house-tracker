import { describe, expect, it } from "vitest";
import { yyyymmToDate, REALTOR_METRIC_MAP } from "@/lib/sources/realtor";

describe("yyyymmToDate", () => {
  it("converts a valid yyyymm to the first of the month", () => {
    expect(yyyymmToDate("202606")).toBe("2026-06-01");
    expect(yyyymmToDate(" 201607 ")).toBe("2016-07-01");
  });

  it("rejects non-months (including the trailing note row Realtor.com ships)", () => {
    expect(yyyymmToDate("")).toBeNull();
    expect(yyyymmToDate("202613")).toBeNull();
    expect(yyyymmToDate("202600")).toBeNull();
    expect(yyyymmToDate("2026-06")).toBeNull();
    expect(yyyymmToDate("Note: data as of 2026")).toBeNull();
  });
});

describe("REALTOR_METRIC_MAP", () => {
  it("maps to catalog metric keys", () => {
    expect(Object.values(REALTOR_METRIC_MAP)).toEqual(
      expect.arrayContaining(["median_list_price", "realtor_new_listings", "pending_ratio"]),
    );
  });
});

// City-link parsing for the live-listings city search lives in redfin-live.
import { parseCityLinks } from "@/lib/sources/redfin-live";

describe("parseCityLinks", () => {
  it("extracts unique cities with region ids from state-page HTML", () => {
    const html = `
      <a href="/city/4664/OH/Columbus">Columbus</a>
      <a href="/city/4145/OH/Cleveland">Cleveland</a>
      <a href="/city/4153/OH/Cleveland">Cleveland (alt)</a>
      <a href="/city/18309/OH/Shaker-Heights">Shaker Heights</a>
      <a href="/county/2168/OH/Butler-County">not a city</a>`;
    const cities = parseCityLinks(html);
    expect(cities).toEqual([
      { id: 4145, name: "Cleveland" },
      { id: 4664, name: "Columbus" },
      { id: 18309, name: "Shaker Heights" },
    ]);
  });
});
