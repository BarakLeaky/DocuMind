import { createHash } from "node:crypto";
import { NextResponse, after } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { getTenant, requirePermission } from "@/lib/auth";
import { PROCESSING_STATES } from "@/lib/constants";
import { getStorageUsage, listDocuments } from "@/lib/data";
import { env } from "@/lib/env";
import { AppError, handle, notFound } from "@/lib/errors";
import { PIPELINE_VERSION, runJobById } from "@/lib/ingest";
import { detectFileType, safeTenant, storage } from "@/lib/storage";
import { audit, ensureWorkspace } from "@/lib/tenancy";

/** Ingestion runs after the response is sent; this gives it room to finish. */
export const maxDuration = 60;

const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  cursor: z.string().optional(),
  status: z.enum(PROCESSING_STATES).optional(),
  q: z.string().max(200).optional(),
});

export const GET = handle(async (req) => {
  const tenant = await getTenant();
  requirePermission(tenant, "document.read");
  const params = listQuery.parse(Object.fromEntries(new URL(req.url).searchParams));
  return NextResponse.json(await listDocuments(tenant, params));
});

const registerBody = z.object({
  key: z.string().min(8).max(200),
  title: z.string().min(1).max(300),
});

/** Verifies the uploaded object, then registers the document + immutable version + queued job atomically. */
export const POST = handle(async (req) => {
  const tenant = await getTenant();
  requirePermission(tenant, "document.upload");
  const input = registerBody.parse(await req.json());

  // The key must belong to this tenant; otherwise someone could register another tenant's upload.
  if (!input.key.startsWith(`${safeTenant(tenant.tenantKey)}/`)) throw notFound("Uploaded object");
  if (!(await storage.exists(input.key))) throw notFound("Uploaded object");
  const bytes = await storage.getObject(input.key);

  const reject = async (err: AppError) => {
    await storage.deleteObjects([input.key]);
    throw err;
  };
  if (bytes.length > env.MAX_UPLOAD_MB * 1024 * 1024) await reject(new AppError("quota_exceeded", 413, `Files are limited to ${env.MAX_UPLOAD_MB} MB`));
  const detected = detectFileType(bytes);
  if (!detected) await reject(new AppError("unsupported_type", 415, "This file isn't a readable PDF, Word (.docx) or text file."));

  const usage = await getStorageUsage(tenant);
  if (usage.usedBytes + bytes.length > usage.quotaBytes) await reject(new AppError("quota_exceeded", 413, "Your workspace storage is full. Delete documents to free space."));

  const mime = detected!.mime;
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const { workspaceId } = await ensureWorkspace(tenant);
  const db = getDb();
  const result = await db.transaction(async (tx) => {
    const [doc] = await tx.insert(schema.documents).values({ workspaceId, title: input.title, status: "queued", createdBy: tenant.userId }).returning();
    const [version] = await tx
      .insert(schema.documentVersions)
      .values({ documentId: doc.id, versionNumber: 1, objectKey: input.key, checksum, mime, sizeBytes: bytes.length, createdBy: tenant.userId })
      .returning();
    await tx.update(schema.documents).set({ currentVersionId: version.id }).where(eq(schema.documents.id, doc.id));
    const [job] = await tx
      .insert(schema.processingJobs)
      .values({ versionId: version.id, jobKey: `${version.id}:${PIPELINE_VERSION}:ingest`, processorVersion: PIPELINE_VERSION })
      .returning();
    return { doc, job };
  });

  await audit(tenant, "document.upload", "document", result.doc.id, { title: input.title, checksum, mime });
  after(() => runJobById(result.job.id).catch((e) => console.error("[ingest] inline run failed", e)));
  return NextResponse.json({ document: { id: result.doc.id, status: "queued" }, jobId: result.job.id }, { status: 201 });
});
