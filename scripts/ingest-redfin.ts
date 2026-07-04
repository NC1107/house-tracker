/**
 * Ingest Redfin state-level market metrics (inventory, months of supply, days on market,
 * sale-to-list, price drops, median sale price) into metric_series.
 * Run: DATABASE_URL=... npm run ingest:redfin
 *
 * Columns are resolved by header name so a Redfin schema tweak doesn't silently break this.
 */
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { geographies } from "@/db/schema";
import { parseCsv, upsertSeries, type SeriesRow } from "@/lib/ingest";
import { REDFIN_STATE_URL, REDFIN_METRIC_MAP, downloadGzTsv } from "@/lib/sources/redfin";

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

  console.log("Downloading Redfin state market tracker...");
  const text = await downloadGzTsv(REDFIN_STATE_URL);
  const rows = parseCsv(text, "\t");
  const header = rows[0];
  if (!header) throw new Error("Empty Redfin file");

  const col = new Map(header.map((h, i) => [h.trim(), i]));
  const needed = ["period_end", "region_type", "property_type"];
  for (const n of needed) {
    if (!col.has(n)) throw new Error(`Redfin file missing expected column "${n}"`);
  }
  const stateCodeCol = col.get("state_code") ?? col.get("state");
  if (stateCodeCol === undefined) throw new Error("Redfin file missing state_code/state column");

  const metricCols = Object.entries(REDFIN_METRIC_MAP)
    .filter(([redfinCol]) => col.has(redfinCol))
    .map(([redfinCol, metricKey]) => ({ idx: col.get(redfinCol)!, metricKey }));
  console.log(`Mapping ${metricCols.length} metric columns`);

  const out: SeriesRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row[col.get("region_type")!] !== "State") continue;
    if (row[col.get("property_type")!] !== "All Residential") continue;

    const abbr = (row[stateCodeCol] ?? "").trim().toUpperCase();
    const geographyId = abbrToId.get(abbr);
    if (geographyId === undefined) continue;

    const periodDate = (row[col.get("period_end")!] ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(periodDate)) continue;

    for (const mc of metricCols) {
      const raw = row[mc.idx];
      if (raw === undefined || raw === "") continue;
      const value = Number(raw);
      if (!Number.isFinite(value)) continue;
      out.push({ geographyId, metricKey: mc.metricKey, periodDate, freq: "monthly", value });
    }
  }

  const written = await upsertSeries(out);
  console.log(`Redfin ingestion complete: ${written} observations upserted`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
