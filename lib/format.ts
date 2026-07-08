import type { ValueFormat } from "@/lib/types";

export const usd = (n: number, digits = 0): string =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });

export const pct = (fraction: number, digits = 1): string =>
  `${(fraction * 100).toFixed(digits)}%`;

export const num = (n: number): string => n.toLocaleString("en-US");

/** Compact single-value formatting matching each chart's ValueFormat. */
export function formatMetric(v: number, format: ValueFormat): string {
  switch (format) {
    case "usd":
      return usd(v);
    case "percent":
      return `${v.toFixed(1)}%`;
    case "percent2":
      return `${v.toFixed(2)}%`;
    case "index":
      return v.toFixed(0);
    case "months":
      return `${v.toFixed(1)} mo`;
    case "ratio":
      return `${v.toFixed(1)}×`;
    default:
      return num(v);
  }
}
