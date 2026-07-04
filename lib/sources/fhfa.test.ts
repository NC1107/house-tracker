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
