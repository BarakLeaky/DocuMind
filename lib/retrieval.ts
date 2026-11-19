import { and, cosineDistance, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Tenant } from "@/lib/auth";
import { embedTexts } from "@/lib/ai/embeddings";
import { env } from "@/lib/env";
import { reciprocalRankFusion } from "@/lib/rrf";
import { ensureWorkspace } from "@/lib/tenancy";
import type { Evidence } from "@/lib/citations";

export async function retrieve(tenant: Tenant, query: string, limit = 8): Promise<Evidence[]> {
  return retrieveDb(tenant, query, limit);
}

async function retrieveDb(tenant: Tenant, query: string, limit: number): Promise<Evidence[]> {
  const db = getDb();
  const { orgId } = await ensureWorkspace(tenant);
  const { documentChunks: ch, documentVersions: v, documents: d, workspaces: w, documentEmbeddings: e } = schema;

  // Authorization is applied in SQL, before any text can reach a model.
  const scope = and(
    eq(w.organizationId, orgId),
    inArray(d.status, ["ready", "partially_processed"]), // keyword search works even when embeddings are missing
    eq(d.currentVersionId, v.id), // exclude superseded versions
    sql`not exists (select 1 from document_acl a where a.resource_type = 'document' and a.resource_id = ${d.id} and a.principal_id = ${tenant.userId} and a.effect = 'deny')`,
  );

  const select = {
    chunkId: ch.id,
    documentId: d.id,
    documentTitle: d.title,
    versionId: v.id,
    versionNumber: v.versionNumber,
    page: ch.page,
    section: ch.section,
    content: ch.content,
  };

  const tsQuery = sql`websearch_to_tsquery('english', ${query})`;
  const keyword = await db
    .select(select)
    .from(ch)
    .innerJoin(v, eq(v.id, ch.versionId))
    .innerJoin(d, eq(d.id, v.documentId))
    .innerJoin(w, eq(w.id, d.workspaceId))
    .where(and(scope, sql`${ch.search} @@ ${tsQuery}`))
    .orderBy(desc(sql`ts_rank_cd(${ch.search}, ${tsQuery})`))
    .limit(20);

  let semantic: typeof keyword = [];
  const vectors = await embedTexts([query]).catch(() => null);
  if (vectors) {
    semantic = await db
      .select(select)
      .from(e)
      .innerJoin(ch, eq(ch.id, e.chunkId))
      .innerJoin(v, eq(v.id, ch.versionId))
      .innerJoin(d, eq(d.id, v.documentId))
      .innerJoin(w, eq(w.id, d.workspaceId))
      .where(and(scope, eq(e.modelId, env.EMBEDDING_MODEL)))
      .orderBy(cosineDistance(e.embedding, vectors[0]))
      .limit(20);
  }

  const byId = new Map([...keyword, ...semantic].map((r) => [r.chunkId, r]));
  return reciprocalRankFusion([
    { source: "keyword", ids: keyword.map((r) => r.chunkId) },
    { source: "semantic", ids: semantic.map((r) => r.chunkId) },
  ])
    .slice(0, limit)
    .map((f) => ({ ...byId.get(f.id)!, score: f.score, via: f.sources }));
}
