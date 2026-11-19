import { describe, expect, it } from "vitest";
import { reciprocalRankFusion } from "@/lib/rrf";

describe("reciprocalRankFusion", () => {
  it("ranks items found by both retrievers first and deduplicates", () => {
    const fused = reciprocalRankFusion([
      { source: "keyword", ids: ["a", "b", "c"] },
      { source: "semantic", ids: ["b", "d", "a"] },
    ]);
    expect(fused.map((f) => f.id)).toEqual(["b", "a", "d", "c"]);
    expect(fused[0].sources).toEqual(["keyword", "semantic"]);
    expect(new Set(fused.map((f) => f.id)).size).toBe(fused.length);
  });
  it("handles empty lists", () => {
    expect(reciprocalRankFusion([{ source: "keyword", ids: [] }])).toEqual([]);
  });
});
