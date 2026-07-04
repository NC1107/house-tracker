/**
 * Ingest the Freddie Mac House Price Index (FMHPI): monthly, state-level, since 1975.
 * Free CSV, no key. Complements FHFA (quarterly) with monthly granularity.
 * Run: DATABASE_URL=... npm run ingest:fmhpi
 *
 * File columns: Year,Month,GEO_Type,GEO_Name,GEO_Code,Index_NSA,Index_SA
 * We store the seasonally-adjusted index for GEO_Type=State as `fmhpi`.
 */
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { geographies } from "@/db/schema";
import { parseCsv, upsertSeries, type SeriesRow } from "@/lib/ingest";

export const FMHPI_URL = "https://www.freddiemac.com/fmac-resources/research/docs/fmhpi_master_file.csv";

function monthEnd(year: number, month: number): string | null {
  if (!Number.isInteger(year) || year < 1900 || month < 1 || month > 12) return null;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${lastDay}`;
}

async function main() {
  const db = getDb();
  const states = await db
    .select({ id: geographies.id, abbr: geographies.stateCode })
    .from(geographies)
    .where(sql`${geographies.level} = 'state'`);
  const abbrToId = new Map(states.filter((s) => s.abbr).map((s) => [s.abbr!.toUpperCase(), s.id]));
  console.log(`Loaded ${abbrToId.size} states`);

  console.log("Downloading Freddie Mac FMHPI...");
  const res = await fetch(FMHPI_URL);
  if (!res.ok) throw new Error(`FMHPI download failed: ${res.status}`);
  const rows = parseCsv(await res.text());
  const header = rows[0];
  const col = new Map(header.map((h, i) => [h.trim().toLowerCase(), i]));
  for (const n of ["year", "month", "geo_type", "geo_name", "index_sa"]) {
    if (!col.has(n)) throw new Error(`FMHPI file missing expected column "${n}"`);
  }

  const out: SeriesRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if ((row[col.get("geo_type")!] ?? "").trim().toLowerCase() !== "state") continue;
    const geographyId = abbrToId.get((row[col.get("geo_name")!] ?? "").trim().toUpperCase());
    if (geographyId === undefined) continue;
    const periodDate = monthEnd(Number(row[col.get("year")!]), Number(row[col.get("month")!]));
    if (!periodDate) continue;
    const value = Number(row[col.get("index_sa")!]);
    if (!Number.isFinite(value)) continue;
    out.push({ geographyId, metricKey: "fmhpi", periodDate, freq: "monthly", value });
  }

  const written = await upsertSeries(out);
  console.log(`FMHPI ingestion complete: ${written} observations upserted`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
