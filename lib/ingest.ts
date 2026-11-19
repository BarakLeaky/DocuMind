/**
 * Ingestion pipeline: extract text -> chunk -> index -> embed -> extract fields -> publish.
 *
 * Runs inline after an upload (via `after()` in the documents route) and can also be driven by
 * `npm run worker` or the cron route to pick up retries. Chunks and embeddings use unique constraints,
 * so re-running a job never creates duplicates.
 */
import { eq, sql } from "drizzle-orm";
import * as mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import { getDb, schema } from "@/db";
import { embedTexts, embeddingsEnabled } from "@/lib/ai/embeddings";
import { extractFields } from "@/lib/ai/extract";
import { createChunks, type PageText } from "@/lib/chunking";
import { env } from "@/lib/env";
import { storage } from "@/lib/storage";

export const PIPELINE_VERSION = "ingest-v2";
const MAX_ATTEMPTS = 3;

type Claimed = { id: string; version_id: string; attempts: number };
type State = (typeof schema.processingStateEnum.enumValues)[number];

class PermanentError extends Error {}

async function claim(jobId?: string): Promise<Claimed | null> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const only = jobId ? sql`and id = ${jobId}` : sql``;
    const rows = (await tx.execute(sql`
      select id, version_id, attempts from processing_jobs
      where state = 'queued' and (next_attempt_at is null or next_attempt_at <= now()) ${only}
      order by created_at limit 1 for update skip locked`)) as unknown as Claimed[];
    const job = rows[0];
    if (!job) return null;
    await tx
      .update(schema.processingJobs)
      .set({ state: "extracting", attempts: job.attempts + 1, updatedAt: new Date() })
      .where(eq(schema.processingJobs.id, job.id));
    return job;
  });
}

async function step<T>(jobId: string, documentId: string, state: State, fn: () => Promise<T>): Promise<T> {
  const db = getDb();
  const [row] = await db.insert(schema.processingSteps).values({ jobId, stepName: state, status: "running" }).returning({ id: schema.processingSteps.id });
  await db.update(schema.processingJobs).set({ state, updatedAt: new Date() }).where(eq(schema.processingJobs.id, jobId));
  await db.update(schema.documents).set({ status: state, updatedAt: new Date() }).where(eq(schema.documents.id, documentId));
  try {
    const out = await fn();
    await db.update(schema.processingSteps).set({ status: "done", completedAt: new Date() }).where(eq(schema.processingSteps.id, row.id));
    return out;
  } catch (err) {
    await db.update(schema.processingSteps).set({ status: "failed", completedAt: new Date() }).where(eq(schema.processingSteps.id, row.id));
    throw err;
  }
}

async function extractPages(buf: Buffer, mime: string): Promise<PageText[]> {
  if (mime === "application/pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await extractText(pdf, { mergePages: false });
    const pages = (Array.isArray(text) ? text : [text]).map((t, i) => ({ page: i + 1, text: t }));
    if (pages.every((p) => p.text.trim().length < 20)) throw new PermanentError("scanned_pdf_requires_ocr");
    return pages;
  }
  if (mime === "text/plain") return [{ page: 1, text: buf.toString("utf8") }];
  if (mime.includes("wordprocessingml")) {
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return [{ page: 1, text: value }];
  }
  throw new PermanentError(`unsupported_mime:${mime}`);
}

