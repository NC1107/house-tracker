/**
 * Seed the geography spine (nation + states) and the metric catalog.
 * Metros/counties/ZIPs are added during ingestion using the HUD ZIP crosswalk.
 *
 * Run: DATABASE_URL=... npm run seed:geo
 */
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { geographies, metricCatalog } from "@/db/schema";
import { US_STATES } from "@/lib/geo/states";
import { METRIC_CATALOG } from "@/db/metric-catalog";

async function main() {
  const db = getDb();

  // Metric catalog
  await db
    .insert(metricCatalog)
    .values(METRIC_CATALOG.map((m) => ({
      metricKey: m.metricKey,
      label: m.label,
      unit: m.unit,
      category: m.category,
      source: m.source,
      description: m.description ?? null,
    })))
    .onConflictDoUpdate({
      target: metricCatalog.metricKey,
      set: { label: sql`excluded.label`, unit: sql`excluded.unit`, category: sql`excluded.category` },
    });
  console.log(`Seeded ${METRIC_CATALOG.length} metrics`);

  // Nation
  const [nation] = await db
    .insert(geographies)
    .values({ level: "nation", code: "US", name: "United States" })
    .onConflictDoUpdate({
      target: [geographies.level, geographies.code],
      set: { name: sql`excluded.name` },
    })
    .returning({ id: geographies.id });

  // States (parented to nation)
  await db
    .insert(geographies)
    .values(
      US_STATES.map((s) => ({
        level: "state" as const,
        code: s.fips,
        name: s.name,
        stateCode: s.abbr,
        parentId: nation.id,
      })),
    )
    .onConflictDoUpdate({
      target: [geographies.level, geographies.code],
      set: { name: sql`excluded.name`, parentId: sql`excluded.parent_id` },
    });
  console.log(`Seeded nation + ${US_STATES.length} states`);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
