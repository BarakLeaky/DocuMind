"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTenant, requirePermission } from "@/lib/auth";
import { deleteDocument, getReview, reviewField } from "@/lib/data";
import { reextractDocument } from "@/lib/ai/reextract";
import { enforceRateLimit } from "@/lib/rate-limit";
import { approveAllPending } from "@/lib/review-center";
import { audit } from "@/lib/tenancy";

const reviewInput = z.object({
  fieldId: z.string().min(1),
  status: z.enum(["approved", "rejected", "edited"]),
  documentId: z.string().min(1),
});

/** Thin authenticated adapter for the review UI. The tenant check lives in `reviewField`. */
export async function reviewFieldAction(raw: z.infer<typeof reviewInput>) {
  const { fieldId, status, documentId } = reviewInput.parse(raw);
  const tenant = await getTenant();
  requirePermission(tenant, "extraction.run");
  const ok = await reviewField(tenant, fieldId, status);
  if (!ok) throw new Error("Field not found");
  await audit(tenant, `extraction.review.${status}`, "extracted_field", fieldId);
  revalidatePath(`/documents/${documentId}`);
  return { ok: true as const };
}

export async function deleteDocumentAction(documentId: string) {
  const tenant = await getTenant();
  requirePermission(tenant, "document.delete");
  const ok = await deleteDocument(tenant, documentId);
  if (!ok) throw new Error("Document not found");
  await audit(tenant, "document.delete", "document", documentId);
  revalidatePath("/documents");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

const docId = z.string().regex(/^[0-9a-f-]{36}$/i);

/** Approves every pending field on the document. Rejected fields stay rejected, and a document with rejections can't be approved. */
export async function approveDocumentAction(raw: { documentId: string; note?: string }) {
  const documentId = docId.parse(raw.documentId);
  const tenant = await getTenant();
  requirePermission(tenant, "extraction.run");
  const result = await approveAllPending(tenant, documentId);
  if (!result) throw new Error("Document not found");
  if (result.rejected > 0) throw new Error(`${result.rejected} rejected ${result.rejected === 1 ? "field needs" : "fields need"} to be fixed or removed before approval.`);
  await audit(tenant, "document.approved", "document", documentId, { fieldsApproved: result.approved, note: raw.note?.slice(0, 1000) });
  revalidatePath("/dashboard");
  revalidatePath(`/documents/${documentId}`);
  return { ok: true as const, approved: result.approved };
}

export async function sendToReviewAction(raw: { documentId: string; note?: string }) {
  const documentId = docId.parse(raw.documentId);
  const tenant = await getTenant();
  requirePermission(tenant, "extraction.run");
  if (!(await getReview(tenant, documentId))) throw new Error("Document not found");
  await audit(tenant, "document.sent_to_review", "document", documentId, { note: raw.note?.slice(0, 1000) });
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function saveReviewNoteAction(raw: { documentId: string; note: string }) {
  const documentId = docId.parse(raw.documentId);
  const note = z.string().max(1000).parse(raw.note);
  const tenant = await getTenant();
  requirePermission(tenant, "extraction.run");
  if (!(await getReview(tenant, documentId))) throw new Error("Document not found");
  await audit(tenant, "document.review_note", "document", documentId, { note });
  return { ok: true as const };
}

/** Re-runs the AI extraction for one document. Review marks on the old fields are cleared. */
export async function reextractAction(raw: { documentId: string }) {
  const documentId = docId.parse(raw.documentId);
  const tenant = await getTenant();
  requirePermission(tenant, "extraction.run");
  await enforceRateLimit(tenant, "ai");
  const result = await reextractDocument(tenant, documentId);
  await audit(tenant, "document.reextracted", "document", documentId, { fields: result.fields, model: result.model });
  revalidatePath("/dashboard");
  revalidatePath(`/documents/${documentId}`);
  return { ok: true as const, ...result };
}