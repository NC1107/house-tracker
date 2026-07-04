/**
 * Ingest Census ACS 1-year state estimates: median household income (B19013_001E) and
 * median home value (B25077_001E). Needs a free CENSUS_API_KEY
 * (https://api.census.gov/data/key_signup.html).
 * Run: CENSUS_API_KEY=... DATABASE_URL=... npm run ingest:census
 *
 * State-level income makes the "can the median household afford it HERE" verdicts honest;
 * without it every state is judged against the national median.
 */
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { geographies } from "@/db/schema";
import { upsertSeries, type SeriesRow } from "@/lib/ingest";

const VARS: { code: string; metricKey: string }[] = [
  { code: "B19013_001E", metricKey: "median_household_income" },
  { code: "B25077_001E", metricKey: "median_home_value_acs" },
];

// Try the most recent ACS 1-year vintages; older ones keep working after a new release.
const YEARS = [2024, 2023, 2022];

async function fetchYear(year: number, key: string): Promise<string[][] | null> {
  const vars = VARS.map((v) => v.code).join(",");
  const url = `https://api.census.gov/data/${year}/acs/acs1?get=NAME,${vars}&for=state:*&key=${key}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  try {
    return (await res.json()) as string[][];
  } catch {
    return null;
  }
}

async function main() {
  const key = process.env.CENSUS_API_KEY;
  if (!key) {
    console.warn("CENSUS_API_KEY not set; skipping Census ingestion (sign up free at census.gov).");
    process.exit(0);
  }

  const db = getDb();
  const states = await db
    .select({ id: geographies.id, code: geographies.code })
    .from(geographies)
    .where(sql`${geographies.level} = 'state'`);
  // geographies.code for states is the 2-digit FIPS, which is what the API returns.
  const fipsToId = new Map(states.map((s) => [s.code.padStart(2, "0"), s.id]));
  console.log(`Loaded ${fipsToId.size} states`);

  const out: SeriesRow[] = [];
  for (const year of YEARS) {
    const rows = await fetchYear(year, key);
    if (!rows || rows.length < 2) {
      console.warn(`ACS ${year}: unavailable, skipping`);
      continue;
    }
    const header = rows[0];
    const fipsCol = header.indexOf("state");
    for (const row of rows.slice(1)) {
      const geographyId = fipsToId.get((row[fipsCol] ?? "").padStart(2, "0"));
      if (geographyId === undefined) continue;
      for (const v of VARS) {
        const idx = header.indexOf(v.code);
        const value = Number(row[idx]);
        // ACS uses large negative sentinels for suppressed values.
        if (!Number.isFinite(value) || value <= 0) continue;
        out.push({
          geographyId,
          metricKey: v.metricKey,
          periodDate: `${year}-12-31`,
          freq: "annual",
          value,
        });
      }
    }
    console.log(`ACS ${year}: collected ${rows.length - 1} states`);
  }

  const written = await upsertSeries(out);
  console.log(`Census ingestion complete: ${written} observations upserted`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
