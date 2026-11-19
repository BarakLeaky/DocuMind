import { describe, expect, it } from "vitest";
import { adjustConfidence, coerceDocType, findSourcePassage, normalizeWs } from "@/lib/extraction";

const passages = [
  { id: "a", content: "Either party may terminate this Agreement\nby giving ninety (90) days' prior written notice." },
  { id: "b", content: "Invoice number INV-2026-0418 is due on 12 December 2026." },
];

describe("findSourcePassage", () => {
  it("finds a quote regardless of whitespace and case", () => {
    expect(findSourcePassage("ninety (90) DAYS' prior   written notice", passages)).toBe("a");
    expect(findSourcePassage("INV-2026-0418", passages)).toBe("b");
  });
  it("returns null for text that is not in the document", () => {
    expect(findSourcePassage("net 45 days", passages)).toBeNull();
    expect(findSourcePassage("ab", passages)).toBeNull();
  });
});

describe("adjustConfidence", () => {
  it("clamps to 0..1 and rounds to two decimals", () => {
    expect(adjustConfidence(1.4, true)).toBe(1);
    expect(adjustConfidence(-2, true)).toBe(0);
    expect(adjustConfidence(0.8765, true)).toBe(0.88);
  });
  it("caps values that cannot be traced back to the text", () => {
    expect(adjustConfidence(0.99, false)).toBe(0.6);
    expect(adjustConfidence(0.4, false)).toBe(0.4);
  });
  it("treats non-numbers as uncertain", () => {
    expect(adjustConfidence(Number.NaN, true)).toBe(0.5);
  });
});

describe("coerceDocType", () => {
  it("accepts known types case-insensitively and falls back to Other", () => {
    expect(coerceDocType("invoice")).toBe("Invoice");
    expect(coerceDocType("  Contract ")).toBe("Contract");
    expect(coerceDocType("memo")).toBe("Other");
    expect(coerceDocType(undefined)).toBe("Other");
  });
});

describe("normalizeWs", () => {
  it("collapses whitespace", () => expect(normalizeWs("A \n  b")).toBe("a b"));
});

import { reconcileLineItems, valueAppearsInText } from "@/lib/extraction";

describe("valueAppearsInText", () => {
  const text = "Invoice Number INV-84291\nTotal Due $76,125.00 USD\nDue Date June 13, 2024";
  it("matches words and amounts regardless of formatting", () => {
    expect(valueAppearsInText("INV-84291", text)).toBe(true);
    expect(valueAppearsInText("76125.00", text)).toBe(true);
    expect(valueAppearsInText("June 13, 2024", text)).toBe(true);
  });
  it("rejects values that are not in the document", () => {
    expect(valueAppearsInText("INV-99999", text)).toBe(false);
    expect(valueAppearsInText("$80,000.00", text)).toBe(false);
  });
});

describe("reconcileLineItems", () => {
  const items = [{ description: "a", quantity: 1, unitPrice: 45000, amount: 45000 }, { description: "b", quantity: 1, unitPrice: 25000, amount: 25000 }];
  it("accepts matching and flags mismatched subtotals", () => {
    expect(reconcileLineItems(items, 70000)?.ok).toBe(true);
    expect(reconcileLineItems(items, 71000)?.ok).toBe(false);
    expect(reconcileLineItems([], 70000)).toBeNull();
  });
});