export async function runJob(job: Claimed) {
  const db = getDb();
  const [version] = await db.select().from(schema.documentVersions).where(eq(schema.documentVersions.id, job.version_id));
  const documentId = version.documentId;
  try {
    const pages = await step(job.id, documentId, "extracting", async () => extractPages(await storage.getObject(version.objectKey), version.mime));
    const chunks = await step(job.id, documentId, "chunking", async () => createChunks(pages));
    if (chunks.length === 0) throw new PermanentError("no_text_extracted");

    const inserted = await step(job.id, documentId, "indexing", async () => {
      await db.insert(schema.documentChunks).values(chunks.map((c) => ({ versionId: version.id, ...c }))).onConflictDoNothing();
      return db
        .select({ id: schema.documentChunks.id, content: schema.documentChunks.content, chunkIndex: schema.documentChunks.chunkIndex })
        .from(schema.documentChunks)
        .where(eq(schema.documentChunks.versionId, version.id))
        .orderBy(schema.documentChunks.chunkIndex);
    });

    // Semantic search is optional: without an embeddings key, keyword search still works and the document is fully ready.
    let partial = false;
    if (embeddingsEnabled) {
      await step(job.id, documentId, "embedding", async () => {
        const BATCH = 64;
        for (let i = 0; i < inserted.length; i += BATCH) {
          const batch = inserted.slice(i, i + BATCH);
          const vectors = await embedTexts(batch.map((b) => b.content)).catch(() => null);
          if (!vectors) { partial = true; break; }
          await db.insert(schema.documentEmbeddings).values(batch.map((b, j) => ({ chunkId: b.id, modelId: env.EMBEDDING_MODEL, embedding: vectors[j] }))).onConflictDoNothing();
        }
      });
    }

    // Field extraction is best-effort: a failure here never blocks the document from becoming searchable.
    if (env.ANTHROPIC_API_KEY) {
      await step(job.id, documentId, "normalizing", async () => {
        try {
          const result = await extractFields(inserted);
          if (!result) return;
          const [run] = await db
            .insert(schema.extractionRuns)
            .values({ versionId: version.id, status: "completed", modelId: result.model })
            .returning({ id: schema.extractionRuns.id });
          if (result.fields.length > 0) {
            await db.insert(schema.extractedFields).values(
              result.fields.map((f) => ({ runId: run.id, fieldPath: f.label, valueJson: f.value, confidence: f.confidence, sourceChunkId: f.sourceChunkId })),
            );
          }
          await db.update(schema.documents).set({ docType: result.docType }).where(eq(schema.documents.id, documentId));
        } catch (err) {
          console.error(`[ingest] field extraction skipped for ${documentId}:`, err instanceof Error ? err.message : err);
        }
      });
    }

    const final = partial ? "partially_processed" : "ready";
    await db.update(schema.documentVersions).set({ pageCount: pages.length }).where(eq(schema.documentVersions.id, version.id));
    await db.update(schema.processingJobs).set({ state: final, errorCode: null, updatedAt: new Date() }).where(eq(schema.processingJobs.id, job.id));
    await db.update(schema.documents).set({ status: final, updatedAt: new Date() }).where(eq(schema.documents.id, documentId));
    console.log(`[ingest] ${documentId} -> ${final} (${chunks.length} chunks)`);
  } catch (err) {
    const permanent = err instanceof PermanentError;
    const exhausted = job.attempts + 1 >= MAX_ATTEMPTS;
    const code = err instanceof Error ? err.message.slice(0, 120) : "unknown";
    const terminal = permanent || exhausted;
    const backoffMs = Math.min(60_000 * 2 ** job.attempts, 15 * 60_000) + Math.random() * 5_000;
    const next = terminal ? (permanent ? "rejected" : "failed") : "queued";
    await db.update(schema.processingJobs).set({
      state: next,
      errorCode: code,
      nextAttemptAt: terminal ? null : new Date(Date.now() + backoffMs),
      updatedAt: new Date(),
    }).where(eq(schema.processingJobs.id, job.id));
    await db.update(schema.documents).set({ status: next, updatedAt: new Date() }).where(eq(schema.documents.id, documentId));
    console.error(`[ingest] ${documentId} ${terminal ? "terminal" : "will retry"}: ${code}`);
  }
}

/** Claims and runs one specific job (used right after an upload). */
export async function runJobById(jobId: string) {
  const job = await claim(jobId);
  if (job) await runJob(job);
}

/** Claims and runs up to `max` queued jobs that are due (used by the worker and the cron route). */
export async function drainQueue(max = 5): Promise<number> {
  let done = 0;
  while (done < max) {
    const job = await claim();
    if (!job) break;
    await runJob(job);
    done++;
  }
  return done;
}
