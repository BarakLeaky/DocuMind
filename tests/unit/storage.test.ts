import { describe, expect, it } from "vitest";
import { detectFileType, storage } from "@/lib/storage";

describe("detectFileType", () => {
  it("recognises PDFs by signature, not by name", () => {
    expect(detectFileType(Buffer.from("%PDF-1.7 ..."))?.ext).toBe("pdf");
  });
  it("recognises Word files by their zip signature plus word/document.xml", () => {
    const docx = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0]), Buffer.from("word/document.xml")]);
    expect(detectFileType(docx)?.ext).toBe("docx");
  });
  it("rejects other zip files such as spreadsheets", () => {
    const xlsx = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0]), Buffer.from("xl/workbook.xml")]);
    expect(detectFileType(xlsx)).toBeNull();
  });
  it("accepts utf-8 text and rejects binary", () => {
    expect(detectFileType(Buffer.from("hello world"))?.ext).toBe("txt");
    expect(detectFileType(Buffer.from([0x00, 0x01, 0x02]))).toBeNull();
  });
});

describe("signed upload targets", () => {
  it("issues opaque keys and verifies signatures", () => {
    const t = storage.createUploadTarget("Org_1", "pdf");
    expect(t.key).toMatch(/^org_1\/[a-f0-9-]{36}\.pdf$/);
    const url = new URL(t.uploadUrl, "http://x");
    const exp = Number(url.searchParams.get("exp"));
    const sig = url.searchParams.get("sig")!;
    expect(storage.verifyUploadSignature(t.key, exp, sig)).toBe(true);
    expect(storage.verifyUploadSignature(t.key, exp, "0".repeat(sig.length))).toBe(false);
    expect(storage.verifyUploadSignature(t.key, Math.floor(Date.now() / 1000) - 5, sig)).toBe(false);
  });
});
