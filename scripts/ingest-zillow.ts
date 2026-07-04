/**
 * Ingest Zillow ZHVI / ZORI bulk CSVs into metric_series (wide -> long).
 * Run: DATABASE_URL=... npm run ingest:zillow
 *
 * For large ZIP files this streams the whole file into memory then reshapes; fine for a
 * GitHub Action runner. If memory becomes an issue, filter dataRows to watched/seeded
 * geographies before reshaping.
 */
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { geographies } from "@/db/schema";
import { ZILLOW_FILES, ZILLOW_FORECAST_URL, downloadCsv } from "@/lib/sources/zillow";
import { parseCsv, wideToLong, upsertSeries, loadGeoIndex, loadGeoIndexByName, type SeriesRow } from "@/lib/ingest";

/**
 * Seed metro (MSA) geographies from a Zillow metro file's metadata rows
 * (RegionID, RegionName, RegionType, StateName), parented to their primary state.
 */
async function seedMetros(dataRows: string[][]): Promise<number> {
  const db = getDb();
  const states = await db
    .select({ id: geographies.id, abbr: geographies.stateCode })
    .from(geographies)
    .where(sql`${geographies.level} = 'state'`);
  const abbrToId = new Map(states.filter((s) => s.abbr).map((s) => [s.abbr as string, s.id]));

  const values = dataRows
    .filter((r) => r[3] === "msa" && r[0])
    .map((r) => {
      const abbr = (r[4] ?? "").trim();
      return {
        level: "metro" as const,
        code: r[0],
        name: r[2],
        stateCode: abbr || null,
        parentId: abbrToId.get(abbr) ?? null,
      };
    });

  for (let i = 0; i < values.length; i += 500) {
    await db
      .insert(geographies)
      .values(values.slice(i, i + 500))
      .onConflictDoUpdate({
        target: [geographies.level, geographies.code],
        set: { name: sql`excluded.name`, stateCode: sql`excluded.state_code`, parentId: sql`excluded.parent_id` },
      });
  }
  return values.length;
}

async function main() {
  for (const file of ZILLOW_FILES) {
    console.log(`Downloading ${file.metricKey} @ ${file.level} ...`);
    let text: string;
    try {
      text = await downloadCsv(file.url);
    } catch (e) {
      console.warn(`  skipped ${file.metricKey}/${file.level}: ${(e as Error).message}`);
      continue;
    }
    const rows = parseCsv(text);
    const [header, ...dataRows] = rows;
    if (!header) {
      console.warn(`Empty file for ${file.url}, skipping`);
      continue;
    }

    // Metros aren't pre-seeded — create them from this file's metadata first.
    if (file.level === "metro") {
      const seeded = await seedMetros(dataRows);
      console.log(`  seeded/updated ${seeded} metros`);
    }

    const geoIndex =
      file.resolveBy === "name"
        ? await loadGeoIndexByName(file.level)
        : await loadGeoIndex(file.level);
    const long = wideToLong(header, dataRows, {
      regionCodeCol: file.regionCodeCol,
      dateColStart: file.dateColStart,
      metricKey: file.metricKey,
      freq: file.freq,
      resolveGeoId: (code) => geoIndex.get(file.resolveBy === "name" ? code.trim().toLowerCase() : code),
    });

    const written = await upsertSeries(long);
    console.log(`  ${file.metricKey}/${file.level}: ${written} observations upserted`);
  }
  await ingestForecast();
  console.log("Zillow ingestion complete.");
  process.exit(0);
}

/**
 * 12-month home-value forecast (% growth) for metros + the nation, stored at BaseDate so
 * each month's published forecast becomes one observation.
 */
async function ingestForecast() {
  console.log("Downloading zhvf_forecast @ metro ...");
  let text: string;
  try {
    text = await downloadCsv(ZILLOW_FORECAST_URL);
  } catch (e) {
    console.warn(`  skipped zhvf_forecast: ${(e as Error).message}`);
    return;
  }
  const [header, ...dataRows] = parseCsv(text);
  if (!header) return;
  const col = new Map(header.map((h, i) => [h.trim().toLowerCase(), i]));
  const idCol = col.get("regionid");
  const typeCol = col.get("regiontype");
  const baseCol = col.get("basedate");
  if (idCol === undefined || typeCol === undefined || baseCol === undefined) {
    console.warn("  zhvf file missing RegionID/RegionType/BaseDate, skipping");
    return;
  }
  const yearAheadCol = header.length - 1; // horizons are ordered; last = 12 months out

  const db = getDb();
  const metroIndex = await loadGeoIndex("metro");
  const [nation] = await db
    .select({ id: geographies.id })
    .from(geographies)
    .where(sql`${geographies.level} = 'nation'`)
    .limit(1);

  const out: SeriesRow[] = [];
  for (const row of dataRows) {
    const type = (row[typeCol] ?? "").trim().toLowerCase();
    const geographyId = type === "country" ? nation?.id : type === "msa" ? metroIndex.get(row[idCol]) : undefined;
    if (geographyId === undefined) continue;
    const periodDate = (row[baseCol] ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(periodDate)) continue;
    const value = Number(row[yearAheadCol]);
    if (!Number.isFinite(value)) continue;
    out.push({ geographyId, metricKey: "zhvf_forecast", periodDate, freq: "monthly", value });
  }
  const written = await upsertSeries(out);
  console.log(`  zhvf_forecast: ${written} observations upserted`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
