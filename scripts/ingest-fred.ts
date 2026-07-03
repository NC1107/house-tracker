/**
 * Ingest national FRED series (mortgage rates, Case-Shiller, Treasury) into the DB.
 * Rates go to `mortgage_rates`; everything else to `metric_series` at the nation level.
 *
 * Run: FRED_API_KEY=... DATABASE_URL=... npm run ingest:fred
 */
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { geographies, mortgageRates } from "@/db/schema";
import { fetchFredSeries } from "@/lib/sources/fred";
import { upsertSeries } from "@/lib/ingest";
import { FRED_SERIES } from "@/db/metric-catalog";

async function nationId(): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ id: geographies.id })
    .from(geographies)
    .where(sql`${geographies.level} = 'nation'`)
    .limit(1);
  if (!rows[0]) throw new Error("Nation geography not seeded. Run npm run seed:geo first.");
  return rows[0].id;
}

async function main() {
  const db = getDb();
  const usId = await nationId();

  for (const s of FRED_SERIES) {
    const points = await fetchFredSeries(s.seriesId, { observationStart: "2000-01-01" });
    console.log(`FRED ${s.seriesId}: ${points.length} observations`);

    if (s.metricKey === "mortgage_30yr" || s.metricKey === "mortgage_15yr") {
      const product = s.metricKey === "mortgage_30yr" ? "30yr" : "15yr";
      const values = points.map((p) => ({
        date: p.date,
        product: product as "30yr" | "15yr",
        rate: p.value,
        source: "fred",
      }));
      for (let i = 0; i < values.length; i += 1000) {
        await db
          .insert(mortgageRates)
          .values(values.slice(i, i + 1000))
          .onConflictDoUpdate({
            target: [mortgageRates.date, mortgageRates.product],
            set: { rate: sql`excluded.rate` },
          });
      }
    } else {
      await upsertSeries(
        points.map((p) => ({
          geographyId: usId,
          metricKey: s.metricKey,
          periodDate: p.date,
          freq: s.freq,
          value: p.value,
        })),
      );
    }
  }
  console.log("FRED ingestion complete.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
