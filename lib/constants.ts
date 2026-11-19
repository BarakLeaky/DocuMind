export const PROCESSING_STATES = [
  "uploaded", "queued", "validating", "extracting", "ocr", "normalizing", "chunking",
  "embedding", "indexing", "ready", "partially_processed", "rejected", "failed", "cancelled",
] as const;
export type ProcessingState = (typeof PROCESSING_STATES)[number];

export const DOCUMENT_TYPES = ["Invoice", "Contract", "Policy", "Proposal", "Report", "Form", "Other"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export type Tone = "ok" | "warn" | "danger" | "info" | "neutral";

export const STATUS_META: Record<ProcessingState, { label: string; tone: Tone }> = {
  uploaded: { label: "Uploaded", tone: "neutral" },
  queued: { label: "Queued", tone: "neutral" },
  validating: { label: "Validating", tone: "info" },
  extracting: { label: "Extracting", tone: "info" },
  ocr: { label: "OCR", tone: "info" },
  normalizing: { label: "Normalizing", tone: "info" },
  chunking: { label: "Chunking", tone: "info" },
  embedding: { label: "Embedding", tone: "info" },
  indexing: { label: "Indexing", tone: "info" },
  ready: { label: "Ready", tone: "ok" },
  partially_processed: { label: "Partial", tone: "warn" },
  rejected: { label: "Rejected", tone: "danger" },
  failed: { label: "Failed", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};
