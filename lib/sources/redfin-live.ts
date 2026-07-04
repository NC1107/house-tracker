/**
 * Live for-sale listings via Redfin's unofficial `gis-csv` endpoint (the "Download all"
 * link on their search pages). Gray-area: no key, no official support; it can break or
 * rate-limit at any time, so every caller must degrade gracefully. Discovery endpoints
 * are bot-blocked, so state region ids were enumerated once via the region API and are
 * baked in below (Redfin region_type 4 = state).
 */
import { parseCsv } from "@/lib/ingest";

/** State name -> Redfin region_id (region_type=4). DC is listed by Redfin as "Columbia". */
export const REDFIN_STATE_REGION_IDS: Record<string, number> = {
  Alabama: 1, Missouri: 2, Alaska: 3, Montana: 4, Arizona: 5, Nebraska: 6, Arkansas: 7,
  Nevada: 8, California: 9, "New Hampshire": 10, Colorado: 11, "New Jersey": 12,
  Connecticut: 13, "New Mexico": 14, Delaware: 15, "New York": 16,
  "District of Columbia": 17, "North Carolina": 18, Florida: 19, "North Dakota": 20,
  Georgia: 21, Ohio: 22, Oklahoma: 23, Oregon: 24, Hawaii: 25, Pennsylvania: 26,
  Idaho: 27, "Rhode Island": 28, Illinois: 29, "South Carolina": 30, Indiana: 31,
  "South Dakota": 32, Iowa: 33, Tennessee: 34, Kansas: 35, Texas: 36, Kentucky: 37,
  Utah: 38, Louisiana: 39, Vermont: 40, Maine: 41, Virginia: 42, Maryland: 43,
  Washington: 44, Massachusetts: 45, "West Virginia": 46, Michigan: 47, Wisconsin: 48,
  Minnesota: 49, Wyoming: 50, Mississippi: 51,
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export interface LiveListing {
  address: string;
  city: string;
  state: string;
  zip: string;
  price: number;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  pricePerSqft: number | null;
  daysOnMarket: number | null;
  propertyType: string;
  url: string;
  /** MLS number when present; used to recognize a listing across runs. */
  mls: string;
}

/**
 * Search filters. Verified against the endpoint per-param (Wyoming test market):
 * num_beds / min_stories / basement_types / max_price / uipt all shrink result sets
 * server-side. Garage/parking params are IGNORED by this feed and the CSV has no
 * garage column, so garage cannot be filtered - don't offer it upstream.
 * Beds/baths are additionally re-checked client-side from the CSV as belt and braces.
 */
export interface ListingFilters {
  maxPrice?: number;
  minBeds?: number;
  minBaths?: number;
  minStories?: number;
  /** Require a basement (finished, partially finished, or unfinished). */
  basement?: boolean;
  /** Property types; defaults to houses + condos + townhouses + multi-family. */
  types?: ("house" | "condo" | "townhouse" | "multifamily")[];
}

const TYPE_CODES: Record<string, string> = { house: "1", condo: "2", townhouse: "3", multifamily: "4" };

/**
 * Fetch a sample of active listings for a state, optionally capped at a max price.
 * Returns [] on any failure (blocked, schema change, timeout) — callers show a notice.
 */
export async function fetchLiveListings(opts: {
  stateName: string;
  limit?: number;
} & ListingFilters): Promise<LiveListing[]> {
  const regionId = REDFIN_STATE_REGION_IDS[opts.stateName];
  if (!regionId) return [];
  const types = (opts.types?.length ? opts.types : ["house", "condo", "townhouse", "multifamily"])
    .map((t) => TYPE_CODES[t])
    .filter(Boolean);
  const params = new URLSearchParams({
    al: "1",
    num_homes: String(Math.min(opts.limit ?? 350, 350)),
    region_id: String(regionId),
    region_type: "4",
    status: "9", // active + coming soon
    uipt: types.join(","),
    sf: "1,2,3,5,6,7",
    v: "8",
  });
  if (opts.maxPrice && Number.isFinite(opts.maxPrice)) {
    params.set("max_price", String(Math.round(opts.maxPrice)));
  }
  if (opts.minBeds && opts.minBeds > 0) params.set("num_beds", String(opts.minBeds));
  if (opts.minBaths && opts.minBaths > 0) params.set("num_baths", String(opts.minBaths));
  if (opts.minStories && opts.minStories > 1) params.set("min_stories", String(opts.minStories));
  if (opts.basement) params.set("basement_types", "1,2,3"); // finished, unfinished, partial
  const url = `https://www.redfin.com/stingray/api/gis-csv?${params}`;

  let text: string;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/csv,*/*" },
      // Be polite to an unofficial endpoint: cache each query for 15 minutes.
      next: { revalidate: 900 },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    text = await res.text();
  } catch {
    return [];
  }

  const rows = parseCsv(text);
  const header = rows[0];
  if (!header) return [];
  const col = new Map(header.map((h, i) => [h.trim().toLowerCase(), i]));
  const need = (n: string) => col.get(n) ?? -1;
  const priceCol = need("price");
  const urlCol = [...col.keys()].find((k) => k.startsWith("url"));
  if (priceCol < 0 || !urlCol) return [];
  const urlIdx = col.get(urlCol)!;

  const num = (row: string[], name: string): number | null => {
    const i = need(name);
    if (i < 0) return null;
    const v = Number(row[i]);
    return Number.isFinite(v) && v > 0 ? v : null;
  };

  const out: LiveListing[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < header.length - 2) continue; // note/disclaimer rows
    const price = Number(row[priceCol]);
    if (!Number.isFinite(price) || price <= 0) continue;
    const beds = num(row, "beds");
    const baths = num(row, "baths");
    // Re-check what the CSV can prove, in case the endpoint ignores a param someday.
    if (opts.maxPrice && price > opts.maxPrice) continue;
    if (opts.minBeds && beds !== null && beds < opts.minBeds) continue;
    if (opts.minBaths && baths !== null && baths < opts.minBaths) continue;
    const sqft = num(row, "square feet");
    out.push({
      address: row[need("address")] ?? "",
      city: row[need("city")] ?? "",
      state: row[need("state or province")] ?? "",
      zip: row[need("zip or postal code")] ?? "",
      price,
      beds,
      baths,
      sqft,
      pricePerSqft: num(row, "$/square feet"),
      daysOnMarket: num(row, "days on market"),
      propertyType: row[need("property type")] ?? "",
      url: row[urlIdx] ?? "",
      mls: (row[need("mls#")] ?? "").trim(),
    });
  }
  return out.sort((a, b) => a.price - b.price);
}
