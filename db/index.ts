import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const g = globalThis as unknown as { __documindSql?: ReturnType<typeof postgres> };

export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Add your Postgres connection string to .env.local (see README).");
  // prepare:false keeps this compatible with pooled connection strings (Neon, Supabase, PgBouncer).
  g.__documindSql ??= postgres(url, { max: 5, prepare: false, idle_timeout: 20, connect_timeout: 15 });
  return drizzle(g.__documindSql, { schema });
}

export type Db = ReturnType<typeof getDb>;
export { schema };
