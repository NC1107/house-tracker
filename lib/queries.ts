/**
 * Read helpers for the UI. Every query is wrapped so that when DATABASE_URL is not yet
 * configured (or the DB is empty), pages render a friendly empty state instead of crashing.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { geographies, metricSeries, mortgageRates } from "@/db/schema";
import type { SeriesPoint } from "@/lib/types";

export function dbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  if (!dbConfigured()) return fallback;
  try {
    return await fn();
  } catch (e) {
    // Expected before migrations/ingestion have run — the UI shows an empty state.
    console.warn("[queries] no data yet, showing empty state:", (e as Error).message);
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

/** Year-over-year change (fraction) for a metric, comparing latest to ~12 months prior. */
export async function metricYoY(geographyId: number, metricKey: string): Promise<number | null> {
  const history = await metricHistory(geographyId, metricKey);
  if (history.length < 13) return null;
  const latest = history[history.length - 1];
  const prior = history[history.length - 13];
  if (!prior || prior.value === 0) return null;
  return (latest.value - prior.value) / prior.value;
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
