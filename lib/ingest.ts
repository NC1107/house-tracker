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
 * Upsert observations in batches, updating value on conflict of
 * (geography_id, metric_key, period_date). Skips NaN/nullish values.
 */
export async function upsertSeries(rows: SeriesRow[], batchSize = 1000): Promise<number> {
  const db = getDb();
  const clean = rows.filter((r) => Number.isFinite(r.value));
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
