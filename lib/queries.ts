/**
 * Read helpers for the UI. Every query is wrapped so that when DATABASE_URL is not yet
 * configured (or the DB is empty), pages render a friendly empty state instead of crashing.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { getDb } from "@/db/client";
import { geographies, metricSeries, mortgageRates } from "@/db/schema";
import type { SeriesPoint } from "@/lib/types";
import { yoyChangeSeries } from "@/lib/trends";

export function dbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * Cross-request cache for read helpers. The data changes at most once a day (nightly
 * ingest), so a 15-minute shared cache removes nearly all per-page-view DB round trips.
 * Args are part of the cache key. Outside the Next runtime (tsx ingest/alert scripts)
 * there is no cache handler, so the raw function runs directly. Alert rules are NOT
 * cached (user-mutable; must reflect edits immediately).
 */
const REVALIDATE_SECONDS = 900;
function cachedQuery<A extends unknown[], T>(
  name: string,
  fn: (...args: A) => Promise<T>,
): (...args: A) => Promise<T> {
  return (...args: A) => {
    if (!process.env.NEXT_RUNTIME) return fn(...args);
    return unstable_cache(fn, [`q:${name}`], { revalidate: REVALIDATE_SECONDS })(...args);
  };
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  if (!dbConfigured()) return fallback;
  try {
    return await fn();
  } catch (e) {
    // An exception here is a real failure (connection/SQL/permission) — NOT "no data".
    // Empty results return normally without throwing. Log at error level so operators can
    // tell a broken DB from an un-ingested one; the UI still degrades to a fallback.
    console.error("[queries] query FAILED (serving empty fallback):", (e as Error).message);
    return fallback;
  }
}

async function latestMortgageRateRaw(product: "30yr" | "15yr" = "30yr") {
  return safe(async () => {
    const db = getDb();
    const [row] = await db
      .select({ rate: mortgageRates.rate, date: mortgageRates.date })
      .from(mortgageRates)
      .where(eq(mortgageRates.product, product))
      .orderBy(desc(mortgageRates.date))
      .limit(1);
    return row ?? null;
  }, null);
}

async function rateHistoryRaw(product: "30yr" | "15yr" = "30yr"): Promise<SeriesPoint[]> {
  return safe(async () => {
    const db = getDb();
    const rows = await db
      .select({ date: mortgageRates.date, value: mortgageRates.rate })
      .from(mortgageRates)
      .where(eq(mortgageRates.product, product))
      .orderBy(mortgageRates.date);
    return rows;
  }, []);
}

async function metricHistoryRaw(
  geographyId: number,
  metricKey: string,
): Promise<SeriesPoint[]> {
  return safe(async () => {
    const db = getDb();
    const rows = await db
      .select({ date: metricSeries.periodDate, value: metricSeries.value })
      .from(metricSeries)
      .where(and(eq(metricSeries.geographyId, geographyId), eq(metricSeries.metricKey, metricKey)))
      .orderBy(metricSeries.periodDate);
    return rows;
  }, []);
}

async function nationalSeriesRaw(metricKey: string): Promise<SeriesPoint[]> {
  return safe(async () => {
    const db = getDb();
    const rows = await db
      .select({ date: metricSeries.periodDate, value: metricSeries.value })
      .from(metricSeries)
      .innerJoin(geographies, eq(metricSeries.geographyId, geographies.id))
      .where(and(eq(geographies.level, "nation"), eq(metricSeries.metricKey, metricKey)))
      .orderBy(metricSeries.periodDate);
    return rows;
  }, []);
}

async function latestMetricRaw(
  geographyId: number,
  metricKey: string,
): Promise<{ date: string; value: number } | null> {
  return safe(async () => {
    const db = getDb();
    const [row] = await db
      .select({ date: metricSeries.periodDate, value: metricSeries.value })
      .from(metricSeries)
      .where(and(eq(metricSeries.geographyId, geographyId), eq(metricSeries.metricKey, metricKey)))
      .orderBy(desc(metricSeries.periodDate))
      .limit(1);
    return row ?? null;
  }, null);
}

/** Year-over-year change (fraction) for a metric, comparing latest to ~12 months prior by date. */
export async function metricYoY(geographyId: number, metricKey: string): Promise<number | null> {
  const history = await metricHistory(geographyId, metricKey);
  const yoy = yoyChangeSeries(history);
  const last = yoy.at(-1);
  return last ? last.value / 100 : null;
}

