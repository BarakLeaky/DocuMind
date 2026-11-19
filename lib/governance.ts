import { clerkClient } from "@clerk/nextjs/server";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Tenant } from "@/lib/auth";
import type { Role } from "@/lib/rbac";
import { ensureWorkspace } from "@/lib/tenancy";

async function nameLookup(ids: string[]) {
  const names = new Map<string, { name: string; email: string }>();
  if (ids.length === 0) return names;
  try {
    const client = await clerkClient();
    const { data } = await client.users.getUserList({ userId: ids.slice(0, 100), limit: 100 });
    for (const u of data) {
      names.set(u.id, {
        name: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || "Member",
        email: u.primaryEmailAddress?.emailAddress ?? "",
      });
    }
  } catch (err) {
    console.error("[governance] could not resolve member names", err instanceof Error ? err.message : err);
  }
  return names;
}

export async function listMembers(t: Tenant) {
  const { orgId } = await ensureWorkspace(t);
  const rows = await getDb().select().from(schema.memberships).where(eq(schema.memberships.organizationId, orgId)).orderBy(schema.memberships.createdAt);
  const names = await nameLookup(rows.map((r) => r.clerkUserId));
  return rows.map((r) => ({
    id: r.id,
    name: names.get(r.clerkUserId)?.name ?? "Member",
    email: names.get(r.clerkUserId)?.email ?? "",
    role: r.role as Role,
    joinedAt: r.createdAt.toISOString(),
    isYou: r.clerkUserId === t.userId,
  }));
}

export async function listAudit(t: Tenant, limit = 50) {
  const { orgId } = await ensureWorkspace(t);
  const rows = await getDb()
    .select()
    .from(schema.auditLogs)
    .where(eq(schema.auditLogs.organizationId, orgId))
    .orderBy(desc(schema.auditLogs.createdAt))
    .limit(limit);
  const names = await nameLookup([...new Set(rows.map((r) => r.actorId))]);
  return rows.map((r) => {
    const title = r.metadata?.title;
    return {
      id: r.id,
      action: r.action,
      actor: r.actorId === t.userId ? "You" : names.get(r.actorId)?.name ?? "Member",
      resource: typeof title === "string" ? title : r.resourceType ?? "",
      at: r.createdAt.toISOString(),
    };
  });
}
