import { describe, expect, it } from "vitest";
import { buildExport } from "@/lib/review-center";
import type { Review } from "@/lib/types";

const review = {
  documentId: "d", title: "Invoice_INV-1.pdf", docType: "Invoice", status: "ready", version: 1, pages: 1, mime: "application/pdf", sizeBytes: 1, failure: null, passages: [],
  fields: [{ id: "1", label: "Vendor", value: 'ACME, "Inc"', confidence: 0.96, page: 1, status: "approved", sourceChunkId: null }],
} as Review;

describe("buildExport", () => {
  it("quotes CSV cells that contain commas or quotes", () => {
    const out = buildExport(review, "csv");
    expect(out.body.split("\n")[1]).toBe('Vendor,"ACME, ""Inc""",0.96,1,approved');
    expect(out.filename).toBe("Invoice_INV-1.csv");
  });
  it("exports JSON with the fields", () => {
    expect(JSON.parse(buildExport(review, "json").body).fields[0].field).toBe("Vendor");
  });
});
