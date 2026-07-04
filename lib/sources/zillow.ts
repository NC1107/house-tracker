/**
 * Zillow Research bulk-CSV endpoints (no API key, direct file URLs).
 * Files are wide-format: metadata columns + one column per month (YYYY-MM-DD headers).
 * See https://www.zillow.com/research/data/ for the current file catalog.
 *
 * NOTE: Zillow occasionally renames files; keep these URLs in one place so a break is a
 * one-line fix. Metric coverage before the Oct-2022 methodology change is not comparable
 * for some series — flag downstream if needed.
 */
export interface ZillowFile {
  /** our metric_key */
  metricKey: string;
  /** geography level the file is cut at */
  level: "zip" | "county" | "metro" | "state";
  url: string;
  /** column holding the region identifier we resolve against `geographies` */
  regionCodeCol: number;
  /** how to match the region column to a geography row: by our `code` or by `name` */
  resolveBy: "code" | "name";
  /** first column index that is a date */
  dateColStart: number;
  freq: "monthly";
}

const HOST = "https://files.zillowstatic.com/research/public_csvs";

/**
 * A starter set. ZHVI (all homes, mid-tier, smoothed+SA) and ZORI at ZIP and metro.
 * RegionID/RegionName/SizeRank precede geography-identifying columns; for ZIP files the
 * standardized code is the ZIP itself (RegionName). Column indices below match Zillow's
 * current wide-CSV layout and may need adjustment when a file's header changes.
 */
/**
 * Active files. Currently state-level ZHVI (home values), resolved by state name — this
 * populates the Region Explorer's state view. Zillow does not publish ZORI at the state
 * level (only metro/ZIP), and metro/ZIP ZHVI/ZORI files are large and require metro/ZIP
 * geographies to be seeded first (via the HUD crosswalk) — add those entries once that
 * seeding lands.
 */
export const ZILLOW_FILES: ZillowFile[] = [
  {
    metricKey: "zhvi_all",
    level: "state",
    url: `${HOST}/zhvi/State_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv`,
    regionCodeCol: 2, // RegionName == state name
    resolveBy: "name",
    dateColStart: 5,
    freq: "monthly",
  },
  // Metro (MSA) level. Metros are seeded from the metadata in these files during ingestion
  // (RegionID/RegionName/StateName), then metrics resolve by RegionID.
  {
    metricKey: "zhvi_all",
    level: "metro",
    url: `${HOST}/zhvi/Metro_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv`,
    regionCodeCol: 0, // RegionID
    resolveBy: "code",
    dateColStart: 5,
    freq: "monthly",
  },
  {
    metricKey: "zori",
    level: "metro",
    url: `${HOST}/zori/Metro_zori_uc_sfrcondomfr_sm_sa_month.csv`,
    regionCodeCol: 0,
    resolveBy: "code",
    dateColStart: 5,
    freq: "monthly",
  },
];

export async function downloadCsv(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Zillow download failed: ${url} -> ${res.status}`);
  return res.text();
}
