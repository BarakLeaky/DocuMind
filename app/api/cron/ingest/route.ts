import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { drainQueue } from "@/lib/ingest";

export const maxDuration = 60;

/** Safety net that retries stuck or failed jobs. Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(req: Request) {
  if (!env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Unauthorized" } }, { status: 401 });
  }
  const processed = await drainQueue(5);
  return NextResponse.json({ processed });
}
