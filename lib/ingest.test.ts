import { describe, it, expect } from "vitest";
import { parseCsv, wideToLong, dedupeByKey, sanityCheck, type SeriesRow } from "./ingest";

describe("parseCsv", () => {
  it("parses basic comma-separated rows", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields with embedded commas", () => {
    expect(parseCsv('name,val\n"Smith, John",5')).toEqual([
      ["name", "val"],
      ["Smith, John", "5"],
    ]);
  });

  it("handles quoted fields with embedded newlines", () => {
    const rows = parseCsv('a,b\n"line1\nline2",x');
    expect(rows).toEqual([
      ["a", "b"],
      ["line1\nline2", "x"],
    ]);
  });

  it("handles escaped double quotes", () => {
    expect(parseCsv('a\n"he said ""hi"""')).toEqual([["a"], ['he said "hi"']]);
  });

  it("strips CR from CRLF line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("captures the last row when there is no trailing newline", () => {
    expect(parseCsv("a,b\n1,2")).toHaveLength(2);
  });

  it("supports a tab delimiter (Redfin)", () => {
    expect(parseCsv('"PERIOD_END"\t"REGION"\n"2026-05-31"\t"California"', "\t")).toEqual([
      ["PERIOD_END", "REGION"],
      ["2026-05-31", "California"],
    ]);
  });
});

describe("wideToLong", () => {
  const header = ["RegionID", "RegionName", "extra", "2024-01-01", "2024-02-01"];
  const dataRows = [
    ["1", "CA", "x", "100", "110"],
    ["2", "ZZ", "x", "200", "210"], // unresolved region
    ["3", "TX", "x", "", "abc"], // missing / non-numeric values skipped
  ];
  const index = new Map([["CA", 10], ["TX", 20]]);

  it("reshapes date columns into long observations and resolves geographies", () => {
    const out = wideToLong(header, dataRows, {
      regionCodeCol: 1,
      dateColStart: 3,
      metricKey: "zhvi_all",
      freq: "monthly",
      resolveGeoId: (c) => index.get(c),
    });
    // CA: two points; ZZ: skipped (unresolved); TX: both values invalid -> skipped
    expect(out).toEqual([
      { geographyId: 10, metricKey: "zhvi_all", periodDate: "2024-01-01", freq: "monthly", value: 100 },
      { geographyId: 10, metricKey: "zhvi_all", periodDate: "2024-02-01", freq: "monthly", value: 110 },
    ]);
  });
});

describe("dedupeByKey", () => {
  it("keeps the last row per (geography, metric, period)", () => {
    const rows: SeriesRow[] = [
      { geographyId: 1, metricKey: "m", periodDate: "2024-01-01", freq: "monthly", value: 1 },
      { geographyId: 1, metricKey: "m", periodDate: "2024-01-01", freq: "monthly", value: 2 },
      { geographyId: 1, metricKey: "m", periodDate: "2024-02-01", freq: "monthly", value: 3 },
    ];
    const out = dedupeByKey(rows);
    expect(out).toHaveLength(2);
    expect(out.find((r) => r.periodDate === "2024-01-01")!.value).toBe(2);
  });
});

describe("sanityCheck", () => {
  it("does not throw and flags out-of-range values (unit drift)", () => {
    // price_drops_share shipped as a percent (0-100) instead of a fraction
    const rows: SeriesRow[] = [10, 20, 30].map((v, i) => ({
      geographyId: 1, metricKey: "price_drops_share", periodDate: `2024-0${i + 1}-01`, freq: "monthly", value: v,
    }));
    expect(() => sanityCheck(rows)).not.toThrow();
  });
});
