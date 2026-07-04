/**
 * Ingest Redfin CITY-level market metrics (inventory, months of supply, days on market,
 * sale-to-list, price drops, median sale price), enabling city-level Market Heat scores;
 * metros are too coarse for states like Maryland with only a handful of MSAs.
 * Run: DATABASE_URL=... npm run ingest:redfin-city
 *
 * The city tracker is ~1GB gzipped (~9GB text), streamed line by line. City geographies
 * are created on the fly (level "city", code = Redfin TABLE_ID, parented to the state).
 * History is bounded to REDFIN_CITY_SINCE (default 2019-01-01) to keep the table size
 * reasonable; export REDFIN_CITY_SINCE=1900-01-01 for everything.
 */
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { geographies } from "@/db/schema";
import { upsertSeries, type SeriesRow } from "@/lib/ingest";
import { REDFIN_METRIC_MAP } from "@/lib/sources/redfin";

const URL =
  "https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker/city_market_tracker.tsv000.gz";
const SINCE = process.env.REDFIN_CITY_SINCE ?? "2019-01-01";

function splitTsv(line: string): string[] {
  return line.split("\t").map((f) => (f.startsWith('"') && f.endsWith('"') ? f.slice(1, -1) : f));
}

interface PendingRow {
  tableId: string;
  cityName: string;
  stateAbbr: string;
  metricKey: string;
  periodDate: string;
  value: number;
}

async function main() {
  const db = getDb();
  const states = await db
    .select({ id: geographies.id, abbr: geographies.stateCode })
    .from(geographies)
    .where(sql`${geographies.level} = 'state'`);
  const stateByAbbr = new Map(states.filter((s) => s.abbr).map((s) => [s.abbr!.toUpperCase(), s.id]));
  console.log(`Loaded ${stateByAbbr.size} states; ingesting city data since ${SINCE}`);

  // Existing city geographies (code = Redfin TABLE_ID).
  const existing = await db
    .select({ id: geographies.id, code: geographies.code })
    .from(geographies)
    .where(sql`${geographies.level} = 'city'`);
  const cityIdByTableId = new Map(existing.map((c) => [c.code, c.id]));

  /** Insert any cities in the batch we haven't seen, then resolve all ids. */
  async function ensureCities(rows: PendingRow[]): Promise<void> {
    const missing = new Map<string, PendingRow>();
    for (const r of rows) {
      if (!cityIdByTableId.has(r.tableId)) missing.set(r.tableId, r);
    }
    if (!missing.size) return;
    const values = [...missing.values()]
      .map((r) => ({
        level: "city" as const,
        code: r.tableId,
        name: r.cityName,
        stateCode: r.stateAbbr,
        parentId: stateByAbbr.get(r.stateAbbr) ?? null,
      }))
      .filter((v) => v.parentId !== null);
    for (let i = 0; i < values.length; i += 500) {
      const chunk = values.slice(i, i + 500);
      const inserted = await db
        .insert(geographies)
        .values(chunk)
        .onConflictDoUpdate({
          target: [geographies.level, geographies.code],
          set: { name: sql`excluded.name` },
        })
        .returning({ id: geographies.id, code: geographies.code });
      for (const row of inserted) cityIdByTableId.set(row.code, row.id);
    }
  }

  const res = await fetch(URL);
  if (!res.ok || !res.body) throw new Error(`Redfin city tracker download failed: ${res.status}`);
  console.log(`Streaming ${URL}`);
  const rl = createInterface({
    input: Readable.fromWeb(res.body as import("node:stream/web").ReadableStream).pipe(createGunzip()),
    crlfDelay: Infinity,
  });

  let header: Map<string, number> | null = null;
  let metricCols: { idx: number; metricKey: string }[] = [];
  let regionCol = -1, typeCol = -1, propCol = -1, periodCol = -1, saCol = -1, stateCol = -1, tableIdCol = -1;

  let batch: PendingRow[] = [];
  let written = 0;
  let skippedOld = 0;

  const flush = async () => {
    if (!batch.length) return;
    await ensureCities(batch);
    const series: SeriesRow[] = [];
    for (const r of batch) {
      const geographyId = cityIdByTableId.get(r.tableId);
      if (geographyId === undefined) continue;
      series.push({ geographyId, metricKey: r.metricKey, periodDate: r.periodDate, freq: "monthly", value: r.value });
    }
    written += await upsertSeries(series);
    batch = [];
  };

  for await (const line of rl) {
    const row = splitTsv(line);
    if (!header) {
      header = new Map(row.map((h, i) => [h.trim().toLowerCase(), i]));
      regionCol = header.get("region") ?? -1;
      typeCol = header.get("region_type") ?? -1;
      propCol = header.get("property_type") ?? -1;
      periodCol = header.get("period_end") ?? -1;
      saCol = header.get("is_seasonally_adjusted") ?? -1;
      stateCol = header.get("state_code") ?? -1;
      tableIdCol = header.get("table_id") ?? -1;
      if ([regionCol, typeCol, propCol, periodCol, stateCol, tableIdCol].includes(-1)) {
        throw new Error("Redfin city file missing expected columns");
      }
      metricCols = Object.entries(REDFIN_METRIC_MAP)
        .filter(([c]) => header!.has(c))
        .map(([c, metricKey]) => ({ idx: header!.get(c)!, metricKey }));
      console.log(`Mapping ${metricCols.length} metric columns`);
      continue;
    }

    if ((row[typeCol] ?? "").trim().toLowerCase() !== "place") continue;
    if ((row[propCol] ?? "").trim().toLowerCase() !== "all residential") continue;
    if (saCol >= 0 && /^t/i.test((row[saCol] ?? "").trim())) continue;

    const periodDate = (row[periodCol] ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(periodDate)) continue;
    if (periodDate < SINCE) {
      skippedOld++;
      continue;
    }

    const stateAbbr = (row[stateCol] ?? "").trim().toUpperCase();
    if (!stateByAbbr.has(stateAbbr)) continue;
    const tableId = (row[tableIdCol] ?? "").trim();
    if (!tableId) continue;
    // REGION is "Champlin, MN"; store the bare city name.
    const cityName = (row[regionCol] ?? "").replace(/,\s*[A-Z]{2}$/, "").trim();
    if (!cityName) continue;

    for (const mc of metricCols) {
      const raw = row[mc.idx];
      if (raw === undefined || raw === "") continue;
      const value = Number(raw);
      if (!Number.isFinite(value)) continue;
      batch.push({ tableId, cityName, stateAbbr, metricKey: mc.metricKey, periodDate, value });
    }
    if (batch.length >= 20_000) await flush();
  }
  await flush();

  console.log(
    `Redfin city ingestion complete: ${written} observations across ${cityIdByTableId.size} cities ` +
      `(${skippedOld} pre-${SINCE} rows skipped; widen with REDFIN_CITY_SINCE)`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
