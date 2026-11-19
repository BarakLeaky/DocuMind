import { and, desc, eq, ilike, lt, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Tenant } from "@/lib/auth";
import type { DocumentType, ProcessingState } from "@/lib/constants";
import { env } from "@/lib/env";
import { EXT_BY_MIME, storage } from "@/lib/storage";
import { ensureWorkspace } from "@/lib/tenancy";
import type { DocumentRow, Review, Stats } from "@/lib/types";

export type ListOptions = { limit?: number; cursor?: string; status?: ProcessingState; q?: string };

export async function listDocuments(t: Tenant, opts: ListOptions = {}) {
  const limit = Math.min(opts.limit ?? 100, 200);
  const db = getDb();
  const { orgId } = await ensureWorkspace(t);
  const { documents: d, workspaces: w, documentVersions: v } = schema;
  const rows = await db
    .select({
      id: d.id, title: d.title, type: d.docType, status: d.status,
      version: v.versionNumber, sizeBytes: v.sizeBytes, pages: v.pageCount, owner: d.createdBy, updatedAt: d.updatedAt,
      confidence: sql<number | null>`(select avg(f.confidence) from extracted_fields f join extraction_runs r on r.id = f.run_id where r.version_id = ${d.currentVersionId})`,
    })
    .from(d)
    .innerJoin(w, eq(w.id, d.workspaceId))
    .leftJoin(v, eq(v.id, d.currentVersionId))
    .where(
      and(
        eq(w.organizationId, orgId),
        opts.status ? eq(d.status, opts.status) : undefined,
        opts.q ? ilike(d.title, `%${opts.q.replace(/[%_]/g, "")}%`) : undefined,
        opts.cursor ? lt(d.updatedAt, new Date(opts.cursor)) : undefined,
        sql`not exists (select 1 from document_acl a where a.resource_type = 'document' and a.resource_id = ${d.id} and a.principal_id = ${t.userId} and a.effect = 'deny')`,
      ),
    )
    .orderBy(desc(d.updatedAt))
    .limit(limit + 1);

  const page = rows.slice(0, limit).map<DocumentRow>((r) => ({
    id: r.id,
    title: r.title,
    type: r.type as DocumentType,
    status: r.status,
    pages: r.pages ?? 0,
    version: r.version ?? 1,
    sizeBytes: r.sizeBytes ?? 0,
    owner: r.owner === t.userId ? "You" : "Teammate",
    updatedAt: r.updatedAt.toISOString(),
    confidence: r.confidence == null ? null : Number(r.confidence),
  }));
  return { data: page, nextCursor: rows.length > limit ? page[page.length - 1].updatedAt : null };
}

export async function getStats(t: Tenant): Promise<Stats> {
  const { orgId } = await ensureWorkspace(t);
  const rows = (await getDb().execute(sql`
    select
      (select count(*) from documents d join workspaces w on w.id = d.workspace_id where w.organization_id = ${orgId})::int as total,
      (select count(*) from documents d join workspaces w on w.id = d.workspace_id
         where w.organization_id = ${orgId} and d.status = 'ready' and d.updated_at > now() - interval '7 days')::int as week,
      (select count(*) from documents d join workspaces w on w.id = d.workspace_id
         where w.organization_id = ${orgId} and d.status = 'ready'
           and d.updated_at <= now() - interval '7 days' and d.updated_at > now() - interval '14 days')::int as prev_week,
      (select count(*) from document_chunks c
         join documents d on d.current_version_id = c.version_id
         join workspaces w on w.id = d.workspace_id where w.organization_id = ${orgId})::int as passages,
      (select percentile_cont(0.5) within group (order by extract(epoch from (j.updated_at - j.created_at)))
         from processing_jobs j
         join document_versions v on v.id = j.version_id
         join documents d on d.id = v.document_id
         join workspaces w on w.id = d.workspace_id
         where w.organization_id = ${orgId} and j.state in ('ready', 'partially_processed')) as median_sec
  `)) as unknown as { total: number; week: number; prev_week: number; passages: number; median_sec: number | null }[];
  const r = rows[0];
  return {
    totalDocuments: r?.total ?? 0,
    processedThisWeek: r?.week ?? 0,
    processedDelta: r && r.prev_week > 0 ? ((r.week - r.prev_week) / r.prev_week) * 100 : null,
    searchablePassages: r?.passages ?? 0,
    medianTimeToSearchableSec: r?.median_sec == null ? null : Math.round(Number(r.median_sec)),
  };
}

