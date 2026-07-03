/**
 * FRED (Federal Reserve Economic Data) client.
 * Free API key: https://fred.stlouisfed.org/docs/api/api_key.html
 * Rate limit ~120 req/min. Returns observations for a single series.
 */
import type { SeriesPoint } from "@/lib/types";

const BASE = "https://api.stlouisfed.org/fred/series/observations";

export async function fetchFredSeries(
  seriesId: string,
  opts: { observationStart?: string } = {},
): Promise<SeriesPoint[]> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) throw new Error("FRED_API_KEY is not set");
  const params = new URLSearchParams({
    series_id: seriesId,
    api_key: apiKey,
    file_type: "json",
  });
  if (opts.observationStart) params.set("observation_start", opts.observationStart);

  const res = await fetch(`${BASE}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`FRED ${seriesId} failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as {
    observations: { date: string; value: string }[];
  };
  return data.observations
    .filter((o) => o.value !== "." && o.value !== "")
    .map((o) => ({ date: o.date, value: Number(o.value) }))
    .filter((p) => Number.isFinite(p.value));
}
