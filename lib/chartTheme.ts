/**
 * Chart color constants (validated data-viz palette). Recharts needs concrete colors on
 * SVG attributes, so these are hex rather than CSS vars. Mid-tone hues chosen to read on
 * both light and dark surfaces; categorical pair (blue/orange) validated CVD-safe.
 */
export const CHART = {
  series1: "#2a78d6", // blue
  series2: "#eb6834", // orange
  series3: "#1baf7a", // aqua
  good: "#0ca30c",
  warning: "#f59e0b",
  critical: "#d03b3b",
  /** Neutral benchmark/reference lines. Magenta: CVD-validated against all three
      series hues and >=3:1 on both surfaces, and not a status color. */
  benchmark: "#d6409f",
  grid: "#cbd5e1",
  axis: "#94a3b8",
} as const;