/** Latest value of a metric for every state, keyed for map/ranking views. */
async function latestMetricByStateRaw(
  metricKey: string,
): Promise<{ stateCode: string; name: string; value: number; date: string }[]> {
  return safe(async () => {
    const db = getDb();
    const rows = await db.execute(sql`
      select distinct on (g.id) g.state_code as "stateCode", g.name as name, ms.value as value, ms.period_date as date
      from geographies g
      join metric_series ms on ms.geography_id = g.id
      where g.level = 'state' and ms.metric_key = ${metricKey}
      order by g.id, ms.period_date desc
    `);
    return (rows as unknown as { stateCode: string; name: string; value: number; date: string }[])
      .filter((r) => r.stateCode);
  }, []);
}

export async function listAlertRules(): Promise<
  { id: number; type: string; params: Record<string, unknown>; enabled: boolean }[]
> {
  return safe(async () => {
    const db = getDb();
    const { alertRules } = await import("@/db/schema");
    return db
      .select({ id: alertRules.id, type: alertRules.type, params: alertRules.params, enabled: alertRules.enabled })
      .from(alertRules)
      .orderBy(alertRules.id);
  }, []);
}

/** Metros (MSAs) whose primary state is the given state geography id, ordered by name. */
async function metrosForStateRaw(stateId: number) {
  return safe(async () => {
    const db = getDb();
    return db
      .select({ id: geographies.id, name: geographies.name })
      .from(geographies)
      .where(and(eq(geographies.level, "metro"), eq(geographies.parentId, stateId)))
      .orderBy(geographies.name);
  }, [] as { id: number; name: string }[]);
}

async function statesListRaw() {
  return safe(async () => {
    const db = getDb();
    return db
      .select({ id: geographies.id, code: geographies.code, name: geographies.name, stateCode: geographies.stateCode })
      .from(geographies)
      .where(eq(geographies.level, "state"))
      .orderBy(geographies.name);
  }, [] as { id: number; code: string; name: string; stateCode: string | null }[]);
}

/** Metros of a state that have at least one Redfin market-heat metric ingested. */
async function metrosWithMarketDataRaw(stateId: number): Promise<{ id: number; name: string }[]> {
  return safe(async () => {
    const db = getDb();
    const rows = await db.execute(sql`
      select distinct g.id as id, g.name as name
      from geographies g
      join metric_series ms on ms.geography_id = g.id
      where g.level = 'metro' and g.parent_id = ${stateId}
        and ms.metric_key in ('months_of_supply', 'days_on_market', 'price_drops_share', 'sale_to_list', 'inventory')
      order by g.name
    `);
    return rows as unknown as { id: number; name: string }[];
  }, [] as { id: number; name: string }[]);
}

/** Cities of a state that have at least one Redfin market-heat metric ingested. */
async function citiesWithMarketDataRaw(stateId: number): Promise<{ id: number; name: string }[]> {
  return safe(async () => {
    const db = getDb();
    const rows = await db.execute(sql`
      select distinct g.id as id, g.name as name
      from geographies g
      join metric_series ms on ms.geography_id = g.id
      where g.level = 'city' and g.parent_id = ${stateId}
        and ms.metric_key in ('months_of_supply', 'days_on_market', 'price_drops_share', 'sale_to_list', 'inventory')
      order by g.name
    `);
    return rows as unknown as { id: number; name: string }[];
  }, [] as { id: number; name: string }[]);
}

/** State geography ids that have at least one Redfin market-heat metric ingested. */
// Returns an array (not a Set): results pass through the JSON cache, which drops Sets.
async function statesWithMarketDataRaw(): Promise<number[]> {
  return safe(async () => {
    const db = getDb();
    const rows = await db.execute(sql`
      select distinct g.id as id
      from geographies g
      join metric_series ms on ms.geography_id = g.id
      where g.level = 'state'
        and ms.metric_key in ('months_of_supply', 'days_on_market', 'price_drops_share', 'sale_to_list', 'inventory')
    `);
    return (rows as unknown as { id: number }[]).map((r) => Number(r.id));
  }, [] as number[]);
}


export const latestMortgageRate = cachedQuery("latestMortgageRate", latestMortgageRateRaw);
export const rateHistory = cachedQuery("rateHistory", rateHistoryRaw);
export const metricHistory = cachedQuery("metricHistory", metricHistoryRaw);
export const nationalSeries = cachedQuery("nationalSeries", nationalSeriesRaw);
export const latestMetric = cachedQuery("latestMetric", latestMetricRaw);
export const latestMetricByState = cachedQuery("latestMetricByState", latestMetricByStateRaw);
export const metrosForState = cachedQuery("metrosForState", metrosForStateRaw);
export const statesList = cachedQuery("statesList", statesListRaw);
export const statesWithMarketData = cachedQuery("statesWithMarketData", statesWithMarketDataRaw);
export const metrosWithMarketData = cachedQuery("metrosWithMarketData", metrosWithMarketDataRaw);
export const citiesWithMarketData = cachedQuery("citiesWithMarketData", citiesWithMarketDataRaw);
