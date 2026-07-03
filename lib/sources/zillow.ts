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
  /** column holding the standardized region code we resolve against `geographies` */
  regionCodeCol: number;
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
export const ZILLOW_FILES: ZillowFile[] = [
  {
    metricKey: "zhvi_all",
    level: "zip",
    url: `${HOST}/zhvi/Zip_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv`,
    regionCodeCol: 2, // RegionName == ZIP for ZIP-level files
    dateColStart: 9,
    freq: "monthly",
  },
  {
    metricKey: "zhvi_all",
    level: "metro",
    url: `${HOST}/zhvi/Metro_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv`,
    regionCodeCol: 2,
    dateColStart: 5,
    freq: "monthly",
  },
  {
    metricKey: "zori",
    level: "zip",
    url: `${HOST}/zori/Zip_zori_uc_sfrcondomfr_sm_month.csv`,
    regionCodeCol: 2,
    dateColStart: 9,
    freq: "monthly",
  },
];

export async function downloadCsv(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Zillow download failed: ${url} -> ${res.status}`);
  return res.text();
}
