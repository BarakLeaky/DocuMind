import type { DocumentType, ProcessingState } from "@/lib/constants";

export type DocumentRow = {
  id: string;
  title: string;
  type: DocumentType;
  collection: string;
  status: ProcessingState;
  pages: number;
  version: number;
  sizeBytes: number;
  owner: string;
  updatedAt: string;
  confidence: number | null;
};

const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

export const demoDocuments: DocumentRow[] = [
  { id: "d-001", title: "Invoice INV-2026-0418 — Northwind Logistics", type: "Invoice", collection: "Finance", status: "ready", pages: 2, version: 1, sizeBytes: 218_000, owner: "Amina Otieno", updatedAt: ago(0.4), confidence: 0.94 },
  { id: "d-002", title: "Master Services Agreement — Kilimani Cloud", type: "Contract", collection: "Legal", status: "ready", pages: 38, version: 3, sizeBytes: 1_940_000, owner: "Brian Mwangi", updatedAt: ago(2), confidence: 0.91 },
  { id: "d-003", title: "Data Retention Policy 2026", type: "Policy", collection: "Compliance", status: "ready", pages: 14, version: 2, sizeBytes: 640_000, owner: "Amina Otieno", updatedAt: ago(5), confidence: 0.97 },
  { id: "d-004", title: "Q3 Operations Report", type: "Report", collection: "Operations", status: "ocr", pages: 52, version: 1, sizeBytes: 8_400_000, owner: "Grace Wanjiru", updatedAt: ago(0.1), confidence: null },
  { id: "d-005", title: "Supplier Onboarding Form — Savanna Freight", type: "Form", collection: "Procurement", status: "partially_processed", pages: 6, version: 1, sizeBytes: 912_000, owner: "Brian Mwangi", updatedAt: ago(9), confidence: 0.72 },
  { id: "d-006", title: "Project Proposal — Nairobi Smart Depot", type: "Proposal", collection: "Sales", status: "embedding", pages: 24, version: 2, sizeBytes: 3_100_000, owner: "Grace Wanjiru", updatedAt: ago(0.2), confidence: null },
  { id: "d-007", title: "Information Security Policy", type: "Policy", collection: "Compliance", status: "ready", pages: 21, version: 4, sizeBytes: 780_000, owner: "Amina Otieno", updatedAt: ago(30), confidence: 0.96 },
  { id: "d-008", title: "Scanned Delivery Notes — October", type: "Form", collection: "Operations", status: "failed", pages: 120, version: 1, sizeBytes: 41_000_000, owner: "Grace Wanjiru", updatedAt: ago(12), confidence: null },
  { id: "d-009", title: "Statement of Work — Data Platform Phase 2", type: "Contract", collection: "Legal", status: "queued", pages: 11, version: 1, sizeBytes: 520_000, owner: "Brian Mwangi", updatedAt: ago(0.05), confidence: null },
  { id: "d-010", title: "Invoice INV-2026-0391 — Rift Valley Power", type: "Invoice", collection: "Finance", status: "ready", pages: 1, version: 1, sizeBytes: 140_000, owner: "Amina Otieno", updatedAt: ago(48), confidence: 0.98 },
  { id: "d-011", title: "Annual Compliance Review 2025", type: "Report", collection: "Compliance", status: "ready", pages: 63, version: 1, sizeBytes: 5_200_000, owner: "Brian Mwangi", updatedAt: ago(70), confidence: 0.93 },
  { id: "d-012", title: "Vendor Risk Assessment Template", type: "Form", collection: "Procurement", status: "rejected", pages: 3, version: 1, sizeBytes: 90_000, owner: "Grace Wanjiru", updatedAt: ago(96), confidence: null },
];

export const demoStats = {
  totalDocuments: 1284,
  processedThisWeek: 212,
  medianTimeToSearchableSec: 94,
  citationAccuracy: 0.987,
  deltas: { totalDocuments: 8.2, processedThisWeek: 14.6, medianTime: -11.3, citationAccuracy: 0.4 },
};

