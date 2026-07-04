/**
 * Ingest Redfin METRO-level market metrics (inventory, months of supply, days on market,
 * sale-to-list, price drops, median sale price) into metric_series, enabling metro-level
 * Market Heat scores. Run: DATABASE_URL=... npm run ingest:redfin-metro
 *
 * The metro tracker is ~110MB gzipped (~1GB text), too big to hold as one string, so it
 * is streamed and parsed line by line. Metros are matched by name: Redfin's
 * "Tacoma, WA metro area" -> "Tacoma, WA", which is exactly how the Zillow-seeded metro
 * geographies are named. Run ingest:zillow first so metros exist.
 */
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { getDb } from "@/db/client";
import { geographies } from "@/db/schema";
import { sql } from "drizzle-orm";
import { upsertSeries, type SeriesRow } from "@/lib/ingest";
import { REDFIN_METRIC_MAP } from "@/lib/sources/redfin";

export const REDFIN_METRO_URL =
  "https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker/metro_market_tracker.tsv000.gz";
const FALLBACK_URL =
  "https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker/redfin_metro_market_tracker.tsv000.gz";

/** Split a TSV line and strip surrounding quotes (Redfin quotes string fields). */
function splitTsv(line: string): string[] {
  return line.split("\t").map((f) => (f.startsWith('"') && f.endsWith('"') ? f.slice(1, -1) : f));
}

async function metroNameIndex(): Promise<Map<string, number>> {
  const db = getDb();
  const rows = await db
    .select({ id: geographies.id, name: geographies.name })
    .from(geographies)
    .where(sql`${geographies.level} = 'metro'`);
  return new Map(rows.map((r) => [r.name.trim().toLowerCase(), r.id]));
}

async function openStream(): Promise<NodeJS.ReadableStream> {
  for (const url of [REDFIN_METRO_URL, FALLBACK_URL]) {
    const res = await fetch(url);
    if (res.ok && res.body) {
      console.log(`Streaming ${url}`);
      return Readable.fromWeb(res.body as import("node:stream/web").ReadableStream).pipe(createGunzip());
    }
  }
  throw new Error("Redfin metro tracker download failed on all known URLs");
}

async function main() {
  const nameToId = await metroNameIndex();
  if (nameToId.size === 0) {
    throw new Error("No metro geographies seeded. Run npm run ingest:zillow first.");
  }
  console.log(`Loaded ${nameToId.size} metros`);

  const rl = createInterface({ input: await openStream(), crlfDelay: Infinity });

  let header: Map<string, number> | null = null;
  let metricCols: { idx: number; metricKey: string }[] = [];
  let regionCol = -1, typeCol = -1, propCol = -1, periodCol = -1, saCol = -1;

  let batch: SeriesRow[] = [];
  let written = 0;
  let matched = new Set<number>();
  const unmatched = new Set<string>();

  const flush = async () => {
    if (!batch.length) return;
    written += await upsertSeries(batch);
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
      if ([regionCol, typeCol, propCol, periodCol].includes(-1)) {
        throw new Error("Redfin metro file missing expected columns");
      }
      metricCols = Object.entries(REDFIN_METRIC_MAP)
        .filter(([c]) => header!.has(c))
        .map(([c, metricKey]) => ({ idx: header!.get(c)!, metricKey }));
      console.log(`Mapping ${metricCols.length} metric columns`);
      continue;
    }

    if ((row[typeCol] ?? "").trim().toLowerCase() !== "metro") continue;
    if ((row[propCol] ?? "").trim().toLowerCase() !== "all residential") continue;
    if (saCol >= 0 && /^t/i.test((row[saCol] ?? "").trim())) continue; // skip seasonally adjusted variants

    const name = (row[regionCol] ?? "").replace(/ metro area$/i, "").trim().toLowerCase();
    const geographyId = nameToId.get(name);
    if (geographyId === undefined) {
      if (unmatched.size < 5000) unmatched.add(name);
      continue;
    }

    const periodDate = (row[periodCol] ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(periodDate)) continue;

    matched.add(geographyId);
    for (const mc of metricCols) {
      const raw = row[mc.idx];
      if (raw === undefined || raw === "") continue;
      const value = Number(raw);
      if (!Number.isFinite(value)) continue;
      batch.push({ geographyId, metricKey: mc.metricKey, periodDate, freq: "monthly", value });
    }
    if (batch.length >= 20_000) await flush();
  }
  await flush();

  console.log(
    `Redfin metro ingestion complete: ${written} observations across ${matched.size} metros ` +
      `(${unmatched.size} Redfin metro names had no seeded match)`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
