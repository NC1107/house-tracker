/**
 * Approximate US state tile-grid layout (row, col) for a lightweight choropleth without a
 * mapping library. 11 columns × 8 rows; positions are geographic-ish, not exact.
 */
export const TILE_GRID: Record<string, { r: number; c: number }> = {
  AK: { r: 0, c: 0 }, ME: { r: 0, c: 10 },
  VT: { r: 1, c: 9 }, NH: { r: 1, c: 10 },
  WA: { r: 2, c: 0 }, ID: { r: 2, c: 1 }, MT: { r: 2, c: 2 }, ND: { r: 2, c: 3 }, MN: { r: 2, c: 4 }, IL: { r: 2, c: 5 }, WI: { r: 2, c: 6 }, MI: { r: 2, c: 7 }, NY: { r: 2, c: 9 }, MA: { r: 2, c: 10 },
  OR: { r: 3, c: 0 }, NV: { r: 3, c: 1 }, WY: { r: 3, c: 2 }, SD: { r: 3, c: 3 }, IA: { r: 3, c: 4 }, IN: { r: 3, c: 5 }, OH: { r: 3, c: 6 }, PA: { r: 3, c: 7 }, NJ: { r: 3, c: 8 }, CT: { r: 3, c: 9 }, RI: { r: 3, c: 10 },
  CA: { r: 4, c: 0 }, UT: { r: 4, c: 1 }, CO: { r: 4, c: 2 }, NE: { r: 4, c: 3 }, MO: { r: 4, c: 4 }, KY: { r: 4, c: 5 }, WV: { r: 4, c: 6 }, VA: { r: 4, c: 7 }, MD: { r: 4, c: 8 }, DE: { r: 4, c: 9 },
  AZ: { r: 5, c: 0 }, NM: { r: 5, c: 1 }, KS: { r: 5, c: 2 }, AR: { r: 5, c: 3 }, TN: { r: 5, c: 4 }, NC: { r: 5, c: 5 }, SC: { r: 5, c: 6 }, DC: { r: 5, c: 7 },
  OK: { r: 6, c: 2 }, LA: { r: 6, c: 3 }, MS: { r: 6, c: 4 }, AL: { r: 6, c: 5 }, GA: { r: 6, c: 6 },
  HI: { r: 7, c: 0 }, TX: { r: 7, c: 2 }, FL: { r: 7, c: 6 },
};

export const TILE_COLS = 11;
export const TILE_ROWS = 8;
