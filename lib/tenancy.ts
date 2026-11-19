import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Tenant } from "@/lib/auth";

const cache = new Map<string, { orgId: string; workspaceId: string }>();

/** Finds (or provisions on first sign-in) the organization + workspace for the current tenant. Nothing is pre-created. */
export async function ensureWorkspace(t: Tenant) {
  const cacheKey = `${t.tenantKey}:${t.userId}:${t.role}`;
  const hit = cache.get(cacheKey);
  if (hit) return hit;
  const db = getDb();

  const findOrg = async () =>
    (await db.select().from(schema.organizations).where(eq(schema.organizations.slug, t.tenantKey)).limit(1))[0];

  let org = await findOrg();
  if (!org) {
    await db
      .insert(schema.organizations)
      .values({ name: `${t.name}'s workspace`, slug: t.tenantKey })
      .onConflictDoNothing();
    org = await findOrg();
  }
  if (!org) throw new Error("Could not create workspace");

  const findWs = async () =>
    (await db.select().from(schema.workspaces).where(eq(schema.workspaces.organizationId, org.id)).limit(1))[0];
  let ws = await findWs();
  if (!ws) {
    await db.insert(schema.workspaces).values({ organizationId: org.id, name: "Main workspace" }).onConflictDoNothing();
    ws = await findWs();
  }
  if (!ws) throw new Error("Could not create workspace");

  await db
    .insert(schema.memberships)
    .values({ organizationId: org.id, clerkUserId: t.userId, role: t.role })
    .onConflictDoUpdate({
      target: [schema.memberships.organizationId, schema.memberships.clerkUserId],
      set: { role: t.role },
    });

  const value = { orgId: org.id, workspaceId: ws.id };
  cache.set(cacheKey, value);
  return value;
}

export async function audit(t: Tenant, action: string, resourceType?: string, resourceId?: string, metadata?: Record<string, unknown>) {
  const { orgId } = await ensureWorkspace(t);
  await getDb().insert(schema.auditLogs).values({ organizationId: orgId, actorId: t.userId, action, resourceType, resourceId, metadata });
}
