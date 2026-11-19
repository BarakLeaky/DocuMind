import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Tenant } from "@/lib/auth";
import { getReview } from "@/lib/data";
import { ensureWorkspace } from "@/lib/tenancy";
import type { Review } from "@/lib/types";
import {
  confidenceLabel, detectAmountAnomaly, findField, isTotalLabel, overallConfidence, parseMoney, runChecks, summariseChecks,
  type Anomaly, type Check,
} from "@/lib/validation";

export type TimelineEvent = { id: string; kind: "upload" | "extracted" | "validation" | "anomaly" | "review" | "approved" | "exported" | "note"; title: string; detail?: string; at: string };

export type Cockpit = {
  review: Review;
  checks: Check[];
  summary: { passed: number; warnings: number; failed: number; total: number };
  anomalies: Anomaly[];
  timeline: TimelineEvent[];
  confidence: number | null;
  confidenceLabel: { label: string; tone: "ok" | "warn" | "danger" | "neutral" };
  note: string;
  decision: "approved" | "sent_to_review" | null;
  modelId: string | null;
};

const ACTIONS = {
  approved: "document.approved", sent: "document.sent_to_review", note: "document.review_note", exported: "document.exported",
} as const;

/** Totals from other documents of the same type, newest first. Used as the baseline for anomaly detection. */
async function recentTotals(t: Tenant, review: Review): Promise<number[]> {
  const { orgId } = await ensureWorkspace(t);
  const { extractedFields: f, extractionRuns: r, documents: d, workspaces: w } = schema;
  const rows = await getDb()
    .select({ label: f.fieldPath, value: f.valueJson })
    .from(f)
    .innerJoin(r, eq(r.id, f.runId))
    .innerJoin(d, eq(d.currentVersionId, r.versionId))
    .innerJoin(w, eq(w.id, d.workspaceId))
    .where(and(eq(w.organizationId, orgId), eq(d.docType, review.docType), ne(d.id, review.documentId), sql`${d.createdAt} > now() - interval '180 days'`))
    .orderBy(desc(d.createdAt))
    .limit(300);
  return rows.filter((x) => isTotalLabel(x.label)).map((x) => parseMoney(String(x.value))).filter((n): n is number => n != null).slice(0, 25);
}

async function buildTimeline(t: Tenant, review: Review, checks: Check[], anomalies: Anomaly[]): Promise<{ events: TimelineEvent[]; note: string; decision: Cockpit["decision"]; modelId: string | null }> {
  const db = getDb();
  const { orgId } = await ensureWorkspace(t);
  const { auditLogs: a, documents: d, processingJobs: j, processingSteps: s, extractionRuns: r, documentVersions: v } = schema;

  const [doc] = await db.select({ createdAt: d.createdAt, versionId: d.currentVersionId, updatedAt: d.updatedAt }).from(d).where(eq(d.id, review.documentId)).limit(1);
  const logs = await db
    .select()
    .from(a)
    .where(and(eq(a.organizationId, orgId), eq(a.resourceType, "document"), eq(a.resourceId, review.documentId), inArray(a.action, [ACTIONS.approved, ACTIONS.sent, ACTIONS.note, ACTIONS.exported])))
    .orderBy(asc(a.createdAt));

  const [normalized] = doc?.versionId
    ? await db.select({ at: s.completedAt }).from(s).innerJoin(j, eq(j.id, s.jobId)).innerJoin(v, eq(v.id, j.versionId)).where(and(eq(v.id, doc.versionId), eq(s.stepName, "normalizing"), eq(s.status, "done"))).orderBy(desc(s.startedAt)).limit(1)
    : [];
  const [run] = doc?.versionId ? await db.select({ model: r.modelId, at: r.createdAt }).from(r).where(eq(r.versionId, doc.versionId)).orderBy(desc(r.createdAt)).limit(1) : [];

  const events: TimelineEvent[] = [];
  if (doc) events.push({ id: "upload", kind: "upload", title: "Document uploaded", at: doc.createdAt.toISOString() });
  if (run) events.push({ id: "extracted", kind: "extracted", title: "Data extracted", detail: run.model ?? undefined, at: (normalized?.at ?? run.at).toISOString() });
  const when = (run?.at ?? doc?.updatedAt ?? new Date()).toISOString();
  if (review.fields.length > 0) {
    const sum = summariseChecks(checks);
    events.push({ id: "validation", kind: "validation", title: "Validation checks", detail: `${sum.passed} passed${sum.failed ? `, ${sum.failed} failed` : ""}${sum.warnings ? `, ${sum.warnings} warning${sum.warnings === 1 ? "" : "s"}` : ""}`, at: when });
  }
  for (const an of anomalies) events.push({ id: an.id, kind: "anomaly", title: "Anomaly detected", detail: an.field, at: when });

  let note = "";
  let decision: Cockpit["decision"] = null;
  const names = new Map<string, string>();
  for (const l of logs) {
    const who = l.actorId === t.userId ? "You" : (names.get(l.actorId) ?? "A teammate");
    const meta = l.metadata ?? {};
    if (l.action === ACTIONS.note) { note = typeof meta.note === "string" ? meta.note : ""; events.push({ id: l.id, kind: "note", title: "Note added", detail: who, at: l.createdAt.toISOString() }); }
    if (l.action === ACTIONS.sent) { decision = "sent_to_review"; events.push({ id: l.id, kind: "review", title: "Sent to review", detail: who, at: l.createdAt.toISOString() }); }
    if (l.action === ACTIONS.approved) { decision = "approved"; events.push({ id: l.id, kind: "approved", title: "Approved", detail: who, at: l.createdAt.toISOString() }); }
    if (l.action === ACTIONS.exported) events.push({ id: l.id, kind: "exported", title: "Exported", detail: typeof meta.format === "string" ? String(meta.format).toUpperCase() : who, at: l.createdAt.toISOString() });
  }
  events.sort((x, y) => x.at.localeCompare(y.at));
  return { events: events.slice(-8), note, decision, modelId: run?.model ?? null };
}

