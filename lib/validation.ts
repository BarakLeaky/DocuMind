/**
 * Pure validation and anomaly logic for the review cockpit. No database or SDK imports, so it is easy to test.
 * Every result is derived from what was actually extracted from the document. Nothing here is a placeholder.
 */

export type FieldInput = {
  label: string;
  value: string;
  confidence: number;
  sourceChunkId: string | null;
  status: "pending" | "approved" | "edited" | "rejected";
};

export type CheckStatus = "passed" | "warning" | "failed";
export type Check = { id: string; label: string; status: CheckStatus; detail: string };

export type Anomaly = { id: string; field: string; message: string };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

export function findField<T extends { label: string }>(fields: T[], ...patterns: RegExp[]): T | undefined {
  return fields.find((f) => patterns.some((p) => p.test(norm(f.label))));
}

/** "$76,125.00", "KES 1,200", "1.200,50 EUR" -> number. Returns null when no amount can be read. */
export function parseMoney(raw: string): number | null {
  const m = raw.replace(/\s/g, "").match(/-?\d[\d.,]*/);
  if (!m) return null;
  let s = m[0];
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", "."); // European style
  else s = s.replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function parseDate(raw: string): Date | null {
  const t = Date.parse(raw.trim());
  if (Number.isFinite(t)) return new Date(t);
  const m = raw.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); // dd/mm/yyyy
  if (m) {
    const d = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

const REQUIRED: Record<string, { name: string; pattern: RegExp }[]> = {
  Invoice: [
    { name: "Invoice number", pattern: /invoice (number|no|id)|^invoice$/ },
    { name: "Invoice date", pattern: /invoice date|^date$|issue date/ },
    { name: "Total amount", pattern: /total|amount due/ },
  ],
  Contract: [
    { name: "Parties", pattern: /part(y|ies)|between/ },
    { name: "Effective date", pattern: /effective date|start date/ },
  ],
  Policy: [{ name: "Effective date", pattern: /effective date|issued|approved/ }],
};

const TOTAL = [/^total( amount| due)?$/, /amount due/, /grand total/];
const TAX = [/tax|vat/];
const SUBTOTAL = [/subtotal|sub total/];

export const isTotalLabel = (label: string) => {
  const l = norm(label);
  return !TAX.some((p) => p.test(l)) && !SUBTOTAL.some((p) => p.test(l)) && TOTAL.some((p) => p.test(l));
};

export function runChecks(fields: FieldInput[], docType: string): Check[] {
  const checks: Check[] = [];
  const push = (id: string, label: string, status: CheckStatus, detail: string) => checks.push({ id, label, status, detail });

  // 1. Something was extracted.
  push("extracted", "Fields extracted", fields.length > 0 ? "passed" : "failed", fields.length > 0 ? `${fields.length} fields found` : "No fields were extracted");
  if (fields.length === 0) return checks;

  // 2. Required fields for the document type.
  const required = REQUIRED[docType] ?? [];
  if (required.length > 0) {
    const missing = required.filter((r) => !findField(fields, r.pattern)).map((r) => r.name);
    push("required", "Required fields present", missing.length === 0 ? "passed" : "failed", missing.length === 0 ? `All ${required.length} required ${docType.toLowerCase()} fields found` : `Missing: ${missing.join(", ")}`);
  }

  // 3. Confidence.
  const weak = fields.filter((f) => f.confidence < 0.8);
  const veryWeak = fields.filter((f) => f.confidence < 0.6);
  push("confidence", "Field confidence", veryWeak.length > 0 ? "failed" : weak.length > 0 ? "warning" : "passed",
    veryWeak.length > 0 ? `${veryWeak.length} below 60%` : weak.length > 0 ? `${weak.length} below 80%` : "Every field is at least 80%");

  // 4. Evidence traced to the source text.
  const untraced = fields.filter((f) => !f.sourceChunkId);
  push("evidence", "Values found in source text", untraced.length === 0 ? "passed" : "warning",
    untraced.length === 0 ? "Every value is backed by a passage" : `${untraced.length} not found word for word`);

  // 5. Dates parse.
  const dateFields = fields.filter((f) => /date|due/.test(norm(f.label)));
  const badDates = dateFields.filter((f) => !parseDate(f.value));
  if (dateFields.length > 0) push("dates", "Dates are valid", badDates.length === 0 ? "passed" : "failed", badDates.length === 0 ? `${dateFields.length} dates read correctly` : `Unreadable: ${badDates.map((f) => f.label).join(", ")}`);

  // 6. Invoice-specific consistency.
  if (docType === "Invoice") {
    const issued = findField(fields, /invoice date|^date$|issue date/);
    const due = findField(fields, /due date|payment due/);
    const a = issued && parseDate(issued.value);
    const b = due && parseDate(due.value);
    if (a && b) push("due-order", "Due date is after invoice date", b >= a ? "passed" : "failed", b >= a ? "Dates are in order" : "Due date is before the invoice date");

    const total = findField(fields, ...TOTAL);
    const tax = findField(fields, ...TAX);
    const sub = findField(fields, ...SUBTOTAL);
    const t = total && parseMoney(total.value);
    const x = tax && parseMoney(tax.value);
    const s = sub && parseMoney(sub.value);
    if (t != null && x != null && s != null) {
      const ok = Math.abs(s + x - t) < 0.01;
      push("totals", "Subtotal + tax = total", ok ? "passed" : "failed", ok ? "Amounts add up" : `Subtotal + tax is ${(s + x).toLocaleString()}, total is ${t.toLocaleString()}`);
    }
  }

  // 7. A person has not rejected anything.
  const rejected = fields.filter((f) => f.status === "rejected");
  push("review", "No rejected fields", rejected.length === 0 ? "passed" : "failed", rejected.length === 0 ? "Nothing rejected by a reviewer" : `${rejected.length} rejected by a reviewer`);

  return checks;
}

export function summariseChecks(checks: Check[]) {
  return {
    passed: checks.filter((c) => c.status === "passed").length,
    warnings: checks.filter((c) => c.status === "warning").length,
    failed: checks.filter((c) => c.status === "failed").length,
    total: checks.length,
  };
}

/** Flags a total that differs from the recent average of similar documents by 10% or more. Needs at least 3 comparable documents. */
export function detectAmountAnomaly(current: number | null, history: number[], label = "Total amount"): Anomaly | null {
  const h = history.filter((n) => Number.isFinite(n) && n > 0);
  if (current == null || h.length < 3) return null;
  const avg = h.reduce((a, b) => a + b, 0) / h.length;
  const pct = ((current - avg) / avg) * 100;
  if (Math.abs(pct) < 10) return null;
  const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return { id: "amount-variance", field: label, message: `${money(current)} is ${Math.abs(pct).toFixed(1)}% ${pct > 0 ? "higher" : "lower"} than the recent average (${h.length} similar documents)` };
}

/** Overall confidence: mean of field confidences. Null when nothing was extracted. */
export function overallConfidence(fields: { confidence: number }[]): number | null {
  if (fields.length === 0) return null;
  return fields.reduce((a, f) => a + f.confidence, 0) / fields.length;
}

export function confidenceLabel(c: number | null): { label: string; tone: "ok" | "warn" | "danger" | "neutral" } {
  if (c == null) return { label: "No data", tone: "neutral" };
  if (c >= 0.9) return { label: "High confidence", tone: "ok" };
  if (c >= 0.75) return { label: "Medium confidence", tone: "warn" };
  return { label: "Low confidence", tone: "danger" };
}
