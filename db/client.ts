import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Postgres (Neon) client. A single connection is reused across the serverless
 * function's lifetime. Ingestion scripts import this too.
 */
const connectionString = process.env.DATABASE_URL;

let queryClient: ReturnType<typeof postgres> | undefined;

export function getSql() {
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
  }
  if (!queryClient) {
    queryClient = postgres(connectionString, { max: 5 });
  }
  return queryClient;
}

export function getDb() {
  return drizzle(getSql(), { schema });
}

export { schema };
