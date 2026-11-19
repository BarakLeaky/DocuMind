import { describe, expect, it } from "vitest";
import { confidenceLabel, detectAmountAnomaly, overallConfidence, parseDate, parseMoney, runChecks, summariseChecks, type FieldInput } from "@/lib/validation";

const f = (label: string, value: string, confidence = 0.97, traced = true, status: FieldInput["status"] = "pending"): FieldInput => ({
  label, value, confidence, sourceChunkId: traced ? "c1" : null, status,
});

describe("parseMoney", () => {
  it("reads US and European formats", () => {
    expect(parseMoney("$76,125.00")).toBe(76125);
    expect(parseMoney("1.200,50 EUR")).toBe(1200.5);
    expect(parseMoney("KES 1,200")).toBe(1200);
    expect(parseMoney("n/a")).toBeNull();
  });
});

describe("parseDate", () => {
  it("reads written and numeric dates", () => {
    expect(parseDate("May 14, 2024")).not.toBeNull();
    expect(parseDate("14/05/2024")?.getUTCMonth()).toBe(4);
    expect(parseDate("someday")).toBeNull();
  });
});

describe("runChecks", () => {
  const invoice = [
    f("Invoice Number", "INV-84291"), f("Invoice Date", "May 14, 2024"), f("Due Date", "June 13, 2024"),
    f("Subtotal", "$70,000.00"), f("Tax Amount", "$6,125.00"), f("Total Amount", "$76,125.00"),
  ];
  it("passes a consistent invoice", () => {
    const s = summariseChecks(runChecks(invoice, "Invoice"));
    expect(s.failed).toBe(0);
    expect(s.warnings).toBe(0);
  });
  it("fails when subtotal + tax does not equal total", () => {
    const bad = invoice.map((x) => (x.label === "Total Amount" ? f("Total Amount", "$99,000.00") : x));
    const checks = runChecks(bad, "Invoice");
    expect(checks.find((c) => c.id === "totals")?.status).toBe("failed");
  });
  it("fails when the due date precedes the invoice date", () => {
    const bad = invoice.map((x) => (x.label === "Due Date" ? f("Due Date", "April 1, 2024") : x));
    expect(runChecks(bad, "Invoice").find((c) => c.id === "due-order")?.status).toBe("failed");
  });
  it("lists missing required fields", () => {
    const c = runChecks([f("Vendor", "ACME")], "Invoice").find((x) => x.id === "required");
    expect(c?.status).toBe("failed");
    expect(c?.detail).toContain("Invoice number");
  });
  it("warns on low confidence and untraced values", () => {
    const checks = runChecks([f("Effective date", "May 1, 2024", 0.7, false)], "Policy");
    expect(checks.find((c) => c.id === "confidence")?.status).toBe("warning");
    expect(checks.find((c) => c.id === "evidence")?.status).toBe("warning");
  });
  it("fails when nothing was extracted", () => {
    expect(runChecks([], "Invoice")).toHaveLength(1);
  });
  it("fails when a reviewer rejected a field", () => {
    expect(runChecks([f("Effective date", "May 1, 2024", 0.95, true, "rejected")], "Policy").find((c) => c.id === "review")?.status).toBe("failed");
  });
});

describe("detectAmountAnomaly", () => {
  it("needs at least three comparable documents", () => {
    expect(detectAmountAnomaly(100_000, [50_000, 60_000])).toBeNull();
  });
  it("flags a total 10% or more above average", () => {
    const a = detectAmountAnomaly(76_125, [67_000, 68_000, 69_000]);
    expect(a?.message).toContain("higher");
  });
  it("stays quiet inside the tolerance", () => {
    expect(detectAmountAnomaly(100, [98, 101, 102])).toBeNull();
  });
});

describe("confidence", () => {
  it("averages and labels", () => {
    expect(overallConfidence([])).toBeNull();
    expect(overallConfidence([{ confidence: 0.9 }, { confidence: 1 }])).toBeCloseTo(0.95);
    expect(confidenceLabel(0.95).label).toBe("High confidence");
    expect(confidenceLabel(0.5).tone).toBe("danger");
  });
});
