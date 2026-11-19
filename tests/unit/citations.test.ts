import { describe, expect, it } from "vitest";
import { resolveCitations, type Evidence } from "@/lib/citations";

const evidence: Evidence[] = [
  { chunkId: "c1", documentId: "d1", documentTitle: "MSA", versionId: "v1", versionNumber: 3, page: 17, section: "12", content: "Ninety days notice.", score: 1, via: ["keyword"] },
  { chunkId: "c2", documentId: "d2", documentTitle: "Policy", versionId: "v2", versionNumber: 1, page: 4, section: null, content: "Seven years.", score: 0.5, via: ["keyword"] },
];

describe("resolveCitations", () => {
  it("builds citations only from retrieved evidence", () => {
    const r = resolveCitations([{ text: "Ninety days.", sourceChunkIds: ["c1"] }], evidence);
    expect(r.citations).toHaveLength(1);
    expect(r.citations[0]).toMatchObject({ documentId: "d1", versionId: "v1", page: 17 });
    expect(r.segments[0].citationIds).toEqual(["1"]);
    expect(r.invalidReferences).toBe(0);
  });
  it("drops fabricated source ids and counts them", () => {
    const r = resolveCitations([{ text: "Made up.", sourceChunkIds: ["invalid:S9", "c-unknown"] }], evidence);
    expect(r.citations).toHaveLength(0);
    expect(r.segments[0].citationIds).toEqual([]);
    expect(r.invalidReferences).toBe(2);
  });
  it("reuses numbering for repeated sources", () => {
    const r = resolveCitations(
      [{ text: "A", sourceChunkIds: ["c2"] }, { text: "B", sourceChunkIds: ["c1", "c2"] }],
      evidence,
    );
    expect(r.segments.map((s) => s.citationIds)).toEqual([["1"], ["2", "1"]]);
    expect(r.citations).toHaveLength(2);
  });
});
