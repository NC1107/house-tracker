/**
 * Ingest Realtor.com state-level listing metrics (median asking price, new listings,
 * pending ratio) into metric_series.
 * Run: DATABASE_URL=... npm run ingest:realtor
 *
 * Columns are resolved by header name so a schema tweak doesn't silently break this.
 */
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { geographies } from "@/db/schema";
import { parseCsv, upsertSeries, type SeriesRow } from "@/lib/ingest";
import {
  REALTOR_STATE_HISTORY_URL,
  REALTOR_METRIC_MAP,
  yyyymmToDate,
  downloadCsv,
} from "@/lib/sources/realtor";

async function stateAbbrIndex(): Promise<Map<string, number>> {
  const db = getDb();
  const rows = await db
    .select({ id: geographies.id, abbr: geographies.stateCode })
    .from(geographies)
    .where(sql`${geographies.level} = 'state'`);
  const m = new Map<string, number>();
  for (const r of rows) if (r.abbr) m.set(r.abbr.toUpperCase(), r.id);
  return m;
}

async function main() {
  const abbrToId = await stateAbbrIndex();
  console.log(`Loaded ${abbrToId.size} states`);

  console.log("Downloading Realtor.com state inventory history...");
  const text = await downloadCsv(REALTOR_STATE_HISTORY_URL);
  const rows = parseCsv(text);
  const header = rows[0];
  if (!header) throw new Error("Empty Realtor.com file");

  const col = new Map(header.map((h, i) => [h.trim().toLowerCase(), i]));
  for (const n of ["month_date_yyyymm", "state_id"]) {
    if (!col.has(n)) throw new Error(`Realtor.com file missing expected column "${n}"`);
  }
  const monthCol = col.get("month_date_yyyymm")!;
  const stateCol = col.get("state_id")!;

  const metricCols = Object.entries(REALTOR_METRIC_MAP)
    .filter(([realtorCol]) => col.has(realtorCol))
    .map(([realtorCol, metricKey]) => ({ idx: col.get(realtorCol)!, metricKey }));
  console.log(`Mapping ${metricCols.length} metric columns`);

  const out: SeriesRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    // The file ends with a free-text note row; the yyyymm guard drops it.
    const periodDate = yyyymmToDate(row[monthCol] ?? "");
    if (!periodDate) continue;

    const abbr = (row[stateCol] ?? "").trim().toUpperCase();
    const geographyId = abbrToId.get(abbr);
    if (geographyId === undefined) continue;

    for (const mc of metricCols) {
      const raw = row[mc.idx];
      if (raw === undefined || raw === "") continue;
      const value = Number(raw);
      if (!Number.isFinite(value)) continue;
      out.push({ geographyId, metricKey: mc.metricKey, periodDate, freq: "monthly", value });
    }
  }

  const written = await upsertSeries(out);
  console.log(`Realtor.com ingestion complete: ${written} observations upserted`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