export const demoIngestionSeries = Array.from({ length: 14 }, (_, i) => {
  const day = new Date(Date.now() - (13 - i) * 86_400_000);
  const base = 28 + Math.round(Math.sin(i / 2) * 9) + i;
  return {
    day: day.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
    ingested: base,
    failed: Math.max(0, Math.round(base * 0.06) - (i % 3)),
  };
});

export const demoPipeline: { state: ProcessingState; count: number }[] = [
  { state: "ready", count: 1196 },
  { state: "queued", count: 14 },
  { state: "ocr", count: 9 },
  { state: "embedding", count: 11 },
  { state: "partially_processed", count: 7 },
  { state: "failed", count: 4 },
];

export type ExtractedField = {
  id: string;
  label: string;
  value: string;
  confidence: number;
  page: number;
  status: "pending" | "approved" | "edited" | "rejected";
};

export const demoReview = {
  documentId: "d-001",
  title: "Invoice INV-2026-0418 — Northwind Logistics",
  version: 1,
  page: 1,
  pages: 2,
  paper: {
    number: "INV-2026-0418",
    vendor: "Northwind Logistics Ltd",
    vendorAddress: "14 Mombasa Road, Nairobi, Kenya",
    billTo: "Kilimani Cloud Ltd",
    billToAddress: "Argwings Kodhek Rd, Nairobi, Kenya",
    date: "12 Nov 2026",
    due: "12 Dec 2026",
    terms: "Net 30",
    po: "PO-77120",
    lines: [
      { desc: "Freight forwarding — Nairobi ⇄ Mombasa (x6)", qty: 6, unit: 1450, total: 8700 },
      { desc: "Warehouse handling and cross-docking", qty: 1, unit: 2200, total: 2200 },
      { desc: "Customs documentation", qty: 1, unit: 650, total: 650 },
    ],
    subtotal: 11550,
    tax: 1848,
    total: 13398,
    currency: "USD",
  },
  fields: [
    { id: "f1", label: "Document type", value: "Invoice", confidence: 0.99, page: 1, status: "approved" },
    { id: "f2", label: "Invoice number", value: "INV-2026-0418", confidence: 0.98, page: 1, status: "approved" },
    { id: "f3", label: "Vendor", value: "Northwind Logistics Ltd", confidence: 0.97, page: 1, status: "pending" },
    { id: "f4", label: "Bill to", value: "Kilimani Cloud Ltd", confidence: 0.95, page: 1, status: "pending" },
    { id: "f5", label: "Invoice date", value: "2026-11-12", confidence: 0.96, page: 1, status: "pending" },
    { id: "f6", label: "Due date", value: "2026-12-12", confidence: 0.88, page: 1, status: "pending" },
    { id: "f7", label: "Payment terms", value: "Net 30", confidence: 0.93, page: 1, status: "pending" },
    { id: "f8", label: "PO reference", value: "PO-77120", confidence: 0.81, page: 1, status: "pending" },
    { id: "f9", label: "Subtotal", value: "USD 11,550.00", confidence: 0.97, page: 1, status: "pending" },
    { id: "f10", label: "VAT (16%)", value: "USD 1,848.00", confidence: 0.94, page: 1, status: "pending" },
    { id: "f11", label: "Total", value: "USD 13,398.00", confidence: 0.99, page: 1, status: "pending" },
  ] satisfies ExtractedField[],
};

export type DemoChunk = {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  versionId: string;
  versionNumber: number;
  page: number;
  section: string;
  content: string;
};

