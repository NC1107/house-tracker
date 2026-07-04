/**
 * Read helpers for the UI. Every query is wrapped so that when DATABASE_URL is not yet
 * configured (or the DB is empty), pages render a friendly empty state instead of crashing.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { geographies, metricSeries, mortgageRates } from "@/db/schema";
import type { SeriesPoint } from "@/lib/types";
import { yoyChangeSeries } from "@/lib/trends";

export function dbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
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

export async function latestMortgageRate(product: "30yr" | "15yr" = "30yr") {
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

export async function rateHistory(product: "30yr" | "15yr" = "30yr"): Promise<SeriesPoint[]> {
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

export async function metricHistory(
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

export async function nationalSeries(metricKey: string): Promise<SeriesPoint[]> {
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

export async function latestMetric(
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
export async function latestMetricByState(
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

export async function statesList() {
  return safe(async () => {
    const db = getDb();
    return db
      .select({ id: geographies.id, code: geographies.code, name: geographies.name, stateCode: geographies.stateCode })
      .from(geographies)
      .where(eq(geographies.level, "state"))
      .orderBy(geographies.name);
  }, [] as { id: number; code: string; name: string; stateCode: string | null }[]);
}