/** Everything the dashboard cockpit shows, computed from the real extraction results. Null when the document is not visible to the caller. */
export async function getCockpit(t: Tenant, documentId: string): Promise<Cockpit | null> {
  const review = await getReview(t, documentId);
  if (!review) return null;

  const checks = runChecks(review.fields, review.docType);
  const total = findField(review.fields, /^total( amount| due)?$/, /amount due/, /grand total/);
  const anomalies: Anomaly[] = [];
  if (total && isTotalLabel(total.label)) {
    const an = detectAmountAnomaly(parseMoney(total.value), await recentTotals(t, review), total.label);
    if (an) anomalies.push(an);
  }

  const tl = await buildTimeline(t, review, checks, anomalies);
  const confidence = overallConfidence(review.fields);
  return { review, checks, summary: summariseChecks(checks), anomalies, timeline: tl.events, confidence, confidenceLabel: confidenceLabel(confidence), note: tl.note, decision: tl.decision, modelId: tl.modelId };
}

/** The newest ready document that still needs a human decision; otherwise the newest one with extracted fields. */
export async function pickCockpitDocument(t: Tenant, candidates: { id: string; status: string }[]): Promise<Cockpit | null> {
  let fallback: Cockpit | null = null;
  for (const d of candidates.filter((x) => x.status === "ready" || x.status === "partially_processed").slice(0, 8)) {
    const c = await getCockpit(t, d.id);
    if (!c || c.review.fields.length === 0) continue;
    if (c.decision !== "approved") return c;
    fallback ??= c;
  }
  return fallback;
}

/** Marks every still-pending field approved. Fields a person already rejected stay rejected. */
export async function approveAllPending(t: Tenant, documentId: string) {
  const review = await getReview(t, documentId);
  if (!review) return null;
  const pending = review.fields.filter((f) => f.status === "pending").map((f) => f.id);
  if (pending.length > 0) {
    await getDb().update(schema.extractedFields).set({ reviewStatus: "approved", reviewedBy: t.userId }).where(inArray(schema.extractedFields.id, pending));
  }
  return { approved: pending.length, rejected: review.fields.filter((f) => f.status === "rejected").length };
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function buildExport(review: Review, format: "json" | "csv") {
  const rows = review.fields.map((f) => ({ field: f.label, value: f.value, confidence: Math.round(f.confidence * 100) / 100, page: f.page, review_status: f.status }));
  const base = review.title.replace(/\.[^.]+$/, "").replace(/[^\w.\- ]+/g, "").trim() || "document";
  if (format === "csv") {
    const body = [["field", "value", "confidence", "page", "review_status"], ...rows.map((r) => [r.field, r.value, String(r.confidence), String(r.page), r.review_status])].map((r) => r.map(csvCell).join(",")).join("\n");
    return { body, mime: "text/csv; charset=utf-8", filename: `${base}.csv` };
  }
  return {
    body: JSON.stringify({ document: review.title, type: review.docType, version: review.version, exportedAt: new Date().toISOString(), fields: rows }, null, 2),
    mime: "application/json", filename: `${base}.json`,
  };
}
