/**
 * Ingest HUD Fair Market Rents: the 2-bedroom FMR per state (median across the state's
 * counties) as `fmr_2br`. Needs a free HUD_TOKEN (https://www.huduser.gov/portal/dataset/fmr-api.html).
 * Run: HUD_TOKEN=... DATABASE_URL=... npm run ingest:hud
 *
 * FMRs anchor the rent side of rent-vs-buy with a government source that covers areas
 * Zillow's rent index doesn't.
 */
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { geographies } from "@/db/schema";
import { upsertSeries, type SeriesRow } from "@/lib/ingest";

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

async function main() {
  const token = process.env.HUD_TOKEN;
  if (!token) {
    console.warn("HUD_TOKEN not set; skipping HUD FMR ingestion (sign up free at huduser.gov).");
    process.exit(0);
  }

  const db = getDb();
  const states = await db
    .select({ id: geographies.id, abbr: geographies.stateCode })
    .from(geographies)
    .where(sql`${geographies.level} = 'state'`);

  const out: SeriesRow[] = [];
  let loaded = 0;
  for (const st of states) {
    if (!st.abbr) continue;
    try {
      const res = await fetch(`https://www.huduser.gov/hudapi/public/fmr/statedata/${st.abbr}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        console.warn(`HUD ${st.abbr}: ${res.status}, skipping`);
        continue;
      }
      const body = (await res.json()) as {
        data?: { year?: string; counties?: { "FMR 2"?: number | string }[]; metroareas?: { "FMR 2"?: number | string }[] };
      };
      const year = Number(body.data?.year);
      const areas = [...(body.data?.counties ?? []), ...(body.data?.metroareas ?? [])];
      const twoBed = median(
        areas.map((c) => Number(c["FMR 2"])).filter((v) => Number.isFinite(v) && v > 0),
      );
      if (!twoBed || !Number.isFinite(year)) continue;
      out.push({
        geographyId: st.id,
        metricKey: "fmr_2br",
        periodDate: `${year}-12-31`,
        freq: "annual",
        value: twoBed,
      });
      loaded++;
      await new Promise((r) => setTimeout(r, 200)); // stay well under HUD rate limits
    } catch (e) {
      console.warn(`HUD ${st.abbr}: ${(e as Error).message}`);
    }
  }

  const written = await upsertSeries(out);
  console.log(`HUD FMR ingestion complete: ${written} observations across ${loaded} states`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
