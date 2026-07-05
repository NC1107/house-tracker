import { describe, expect, it } from "vitest";
import { quarterEndDate } from "@/lib/sources/fhfa";

describe("quarterEndDate", () => {
  it("maps quarters to quarter-end dates", () => {
    expect(quarterEndDate(1975, 1)).toBe("1975-03-31");
    expect(quarterEndDate(2026, 2)).toBe("2026-06-30");
    expect(quarterEndDate(2026, 3)).toBe("2026-09-30");
    expect(quarterEndDate(2026, 4)).toBe("2026-12-31");
  });

  it("rejects invalid quarters and years", () => {
    expect(quarterEndDate(2026, 0)).toBeNull();
    expect(quarterEndDate(2026, 5)).toBeNull();
    expect(quarterEndDate(NaN, 1)).toBeNull();
    expect(quarterEndDate(1800, 1)).toBeNull();
  });
});

import { haversineMiles } from "@/lib/geo/distance";

describe("haversineMiles", () => {
  it("matches known distances", () => {
    // Annapolis MD to Baltimore MD is ~25 miles as the crow flies.
    const d = haversineMiles(38.9784, -76.4922, 39.2904, -76.6122);
    expect(d).toBeGreaterThan(20);
    expect(d).toBeLessThan(30);
    expect(haversineMiles(40, -76, 40, -76)).toBe(0);
  });
});
