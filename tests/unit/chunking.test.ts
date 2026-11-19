import { describe, expect, it } from "vitest";
import { createChunks } from "@/lib/chunking";

describe("createChunks", () => {
  it("keeps page numbers and headings", () => {
    const chunks = createChunks([
      { page: 1, text: "1. Introduction\n\nThis is the intro paragraph." },
      { page: 2, text: "2. Termination\n\nEither party may terminate with notice." },
    ]);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.find((c) => c.page === 2)?.section).toBe("2. Termination");
    expect(chunks.map((c) => c.chunkIndex)).toEqual(chunks.map((_, i) => i));
  });
  it("never exceeds the size budget by much and loses no text", () => {
    const para = "Sentence number one. ".repeat(120); // ~2500 chars, single paragraph
    const chunks = createChunks([{ page: 1, text: para }], { maxChars: 500, overlapChars: 50 });
    expect(chunks.length).toBeGreaterThan(3);
    for (const c of chunks) expect(c.content.length).toBeLessThanOrEqual(500 + 50 + 4);
    expect(chunks.map((c) => c.content).join(" ")).toContain("Sentence number one.");
  });
  it("returns nothing for empty input", () => {
    expect(createChunks([{ page: 1, text: "   \n\n  " }])).toEqual([]);
  });
});
