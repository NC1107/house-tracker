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

export type { CityRegion } from "@/lib/sources/redfin-cities";
import { REDFIN_CITY_REGION_IDS, type CityRegion } from "@/lib/sources/redfin-cities";

/** Parse /city/{id}/{ST}/{Slug} links out of a Redfin state-page HTML blob. */
export function parseCityLinks(html: string): CityRegion[] {
  const out = new Map<string, CityRegion>();
  for (const m of html.matchAll(/\/city\/(\d+)\/[A-Z]{2}\/([A-Za-z0-9-]+)/g)) {
    const name = m[2].replace(/-/g, " ");
    // A city can appear under two ids (boundary variants); keep the first seen.
    if (!out.has(name.toLowerCase())) out.set(name.toLowerCase(), { id: Number(m[1]), name });
  }
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Major cities (with Redfin region ids) for a state. Served from the baked map
 * (scripts/generate-redfin-cities.mjs): Redfin's HTML pages sit behind an AWS WAF
 * challenge that rejects Node's HTTP stack at runtime, and the ids are stable anyway.
 * Covers the ~25 biggest markets per state; smaller towns fall back to client-side
 * name filtering of the state search.
 */
export async function fetchStateCities(stateName: string): Promise<CityRegion[]> {
  return REDFIN_CITY_REGION_IDS[stateName] ?? [];
}

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
  /** Primary listing photo (Redfin CDN) when derivable; null otherwise. */
  photoUrl: string | null;
  yearBuilt: number | null;
}

/**
 * Search filters. Verified against the endpoint per-param (Wyoming test market):
 * num_beds / min_stories / basement_types / max_price / uipt all shrink result sets
 * server-side. Garage/parking params are IGNORED by this feed and the CSV has no
 * garage column, so garage cannot be filtered - don't offer it upstream.
 * Beds/baths are additionally re-checked client-side from the CSV as belt and braces.
 */
export interface ListingFilters {
  /** Floors out $1 "auction teaser" listings, which are otherwise indistinguishable. */
  minPrice?: number;
  maxPrice?: number;
  minBeds?: number;
  minBaths?: number;
  minStories?: number;
  minSqft?: number;
  maxSqft?: number;
  minYearBuilt?: number;
  maxYearBuilt?: number;
  /** Minimum lot size in sqft (server param unverified, so re-checked client-side). */
  minLotSqft?: number;
  /** Require a basement (finished, partially finished, or unfinished). */
  basement?: boolean;
  /** Property types; defaults to houses + condos + townhouses + multi-family. */
  types?: ("house" | "condo" | "townhouse" | "multifamily")[];
  /** Search a specific city (Redfin region id, region_type 6) instead of the whole state. */
  cityRegionId?: number;
  /** Fallback for cities without a known region id: filter results by city name. */
  cityName?: string;
}

const TYPE_CODES: Record<string, string> = { house: "1", condo: "2", townhouse: "3", multifamily: "4" };

function searchParams(opts: { stateName: string; limit?: number } & ListingFilters): URLSearchParams | null {
  const regionId = REDFIN_STATE_REGION_IDS[opts.stateName];
  if (!regionId) return null;
  const types = (opts.types?.length ? opts.types : ["house", "condo", "townhouse", "multifamily"])
    .map((t) => TYPE_CODES[t])
    .filter(Boolean);
  const params = new URLSearchParams({
    al: "1",
    num_homes: String(Math.min(opts.limit ?? 350, 350)),
    region_id: String(opts.cityRegionId ?? regionId),
    region_type: opts.cityRegionId ? "6" : "4",
    status: "9", // active + coming soon
    uipt: types.join(","),
    sf: "1,2,3,5,6,7",
    v: "8",
    // The filter params below are IGNORED unless these site-companion params ride along.
    ord: "price-asc",
    mpt: "99",
    sp: "true",
  });
  if (opts.maxPrice && Number.isFinite(opts.maxPrice)) {
    params.set("max_price", String(Math.round(opts.maxPrice)));
  }
  if (opts.minPrice && opts.minPrice > 0) params.set("min_price", String(Math.round(opts.minPrice)));
  if (opts.minBeds && opts.minBeds > 0) params.set("num_beds", String(opts.minBeds));
  if (opts.minBaths && opts.minBaths > 0) params.set("num_baths", String(opts.minBaths));
  if (opts.minStories && opts.minStories > 1) params.set("min_stories", String(opts.minStories));
  if (opts.minSqft && opts.minSqft > 0) params.set("min_listing_approx_size", String(opts.minSqft));
  if (opts.maxSqft && opts.maxSqft > 0) params.set("max_listing_approx_size", String(opts.maxSqft));
  if (opts.minYearBuilt && opts.minYearBuilt > 0) params.set("min_year_built", String(opts.minYearBuilt));
  if (opts.maxYearBuilt && opts.maxYearBuilt > 0) params.set("max_year_built", String(opts.maxYearBuilt));
  if (opts.minLotSqft && opts.minLotSqft > 0) params.set("min_parcel_size", String(opts.minLotSqft));
  if (opts.basement) params.set("basement_types", "1,2,3"); // finished, unfinished, partial
  return params;
}

/** Primary photo on Redfin's CDN, derived from the listing's data source + MLS number. */
function photoUrlFor(dataSourceId: unknown, mls: string, numPictures: unknown): string | null {
  const ds = Number(dataSourceId);
  if (!Number.isFinite(ds) || !mls || !Number(numPictures)) return null;
  const clean = mls.trim();
  if (!/^[A-Za-z0-9._-]+$/.test(clean)) return null;
  return `https://ssl.cdn-redfin.com/photo/${ds}/bigphoto/${clean.slice(-3)}/${clean}_0.jpg`;
}

