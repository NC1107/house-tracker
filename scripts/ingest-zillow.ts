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
import { ZILLOW_FILES, downloadCsv } from "@/lib/sources/zillow";
import { parseCsv, wideToLong, upsertSeries, loadGeoIndex, loadGeoIndexByName } from "@/lib/ingest";

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
  console.log("Zillow ingestion complete.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
