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
