/**
 * Single-user owner. Alerts are stored in the DB (so the daily job can read them) but there's
 * no auth — every rule belongs to one owner row, keyed off ALERT_EMAIL.
 */
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";

export async function ensureOwnerId(): Promise<number> {
  const db = getDb();
  const email = process.env.ALERT_EMAIL || "owner@local";
  const [row] = await db
    .insert(users)
    .values({ email, name: "Owner" })
    .onConflictDoUpdate({ target: users.email, set: { name: sql`excluded.name` } })
    .returning({ id: users.id });
  return row.id;
}
