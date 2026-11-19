import { sql } from "drizzle-orm";
import { getDb } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  let db: "ok" | "unconfigured" | "error" = "unconfigured";
  if (process.env.DATABASE_URL) {
    try {
      await getDb().execute(sql`select 1`);
      db = "ok";
    } catch {
      db = "error";
    }
  }
  return Response.json({ status: db === "error" ? "degraded" : "ok", db, time: new Date().toISOString() }, { status: db === "error" ? 503 : 200 });
}