export async function getPipeline(t: Tenant): Promise<{ state: ProcessingState; count: number }[]> {
  const { orgId } = await ensureWorkspace(t);
  const rows = (await getDb().execute(sql`
    select d.status as state, count(*)::int as count
    from documents d join workspaces w on w.id = d.workspace_id
    where w.organization_id = ${orgId} group by d.status order by count desc`)) as unknown as { state: ProcessingState; count: number }[];
  return [...rows];
}

/** Last 14 days, one point per day, zero-filled so the chart always shows a full axis. */
export async function getIngestionSeries(t: Tenant) {
  const { orgId } = await ensureWorkspace(t);
  const rows = (await getDb().execute(sql`
    select to_char(d.created_at at time zone 'UTC', 'YYYY-MM-DD') as day,
           count(*)::int as ingested,
           (count(*) filter (where d.status in ('failed', 'rejected')))::int as failed
    from documents d join workspaces w on w.id = d.workspace_id
    where w.organization_id = ${orgId} and d.created_at > now() - interval '14 days'
    group by 1`)) as unknown as { day: string; ingested: number; failed: number }[];
  const byDay = new Map(rows.map((r) => [r.day, r]));
  return Array.from({ length: 14 }, (_, i) => {
    const date = new Date(Date.now() - (13 - i) * 86_400_000);
    const hit = byDay.get(date.toISOString().slice(0, 10));
    return {
      day: date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }),
      ingested: hit?.ingested ?? 0,
      failed: hit?.failed ?? 0,
    };
  });
}

export async function getStorageUsage(t: Tenant) {
  const { orgId } = await ensureWorkspace(t);
  const rows = (await getDb().execute(sql`
    select coalesce(sum(v.size_bytes), 0)::float8 as used
    from document_versions v
    join documents d on d.id = v.document_id
    join workspaces w on w.id = d.workspace_id
    where w.organization_id = ${orgId}`)) as unknown as { used: number }[];
  return { usedBytes: Number(rows[0]?.used ?? 0), quotaBytes: env.STORAGE_QUOTA_MB * 1024 * 1024 };
}

export function describeFailure(code: string | null | undefined): string | null {
  if (!code) return null;
  if (code.startsWith("scanned_pdf")) return "This PDF has no selectable text, so it looks like a scan. Scanned documents (OCR) aren't supported yet.";
  if (code.startsWith("unsupported_mime")) return "This file type can't be read yet. Upload a PDF, Word (.docx) or text file.";
  if (code === "no_text_extracted") return "No readable text was found in this file.";
  return "Processing failed. Retries run automatically; if it keeps failing, delete the document and upload it again.";
}

