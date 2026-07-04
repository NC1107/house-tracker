/**
 * Ingest the FHFA state house-price index (quarterly, 1975+) into metric_series as
 * `fhfa_hpi`. Run: DATABASE_URL=... npm run ingest:fhfa
 */
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { geographies } from "@/db/schema";
import { parseCsv, upsertSeries, type SeriesRow } from "@/lib/ingest";
import { FHFA_STATE_HPI_URL, quarterEndDate } from "@/lib/sources/fhfa";

async function main() {
  const db = getDb();
  const states = await db
    .select({ id: geographies.id, abbr: geographies.stateCode })
    .from(geographies)
    .where(sql`${geographies.level} = 'state'`);
  const abbrToId = new Map(states.filter((s) => s.abbr).map((s) => [s.abbr!.toUpperCase(), s.id]));
  console.log(`Loaded ${abbrToId.size} states`);

  console.log("Downloading FHFA state HPI...");
  const res = await fetch(FHFA_STATE_HPI_URL);
  if (!res.ok) throw new Error(`FHFA download failed: ${res.status}`);
  const rows = parseCsv(await res.text());

  const out: SeriesRow[] = [];
  for (const row of rows) {
    // No header row: [state, year, quarter, index]
    const geographyId = abbrToId.get((row[0] ?? "").trim().toUpperCase());
    if (geographyId === undefined) continue;
    const periodDate = quarterEndDate(Number(row[1]), Number(row[2]));
    if (!periodDate) continue;
    const value = Number(row[3]);
    if (!Number.isFinite(value)) continue;
    out.push({ geographyId, metricKey: "fhfa_hpi", periodDate, freq: "quarterly", value });
  }

  const written = await upsertSeries(out);
  console.log(`FHFA ingestion complete: ${written} observations upserted`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