export const demoChunks: DemoChunk[] = [
  { chunkId: "c-001", documentId: "d-002", documentTitle: "Master Services Agreement — Kilimani Cloud", versionId: "v-002-3", versionNumber: 3, page: 17, section: "12. Termination", content: "Either party may terminate this Agreement for convenience by giving ninety (90) days' prior written notice to the other party. Upon termination, the Customer shall pay all fees accrued up to the effective date of termination." },
  { chunkId: "c-002", documentId: "d-002", documentTitle: "Master Services Agreement — Kilimani Cloud", versionId: "v-002-3", versionNumber: 3, page: 18, section: "12.3 Termination for cause", content: "Either party may terminate immediately by written notice if the other party commits a material breach that remains uncured thirty (30) days after written notice describing the breach in reasonable detail." },
  { chunkId: "c-003", documentId: "d-002", documentTitle: "Master Services Agreement — Kilimani Cloud", versionId: "v-002-3", versionNumber: 3, page: 9, section: "6. Fees and payment", content: "Undisputed invoices are payable within thirty (30) days of the invoice date. Late payments accrue interest at 1.5% per month. The Supplier may suspend the Services if undisputed amounts remain unpaid for more than forty-five (45) days." },
  { chunkId: "c-004", documentId: "d-003", documentTitle: "Data Retention Policy 2026", versionId: "v-003-2", versionNumber: 2, page: 4, section: "3.1 Retention periods", content: "Financial records, including invoices and payment records, must be retained for seven (7) years from the end of the financial year. Customer support transcripts are retained for twenty-four (24) months." },
  { chunkId: "c-005", documentId: "d-003", documentTitle: "Data Retention Policy 2026", versionId: "v-003-2", versionNumber: 2, page: 7, section: "5. Legal hold", content: "When a legal hold is issued, all deletion and retention jobs for affected records are suspended until the Legal department releases the hold in writing." },
  { chunkId: "c-006", documentId: "d-007", documentTitle: "Information Security Policy", versionId: "v-007-4", versionNumber: 4, page: 6, section: "4.2 Access control", content: "Access to confidential information is granted on a least-privilege basis. Privileged accounts must use multi-factor authentication and are reviewed every quarter by the Security team." },
  { chunkId: "c-007", documentId: "d-007", documentTitle: "Information Security Policy", versionId: "v-007-4", versionNumber: 4, page: 12, section: "8. Incident response", content: "Security incidents must be reported to the Security team within four (4) hours of discovery. Incidents affecting personal data must be assessed for regulatory notification within seventy-two (72) hours." },
  { chunkId: "c-008", documentId: "d-011", documentTitle: "Annual Compliance Review 2025", versionId: "v-011-1", versionNumber: 1, page: 22, section: "Findings", content: "The review found that quarterly access reviews were completed on time in three of four quarters. Remediation for the missed Q2 review was completed in July." },
];

export const demoMembers = [
  { id: "u1", name: "Amina Otieno", email: "amina@documind.demo", role: "owner" as const, lastActive: ago(0.2) },
  { id: "u2", name: "Brian Mwangi", email: "brian@documind.demo", role: "knowledge_manager" as const, lastActive: ago(3) },
  { id: "u3", name: "Grace Wanjiru", email: "grace@documind.demo", role: "contributor" as const, lastActive: ago(1) },
  { id: "u4", name: "Peter Kamau", email: "peter@documind.demo", role: "reader" as const, lastActive: ago(26) },
  { id: "u5", name: "Lucy Njeri", email: "lucy@documind.demo", role: "auditor" as const, lastActive: ago(50) },
];

export const demoAudit = [
  { id: "a1", actor: "Amina Otieno", action: "document.upload", resource: "Invoice INV-2026-0418", at: ago(0.5) },
  { id: "a2", actor: "Brian Mwangi", action: "document.share", resource: "Master Services Agreement", at: ago(2) },
  { id: "a3", actor: "Grace Wanjiru", action: "assistant.query", resource: "Termination notice period", at: ago(3) },
  { id: "a4", actor: "Amina Otieno", action: "members.manage", resource: "Peter Kamau → reader", at: ago(22) },
  { id: "a5", actor: "Lucy Njeri", action: "audit.read", resource: "Access report", at: ago(30) },
];
