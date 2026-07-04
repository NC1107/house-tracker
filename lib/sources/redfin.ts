/**
 * Redfin Data Center bulk download (state-level market tracker). Free, no key; a gzipped,
 * tab-separated file with one row per region/period/property-type. We ingest the
 * "All Residential" rows at the State level and map Redfin's columns to our metric_keys.
 *
 * See https://www.redfin.com/news/data-center/ for the file catalog. Redfin occasionally
 * adjusts columns, so ingestion resolves columns by header name (not fixed index).
 */
import { gunzipSync } from "node:zlib";

export const REDFIN_STATE_URL =
  "https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker/state_market_tracker.tsv000.gz";

/** Redfin column header -> our metric_key. Missing columns are skipped gracefully. */
export const REDFIN_METRIC_MAP: Record<string, string> = {
  inventory: "inventory",
  months_of_supply: "months_of_supply",
  median_dom: "days_on_market",
  avg_sale_to_list: "sale_to_list",
  price_drops: "price_drops_share",
  new_listings: "new_listings",
  median_sale_price: "median_sale_price",
};

export async function downloadGzTsv(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Redfin download failed: ${url} -> ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return gunzipSync(buf).toString("utf-8");
}
