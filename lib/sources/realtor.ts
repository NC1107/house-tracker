/**
 * Realtor.com Research Data (monthly inventory core metrics). Free CSV, no key; one row
 * per state per month with listing-side stats: asking prices, new/active listing counts,
 * price cuts, and pending ratio. Complements Redfin's closed-sales view with what buyers
 * actually see on the market today.
 *
 * Catalog: https://www.realtor.com/research/data/ (files under econdata S3).
 * Columns are resolved by header name; the trailing quality_flag column is ignored.
 */

export const REALTOR_STATE_HISTORY_URL =
  "https://econdata.s3-us-west-2.amazonaws.com/Reports/Core/RDC_Inventory_Core_Metrics_State_History.csv";

/** Realtor.com column header -> our metric_key. Missing columns are skipped gracefully. */
export const REALTOR_METRIC_MAP: Record<string, string> = {
  median_listing_price: "median_list_price",
  new_listing_count: "realtor_new_listings",
  pending_ratio: "pending_ratio",
};

/** "202606" -> "2026-06-01" (first of month); null if not a valid yyyymm. */
export function yyyymmToDate(raw: string): string | null {
  const m = /^(\d{4})(\d{2})$/.exec(raw.trim());
  if (!m) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return `${m[1]}-${m[2]}-01`;
}

export async function downloadCsv(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Realtor.com download failed: ${url} -> ${res.status}`);
  return res.text();
}