export async function getReview(t: Tenant, id: string): Promise<Review | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { orgId } = await ensureWorkspace(t);
  const db = getDb();
  const { documents: d, workspaces: w, documentVersions: v, extractionRuns: r, extractedFields: f, documentChunks: c, processingJobs: j } = schema;
  const [doc] = await db
    .select({ id: d.id, title: d.title, type: d.docType, status: d.status, version: v.versionNumber, versionId: v.id, pages: v.pageCount, mime: v.mime, sizeBytes: v.sizeBytes })
    .from(d)
    .innerJoin(w, eq(w.id, d.workspaceId))
    .leftJoin(v, eq(v.id, d.currentVersionId))
    .where(
      and(
        eq(d.id, id),
        eq(w.organizationId, orgId),
        sql`not exists (select 1 from document_acl a where a.resource_type = 'document' and a.resource_id = ${d.id} and a.principal_id = ${t.userId} and a.effect = 'deny')`,
      ),
    )
    .limit(1);
  if (!doc) return null;

  const [fieldRows, passageRows, jobRows] = doc.versionId
    ? await Promise.all([
        db.select({ x: f }).from(f).innerJoin(r, eq(r.id, f.runId)).where(eq(r.versionId, doc.versionId)).orderBy(desc(f.confidence)),
        db.select({ id: c.id, page: c.page, section: c.section, content: c.content }).from(c).where(eq(c.versionId, doc.versionId)).orderBy(c.chunkIndex).limit(80),
        db.select({ code: j.errorCode }).from(j).where(eq(j.versionId, doc.versionId)).orderBy(desc(j.createdAt)).limit(1),
      ])
    : [[], [], []];

  const chunkPage = new Map(passageRows.map((p) => [p.id, p.page]));
  return {
    documentId: doc.id,
    title: doc.title,
    docType: doc.type as DocumentType,
    status: doc.status,
    version: doc.version ?? 1,
    pages: doc.pages ?? 0,
    mime: doc.mime ?? null,
    sizeBytes: doc.sizeBytes ?? 0,
    failure: doc.status === "rejected" || doc.status === "failed" ? describeFailure(jobRows[0]?.code) : null,
    fields: fieldRows.map(({ x }) => ({
      id: x.id,
      label: x.fieldPath,
      value: String(x.valueJson),
      confidence: x.confidence,
      page: (x.sourceChunkId && chunkPage.get(x.sourceChunkId)) || 1,
      status: x.reviewStatus,
      sourceChunkId: x.sourceChunkId,
    })),
    passages: passageRows,
  };
}

/** Looks up a field only if it belongs to the caller's organization. Prevents cross-tenant edits. */
export async function reviewField(t: Tenant, fieldId: string, status: "approved" | "rejected" | "edited") {
  if (!/^[0-9a-f-]{36}$/i.test(fieldId)) return false;
  const { orgId } = await ensureWorkspace(t);
  const db = getDb();
  const { extractedFields: f, extractionRuns: r, documentVersions: v, documents: d, workspaces: w } = schema;
  const [owned] = await db
    .select({ id: f.id })
    .from(f)
    .innerJoin(r, eq(r.id, f.runId))
    .innerJoin(v, eq(v.id, r.versionId))
    .innerJoin(d, eq(d.id, v.documentId))
    .innerJoin(w, eq(w.id, d.workspaceId))
    .where(and(eq(f.id, fieldId), eq(w.organizationId, orgId)))
    .limit(1);
  if (!owned) return false;
  await db.update(f).set({ reviewStatus: status, reviewedBy: t.userId }).where(eq(f.id, fieldId));
  return true;
}

export async function deleteDocument(t: Tenant, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return false;
  const { orgId } = await ensureWorkspace(t);
  const db = getDb();
  const { documents: d, workspaces: w, documentVersions: v } = schema;
  const [doc] = await db.select({ id: d.id }).from(d).innerJoin(w, eq(w.id, d.workspaceId)).where(and(eq(d.id, id), eq(w.organizationId, orgId))).limit(1);
  if (!doc) return false;
  const versions = await db.select({ key: v.objectKey }).from(v).where(eq(v.documentId, id));
  await db.delete(d).where(eq(d.id, id)); // versions, chunks, embeddings, jobs and fields cascade
  await storage.deleteObjects(versions.map((x) => x.key));
  return true;
}

export async function getDocumentFile(t: Tenant, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { orgId } = await ensureWorkspace(t);
  const { documents: d, workspaces: w, documentVersions: v } = schema;
  const [row] = await getDb()
    .select({ title: d.title, key: v.objectKey, mime: v.mime })
    .from(d)
    .innerJoin(w, eq(w.id, d.workspaceId))
    .innerJoin(v, eq(v.id, d.currentVersionId))
    .where(
      and(
        eq(d.id, id),
        eq(w.organizationId, orgId),
        sql`not exists (select 1 from document_acl a where a.resource_type = 'document' and a.resource_id = ${d.id} and a.principal_id = ${t.userId} and a.effect = 'deny')`,
      ),
    )
    .limit(1);
  if (!row) return null;
  const ext = EXT_BY_MIME[row.mime] ?? "bin";
  return { bytes: await storage.getObject(row.key), mime: row.mime, filename: `${row.title.replace(/[^\w.\- ]+/g, "").trim() || "document"}.${ext}` };
}

export async function countDocuments(t: Tenant): Promise<number> {
  return (await getStats(t)).totalDocuments;
}

