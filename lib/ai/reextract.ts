import { and, asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Tenant } from "@/lib/auth";
import { extractFields, extractionEnabled } from "@/lib/ai/extract";
import { AppError, notFound } from "@/lib/errors";
import { ensureWorkspace } from "@/lib/tenancy";

/** Re-runs AI extraction on a document's current version. Replaces the previous run and its review marks. */
export async function reextractDocument(t: Tenant, documentId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(documentId)) throw notFound("Document");
  if (!extractionEnabled) throw new AppError("ai_unavailable", 503, "AI extraction isn't configured. Add ANTHROPIC_API_KEY to your environment.");
  const { orgId } = await ensureWorkspace(t);
  const db = getDb();
  const { documents: d, workspaces: w } = schema;

  const [doc] = await db
    .select({ id: d.id, versionId: d.currentVersionId })
    .from(d)
    .innerJoin(w, eq(w.id, d.workspaceId))
    .where(and(eq(d.id, documentId), eq(w.organizationId, orgId)))
    .limit(1);
  if (!doc?.versionId) throw notFound("Document");

  const passages = await db
    .select({ id: schema.documentChunks.id, content: schema.documentChunks.content })
    .from(schema.documentChunks)
    .where(eq(schema.documentChunks.versionId, doc.versionId))
    .orderBy(asc(schema.documentChunks.chunkIndex));
  if (passages.length === 0) throw new AppError("no_text", 422, "This document has no readable text to extract from.");

  const result = await extractFields(passages);
  if (!result) throw new AppError("no_result", 502, "The AI returned no fields. Try again.");

  await db.transaction(async (tx) => {
    await tx.delete(schema.extractionRuns).where(eq(schema.extractionRuns.versionId, doc.versionId!)); // fields cascade
    const [run] = await tx.insert(schema.extractionRuns).values({ versionId: doc.versionId!, status: "completed", modelId: result.model }).returning({ id: schema.extractionRuns.id });
    if (result.fields.length > 0) {
      await tx.insert(schema.extractedFields).values(result.fields.map((f) => ({ runId: run.id, fieldPath: f.label, valueJson: f.value, confidence: f.confidence, sourceChunkId: f.sourceChunkId })));
    }
    await tx.update(schema.documents).set({ docType: result.docType, updatedAt: new Date() }).where(eq(schema.documents.id, documentId));
  });
  return { fields: result.fields.length, model: result.model };
}
