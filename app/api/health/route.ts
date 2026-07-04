import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { dbConfigured } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * Health check that distinguishes "DB not configured", "DB down", and "OK" — so silent
 * data failures (masked in the UI by the safe() fallback) are observable by monitoring.
 */
export async function GET() {
  if (!dbConfigured()) {
    return NextResponse.json({ status: "no-db", dbConfigured: false }, { status: 200 });
  }
  try {
    const db = getDb();
    const rows = await db.execute(sql`select count(*)::int as n from metric_series`);
    const n = (rows as unknown as { n: number }[])[0]?.n ?? 0;
    return NextResponse.json({ status: "ok", dbConfigured: true, observations: n });
  } catch (e) {
    return NextResponse.json(
      { status: "db-error", dbConfigured: true, error: (e as Error).message },
      { status: 503 },
    );
  }
}
