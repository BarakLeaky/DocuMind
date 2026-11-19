import { clerkClient } from "@clerk/nextjs/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Tenant } from "@/lib/auth";
import { canEditDoc, resolveDocRole, type DocRole, type ShareRole } from "@/lib/docs-access";
import { sanitizeDocHtml } from "@/lib/docs-html";
import { AppError, notFound } from "@/lib/errors";
import { ensureWorkspace } from "@/lib/tenancy";

const UUID = /^[0-9a-f-]{36}$/i;
const { editorDocuments: ed, editorShares: es } = schema;

export type DocSummary = { id: string; title: string; updatedAt: string; role: DocRole; ownerName: string; sharedCount: number };
export type Share = { id: string; userId: string; email: string; name: string; role: ShareRole };
export type EditorDoc = {
  id: string; title: string; contentHtml: string; revision: number; role: DocRole; ownerName: string; updatedAt: string; shares: Share[];
};

async function names(ids: string[]) {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  try {
    const { data } = await (await clerkClient()).users.getUserList({ userId: ids.slice(0, 100), limit: 100 });
    for (const u of data) map.set(u.id, [u.firstName, u.lastName].filter(Boolean).join(" ") || u.primaryEmailAddress?.emailAddress || "Member");
  } catch (err) {
    console.error("[docs] could not resolve names", err instanceof Error ? err.message : err);
  }
  return map;
}

/** Everything the person owns plus everything shared with them. Access is decided in SQL by owner or share row. */
export async function listEditorDocs(t: Tenant): Promise<{ mine: DocSummary[]; shared: DocSummary[] }> {
  const db = getDb();
  const { workspaceId } = await ensureWorkspace(t);
  const mine = await db.select().from(ed).where(and(eq(ed.ownerId, t.userId), eq(ed.workspaceId, workspaceId))).orderBy(desc(ed.updatedAt));
  const sharedRows = await db
    .select({ doc: ed, role: es.role })
    .from(es)
    .innerJoin(ed, eq(ed.id, es.documentId))
    .where(eq(es.userId, t.userId))
    .orderBy(desc(ed.updatedAt));

  const counts = mine.length
    ? await db.select({ id: es.documentId }).from(es).where(inArray(es.documentId, mine.map((d) => d.id)))
    : [];
  const countBy = new Map<string, number>();
  for (const c of counts) countBy.set(c.id, (countBy.get(c.id) ?? 0) + 1);
  const owners = await names([...new Set(sharedRows.map((r) => r.doc.ownerId))]);

  return {
    mine: mine.map((d) => ({ id: d.id, title: d.title, updatedAt: d.updatedAt.toISOString(), role: "owner", ownerName: "You", sharedCount: countBy.get(d.id) ?? 0 })),
    shared: sharedRows.map((r) => ({ id: r.doc.id, title: r.doc.title, updatedAt: r.doc.updatedAt.toISOString(), role: r.role, ownerName: owners.get(r.doc.ownerId) ?? "Teammate", sharedCount: 0 })),
  };
}

/** Returns null (never "forbidden") when the caller has no access, so a document's existence does not leak. */
export async function getEditorDoc(t: Tenant, id: string): Promise<EditorDoc | null> {
  if (!UUID.test(id)) return null;
  const db = getDb();
  const [doc] = await db.select().from(ed).where(eq(ed.id, id)).limit(1);
  if (!doc) return null;
  const shares = await db.select().from(es).where(eq(es.documentId, id)).orderBy(es.createdAt);
  const role = resolveDocRole(t.userId, doc.ownerId, shares);
  if (!role) return null;
  const owner = role === "owner" ? "You" : (await names([doc.ownerId])).get(doc.ownerId) ?? "Teammate";
  return {
    id: doc.id, title: doc.title, contentHtml: doc.contentHtml, revision: doc.revision, role, ownerName: owner, updatedAt: doc.updatedAt.toISOString(),
    // Only the owner sees who else has access.
    shares: role === "owner" ? shares.map((s) => ({ id: s.id, userId: s.userId, email: s.email, name: s.displayName, role: s.role })) : [],
  };
}

