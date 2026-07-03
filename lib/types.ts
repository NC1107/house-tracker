export type GeoLevel = "nation" | "state" | "metro" | "county" | "city" | "zip";

export type MetricFreq = "daily" | "weekly" | "monthly" | "quarterly" | "annual";

export interface SeriesPoint {
  date: string; // YYYY-MM-DD
  value: number;
}
