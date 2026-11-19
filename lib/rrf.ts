export type RankedList = { source: string; ids: string[] };
export type Fused = { id: string; score: number; sources: string[] };

/** Reciprocal rank fusion: score = sum(1 / (k + rank)). Deduplicates ids across lists. */
export function reciprocalRankFusion(lists: RankedList[], k = 60): Fused[] {
  const map = new Map<string, Fused>();
  for (const list of lists) {
    list.ids.forEach((id, i) => {
      const entry = map.get(id) ?? { id, score: 0, sources: [] };
      entry.score += 1 / (k + i + 1);
      if (!entry.sources.includes(list.source)) entry.sources.push(list.source);
      map.set(id, entry);
    });
  }
  return [...map.values()].sort((a, b) => b.score - a.score);
}