export async function createEditorDoc(t: Tenant, input: { title?: string; contentHtml?: string }) {
  const { workspaceId } = await ensureWorkspace(t);
  const [row] = await getDb()
    .insert(ed)
    .values({
      workspaceId, ownerId: t.userId, updatedBy: t.userId,
      title: (input.title?.trim() || "Untitled document").slice(0, 200),
      contentHtml: sanitizeDocHtml(input.contentHtml ?? ""),
    })
    .returning({ id: ed.id });
  return row.id;
}

export type SaveResult = { revision: number; updatedAt: string };

/** Saves title and/or content. A stale `baseRevision` is rejected so an older tab cannot silently overwrite newer work. */
export async function saveEditorDoc(t: Tenant, id: string, patch: { title?: string; contentHtml?: string; baseRevision: number }): Promise<SaveResult> {
  const current = await getEditorDoc(t, id);
  if (!current) throw notFound("Document");
  if (!canEditDoc(current.role)) throw new AppError("forbidden", 403, "You have view-only access to this document.");

  const set: Partial<typeof ed.$inferInsert> = { updatedBy: t.userId, updatedAt: new Date() };
  if (patch.title !== undefined) set.title = patch.title.trim().slice(0, 200) || "Untitled document";
  if (patch.contentHtml !== undefined) set.contentHtml = sanitizeDocHtml(patch.contentHtml);

  const updated = await getDb()
    .update(ed)
    .set({ ...set, revision: patch.baseRevision + 1 })
    .where(and(eq(ed.id, id), eq(ed.revision, patch.baseRevision))) // compare-and-swap on revision
    .returning({ revision: ed.revision, updatedAt: ed.updatedAt });
  if (updated.length === 0) throw new AppError("conflict", 409, "Someone else saved a newer version. Reload to see their changes.");
  return { revision: updated[0].revision, updatedAt: updated[0].updatedAt.toISOString() };
}

export async function deleteEditorDoc(t: Tenant, id: string) {
  const current = await getEditorDoc(t, id);
  if (!current) throw notFound("Document");
  if (current.role !== "owner") throw new AppError("forbidden", 403, "Only the owner can delete this document.");
  await getDb().delete(ed).where(eq(ed.id, id));
}

export async function shareEditorDoc(t: Tenant, id: string, email: string, role: ShareRole): Promise<Share> {
  const current = await getEditorDoc(t, id);
  if (!current) throw notFound("Document");
  if (current.role !== "owner") throw new AppError("forbidden", 403, "Only the owner can share this document.");
  const address = email.trim().toLowerCase();
  if (address === t.email.toLowerCase()) throw new AppError("invalid_share", 422, "You already own this document.");

  const { data } = await (await clerkClient()).users.getUserList({ emailAddress: [address], limit: 1 });
  const user = data[0];
  if (!user) throw new AppError("user_not_found", 404, "No DocuMind account uses that email yet. Ask them to sign up, then share again.");

  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || address;
  const [row] = await getDb()
    .insert(es)
    .values({ documentId: id, userId: user.id, email: address, displayName: name, role, sharedBy: t.userId })
    .onConflictDoUpdate({ target: [es.documentId, es.userId], set: { role } })
    .returning();
  return { id: row.id, userId: row.userId, email: row.email, name: row.displayName, role: row.role };
}

export async function unshareEditorDoc(t: Tenant, id: string, shareId: string) {
  const current = await getEditorDoc(t, id);
  if (!current) throw notFound("Document");
  if (current.role !== "owner") throw new AppError("forbidden", 403, "Only the owner can change sharing.");
  if (!UUID.test(shareId)) throw notFound("Share");
  await getDb().delete(es).where(and(eq(es.id, shareId), eq(es.documentId, id)));
}
