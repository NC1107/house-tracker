export type GeoLevel = "nation" | "state" | "metro" | "county" | "city" | "zip";

export type MetricFreq = "daily" | "weekly" | "monthly" | "quarterly" | "annual";

export interface SeriesPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

/** Display format for a metric value (chart axes/tooltips and header chips). */
export type ValueFormat = "usd" | "percent" | "percent2" | "index" | "number" | "months" | "ratio";