/**
 * Fetch a sample of active listings for a state matching the filters.
 * Primary path is the JSON search endpoint (has photo metadata); the CSV export is the
 * fallback (no photos). Returns [] on total failure — callers show a notice.
 */
export async function fetchLiveListings(opts: {
  stateName: string;
  limit?: number;
} & ListingFilters): Promise<LiveListing[]> {
  const params = searchParams(opts);
  if (!params) return [];
  const fromJson = await fetchViaJson(params, opts);
  const results = fromJson.length > 0 ? fromJson : await fetchViaCsv(params, opts);
  if (opts.cityName && !opts.cityRegionId) {
    const want = opts.cityName.trim().toLowerCase();
    return results.filter((l) => l.city.trim().toLowerCase() === want);
  }
  return results;
}

interface GisHome {
  streetLine?: { value?: string };
  city?: string;
  state?: string;
  postalCode?: { value?: string };
  price?: { value?: number };
  beds?: number;
  baths?: number;
  sqFt?: { value?: number };
  pricePerSqFt?: { value?: number };
  dom?: { value?: number };
  propertyType?: number;
  uiPropertyType?: number;
  url?: string;
  mlsId?: { value?: string };
  dataSourceId?: number;
  numPictures?: number;
  yearBuilt?: { value?: number } | number;
  lotSize?: { value?: number };
}

const UI_PROPERTY_TYPES: Record<number, string> = {
  1: "House",
  2: "Condo",
  3: "Townhouse",
  4: "Multi-family",
  5: "Land",
  6: "Other",
};

async function fetchViaJson(
  params: URLSearchParams,
  opts: ListingFilters,
): Promise<LiveListing[]> {
  let homes: GisHome[];
  try {
    const res = await fetch(`https://www.redfin.com/stingray/api/gis?${params}`, {
      headers: { "User-Agent": UA, Accept: "application/json,*/*" },
      // Be polite to an unofficial endpoint: cache each query for 15 minutes.
      next: { revalidate: 900 },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const text = await res.text();
    const parsed = JSON.parse(text.replace(/^\{\}&&/, ""));
    homes = parsed?.payload?.homes ?? [];
  } catch {
    return [];
  }

  const out: LiveListing[] = [];
  for (const h of homes) {
    const price = Number(h.price?.value);
    if (!Number.isFinite(price) || price <= 0) continue;
    const beds = Number.isFinite(Number(h.beds)) && Number(h.beds) > 0 ? Number(h.beds) : null;
    const baths = Number.isFinite(Number(h.baths)) && Number(h.baths) > 0 ? Number(h.baths) : null;
    // Re-check what the payload can prove, in case the endpoint ignores a param someday.
    if (opts.maxPrice && price > opts.maxPrice) continue;
    if (opts.minPrice && price < opts.minPrice) continue;
    if (opts.minBeds && beds !== null && beds < opts.minBeds) continue;
    if (opts.minBaths && baths !== null && baths < opts.minBaths) continue;
    const sqftVal = Number(h.sqFt?.value) > 0 ? Number(h.sqFt?.value) : null;
    if (opts.minSqft && sqftVal !== null && sqftVal < opts.minSqft) continue;
    if (opts.maxSqft && sqftVal !== null && sqftVal > opts.maxSqft) continue;
    const lotVal = Number(h.lotSize?.value) > 0 ? Number(h.lotSize?.value) : null;
    if (opts.minLotSqft && (lotVal === null || lotVal < opts.minLotSqft)) continue;
    const yb = typeof h.yearBuilt === "object" ? Number(h.yearBuilt?.value) : Number(h.yearBuilt);
    if (opts.minYearBuilt && Number.isFinite(yb) && yb > 0 && yb < opts.minYearBuilt) continue;
    if (opts.maxYearBuilt && Number.isFinite(yb) && yb > 0 && yb > opts.maxYearBuilt) continue;
    const mls = (h.mlsId?.value ?? "").trim();
    const yearBuilt = yb;
    out.push({
      address: h.streetLine?.value ?? "",
      city: h.city ?? "",
      state: h.state ?? "",
      zip: h.postalCode?.value ?? "",
      price,
      beds,
      baths,
      sqft: Number(h.sqFt?.value) > 0 ? Number(h.sqFt?.value) : null,
      pricePerSqft: Number(h.pricePerSqFt?.value) > 0 ? Number(h.pricePerSqFt?.value) : null,
      daysOnMarket: Number(h.dom?.value) > 0 ? Number(h.dom?.value) : null,
      propertyType: UI_PROPERTY_TYPES[Number(h.uiPropertyType)] ?? "",
      url: h.url ? `https://www.redfin.com${h.url}` : "",
      mls,
      photoUrl: photoUrlFor(h.dataSourceId, mls, h.numPictures),
      yearBuilt: Number.isFinite(yearBuilt) && yearBuilt > 0 ? yearBuilt : null,
    });
  }
  return out.sort((a, b) => a.price - b.price);
}

/** CSV fallback (the "Download all" export): same filters, no photo metadata. */
async function fetchViaCsv(params: URLSearchParams, opts: ListingFilters): Promise<LiveListing[]> {
  let text: string;
  try {
    const res = await fetch(`https://www.redfin.com/stingray/api/gis-csv?${params}`, {
      headers: { "User-Agent": UA, Accept: "text/csv,*/*" },
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
      photoUrl: null,
      yearBuilt: num(row, "year built"),
    });
  }
  return out.sort((a, b) => a.price - b.price);
}
