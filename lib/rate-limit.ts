import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Tenant } from "@/lib/auth";
import { env } from "@/lib/env";
import { rateLimited } from "@/lib/errors";
import { ensureWorkspace } from "@/lib/tenancy";

export type LimitKind = "ai" | "upload";

const WINDOW_MS = 60 * 60 * 1000;

/** What counts toward each limit. These are the audit actions the app already writes, so no new table is needed. */
const RULES: Record<LimitKind, { actions: string[]; label: string; limit: () => number }> = {
  ai: { actions: ["assistant.query", "document.reextracted"], label: "AI requests", limit: () => env.RATE_LIMIT_AI_PER_HOUR },
  upload: { actions: ["document.upload"], label: "uploads", limit: () => env.RATE_LIMIT_UPLOADS_PER_HOUR },
};

/** Pure decision, easy to test. `oldest` is the earliest event still inside the window. */
export function evaluateLimit(input: { count: number; limit: number; oldest: Date | null; windowMs: number; now: Date }) {
  if (input.count < input.limit) return { allowed: true, remaining: input.limit - input.count, retryAfterSeconds: 0 };
  const resetAt = (input.oldest ?? input.now).getTime() + input.windowMs;
  return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(1, Math.ceil((resetAt - input.now.getTime()) / 1000)) };
}

export function describeWait(seconds: number): string {
  if (seconds <= 60) return "a minute";
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} minutes`;
  return "an hour";
}

/** Throws a 429 when the signed-in user has used up their hourly allowance for this kind of action. */
export async function enforceRateLimit(t: Tenant, kind: LimitKind, now = new Date()) {
  const rule = RULES[kind];
  const limit = rule.limit();
  const { orgId } = await ensureWorkspace(t);
  const a = schema.auditLogs;
  const where = and(
    eq(a.organizationId, orgId),
    eq(a.actorId, t.userId),
    inArray(a.action, rule.actions),
    gte(a.createdAt, new Date(now.getTime() - WINDOW_MS)),
  );
  const db = getDb();
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(a).where(where);
  const count = row?.n ?? 0;
  if (count < limit) return;

  const [oldest] = await db.select({ at: a.createdAt }).from(a).where(where).orderBy(asc(a.createdAt)).limit(1);
  const verdict = evaluateLimit({ count, limit, oldest: oldest?.at ?? null, windowMs: WINDOW_MS, now });
  throw rateLimited(`You've reached the limit of ${limit} ${rule.label} per hour. Try again in ${describeWait(verdict.retryAfterSeconds)}.`, verdict.retryAfterSeconds);
}