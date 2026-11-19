import { describe, expect, it } from "vitest";
import { canDeleteDoc, canEditDoc, canShareDoc, resolveDocRole } from "@/lib/docs-access";
import { importToHtml, sanitizeDocHtml, textToHtml, titleFromFilename } from "@/lib/docs-html";

describe("resolveDocRole", () => {
  const shares = [{ userId: "bob", role: "editor" as const }, { userId: "cy", role: "viewer" as const }];
  it("owner, editor, viewer, stranger", () => {
    expect(resolveDocRole("al", "al", shares)).toBe("owner");
    expect(resolveDocRole("bob", "al", shares)).toBe("editor");
    expect(resolveDocRole("cy", "al", shares)).toBe("viewer");
    expect(resolveDocRole("eve", "al", shares)).toBeNull();
  });
  it("only owners share or delete; viewers cannot edit", () => {
    expect(canShareDoc("editor")).toBe(false);
    expect(canDeleteDoc("owner")).toBe(true);
    expect(canEditDoc("viewer")).toBe(false);
    expect(canEditDoc("editor")).toBe(true);
    expect(canEditDoc(null)).toBe(false);
  });
});

describe("sanitizeDocHtml", () => {
  it("strips scripts, handlers and images but keeps formatting", () => {
    const out = sanitizeDocHtml('<p onclick="x()">Hi <strong>there</strong></p><script>alert(1)</script><img src=x onerror=y>');
    expect(out).toBe("<p>Hi <strong>there</strong></p>");
  });
  it("blocks javascript: links", () => {
    expect(sanitizeDocHtml('<a href="javascript:alert(1)">x</a>')).not.toContain("javascript:");
  });
});

describe("import", () => {
  it("escapes plain text", () => {
    expect(textToHtml("a <b>\n\nsecond")).toBe("<p>a &lt;b&gt;</p><p>second</p>");
  });
  it("converts markdown", async () => {
    expect(await importToHtml("n.md", Buffer.from("# Title\n\n**bold**"))).toContain("<h1");
  });
  it("rejects unsupported and oversize files", async () => {
    await expect(importToHtml("x.pdf", Buffer.from("x"))).rejects.toThrow(/Only/);
    await expect(importToHtml("x.txt", Buffer.alloc(3 * 1024 * 1024, 97))).rejects.toThrow(/2 MB/);
  });
  it("derives a title from the file name", () => {
    expect(titleFromFilename("meeting_notes-q3.docx")).toBe("meeting notes q3");
  });
});
