import { DOCUMENT_TYPES, type DocumentType } from "@/lib/constants";

/** Pure helpers for field extraction. Kept free of SDK imports so they are easy to unit test. */

export const normalizeWs = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

export type PassageRef = { id: string; content: string };

/** Finds the passage whose text contains the quoted evidence. Returns null when the quote is not verbatim. */
export function findSourcePassage(quote: string, passages: PassageRef[]): string | null {
  const q = normalizeWs(quote);
  if (q.length < 3) return null;
  for (const p of passages) if (normalizeWs(p.content).includes(q)) return p.id;
  return null;
}

/** Model-reported confidence is clamped to 0..1; values we cannot trace back to the text are capped at 0.6. */
export function adjustConfidence(reported: number, traced: boolean): number {
  const c = Number.isFinite(reported) ? Math.min(1, Math.max(0, reported)) : 0.5;
  const capped = traced ? c : Math.min(c, 0.6);
  return Math.round(capped * 100) / 100;
}

export function coerceDocType(value: string | null | undefined): DocumentType {
  const match = DOCUMENT_TYPES.find((t) => t.toLowerCase() === (value ?? "").trim().toLowerCase());
  return match ?? "Other";
}

/** Digits-only form of a value, so "$76,125.00" and "76125" can be compared. */
const digitsOf = (s: string) => s.replace(/[^0-9]/g, "");

/**
 * True when the extracted value can be found in the document text. Words are matched after whitespace and case
 * normalisation; amounts and dates are matched by their digits so formatting differences don't count as misses.
 */
export function valueAppearsInText(value: string, text: string): boolean {
  const v = normalizeWs(value);
  if (v.length < 2) return false;
  const t = normalizeWs(text);
  if (t.includes(v)) return true;
  const vd = digitsOf(value);
  if (vd.length >= 3 && /\d/.test(value) && vd.length / value.replace(/\s/g, "").length > 0.5) return digitsOf(text).includes(vd);
  return false;
}

export type LineItem = { description: string; quantity: number | null; unitPrice: number | null; amount: number | null };

/** Compares the sum of line item amounts with the stated subtotal. Returns null when there is nothing to compare. */
export function reconcileLineItems(items: LineItem[], subtotal: number | null): { ok: boolean; sum: number } | null {
  const amounts = items.map((i) => i.amount).filter((n): n is number => n != null);
  if (amounts.length === 0 || subtotal == null) return null;
  const sum = Math.round(amounts.reduce((a, b) => a + b, 0) * 100) / 100;
  return { ok: Math.abs(sum - subtotal) < 0.01, sum };
}
