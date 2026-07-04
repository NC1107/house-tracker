/**
 * Shared ingestion helpers: chunked upserts into metric_series and simple CSV parsing.
 * Used by the scripts/ingest-*.ts entry points (run via `tsx` in a GitHub Action).
 */
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { metricSeries, geographies } from "@/db/schema";
import type { MetricFreq } from "@/lib/types";

export interface SeriesRow {
  geographyId: number;
  metricKey: string;
  periodDate: string; // YYYY-MM-DD
  freq: MetricFreq;
  value: number;
}

/**
 * Deduplicate rows by conflict key (geography_id, metric_key, period_date), keeping the
 * last occurrence. Postgres' ON CONFLICT DO UPDATE errors ("cannot affect row a second
 * time") if a single batch contains two rows with the same key — which an upstream schema
 * hiccup (a repeated region/date) can produce — so we collapse them before insert.
 */
export function dedupeByKey(rows: SeriesRow[]): SeriesRow[] {
  const map = new Map<string, SeriesRow>();
  for (const r of rows) map.set(`${r.geographyId}|${r.metricKey}|${r.periodDate}`, r);
  return [...map.values()];
}

/** Plausible value ranges per metric; a median outside these logs a warning (unit drift). */
const METRIC_SANITY: Record<string, [number, number]> = {
  price_drops_share: [0, 1],
  sale_to_list: [0.7, 1.3],
  months_of_supply: [0, 60],
  mortgage_30yr: [0, 25],
  mortgage_30yr_daily: [0, 25],
};

function median(nums: number[]): number {
  if (!nums.length) return NaN;
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** Warn (don't throw) if a metric's values look out of range — catches unit changes early. */
export function sanityCheck(rows: SeriesRow[]): void {
  const byKey = new Map<string, number[]>();
  for (const r of rows) {
    const range = METRIC_SANITY[r.metricKey];
    if (!range) continue;
    (byKey.get(r.metricKey) ?? byKey.set(r.metricKey, []).get(r.metricKey)!).push(r.value);
  }
  for (const [key, vals] of byKey) {
    const m = median(vals);
    const [lo, hi] = METRIC_SANITY[key];
    if (Number.isFinite(m) && (m < lo || m > hi)) {
      console.warn(`[ingest] SANITY: ${key} median ${m} outside expected [${lo}, ${hi}] — unit drift?`);
    }
  }
}

/**
 * Upsert observations in batches, updating value on conflict of
 * (geography_id, metric_key, period_date). Skips NaN/nullish values and de-dupes the batch.
 */
export async function upsertSeries(rows: SeriesRow[], batchSize = 1000): Promise<number> {
  const db = getDb();
  const clean = dedupeByKey(rows.filter((r) => Number.isFinite(r.value)));
  sanityCheck(clean);
  let written = 0;
  for (let i = 0; i < clean.length; i += batchSize) {
    const batch = clean.slice(i, i + batchSize);
    await db
      .insert(metricSeries)
      .values(batch)
      .onConflictDoUpdate({
        target: [metricSeries.geographyId, metricSeries.metricKey, metricSeries.periodDate],
        set: { value: sql`excluded.value` },
      });
    written += batch.length;
  }
  return written;
}

/** In-memory index of geography code -> id for a level, to resolve rows during ingest. */
export async function loadGeoIndex(level: string): Promise<Map<string, number>> {
  const db = getDb();
  const rows = await db
    .select({ id: geographies.id, code: geographies.code })
    .from(geographies)
    .where(sql`${geographies.level} = ${level}`);
  return new Map(rows.map((r) => [r.code, r.id]));
}

/** In-memory index of geography name (lowercased) -> id, for sources keyed by region name. */
export async function loadGeoIndexByName(level: string): Promise<Map<string, number>> {
  const db = getDb();
  const rows = await db
    .select({ id: geographies.id, name: geographies.name })
    .from(geographies)
    .where(sql`${geographies.level} = ${level}`);
  return new Map(rows.map((r) => [r.name.trim().toLowerCase(), r.id]));
}

/**
 * Minimal RFC-4180-ish CSV parser (handles quoted fields with embedded commas/newlines).
 * Good enough for the well-formed research CSVs we ingest; swap for a streaming parser
 * if a file grows beyond memory.
 */
export function parseCsv(text: string, delimiter = ","): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      // ignore; handled by \n
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * Reshape a Zillow/Realtor wide CSV (region rows, date columns) into long observations.
 * `dateColStart` is the first column index that is a date; earlier columns are metadata.
 */
export function wideToLong(
  header: string[],
  dataRows: string[][],
  opts: {
    regionCodeCol: number;
    dateColStart: number;
    metricKey: string;
    freq: MetricFreq;
    resolveGeoId: (code: string) => number | undefined;
  },
): SeriesRow[] {
  const out: SeriesRow[] = [];
  const dateCols = header
    .map((h, idx) => ({ h, idx }))
    .filter((c) => c.idx >= opts.dateColStart && /^\d{4}-\d{2}-\d{2}$/.test(c.h));
  for (const row of dataRows) {
    const code = row[opts.regionCodeCol];
    const geographyId = opts.resolveGeoId(code);
    if (geographyId === undefined) continue;
    for (const { h, idx } of dateCols) {
      const raw = row[idx];
      if (raw === undefined || raw === "") continue;
      const value = Number(raw);
      if (!Number.isFinite(value)) continue;
      out.push({ geographyId, metricKey: opts.metricKey, periodDate: h, freq: opts.freq, value });
    }
  }
  return out;
}
