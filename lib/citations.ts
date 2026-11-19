import { createHash } from "node:crypto";

export type Evidence = {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  versionId: string;
  versionNumber: number;
  page: number;
  section: string | null;
  content: string;
  score: number;
  via: string[];
};

export type RawSegment = { text: string; sourceChunkIds: string[] };

export type Citation = {
  id: string; // stable id shown in the UI, e.g. "1"
  chunkId: string;
  documentId: string;
  documentTitle: string;
  versionId: string;
  versionNumber: number;
  page: number;
  section: string | null;
  excerpt: string;
  quoteHash: string;
};

export type AnswerSegment = { text: string; citationIds: string[] };

export const quoteHash = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 32);

/**
 * Never trust model-provided references. Every source id must resolve to a chunk that was
 * actually retrieved (and therefore already authorized). Unknown ids are dropped and counted.
 */
export function resolveCitations(segments: RawSegment[], evidence: Evidence[]) {
  const byId = new Map(evidence.map((e) => [e.chunkId, e]));
  const citations: Citation[] = [];
  const numbering = new Map<string, string>();
  let invalidReferences = 0;

  const out: AnswerSegment[] = segments.map((seg) => {
    const ids: string[] = [];
    for (const chunkId of seg.sourceChunkIds) {
      const ev = byId.get(chunkId);
      if (!ev) {
        invalidReferences++;
        continue;
      }
      let n = numbering.get(chunkId);
      if (!n) {
        n = String(numbering.size + 1);
        numbering.set(chunkId, n);
        citations.push({
          id: n,
          chunkId: ev.chunkId,
          documentId: ev.documentId,
          documentTitle: ev.documentTitle,
          versionId: ev.versionId,
          versionNumber: ev.versionNumber,
          page: ev.page,
          section: ev.section,
          excerpt: ev.content.length > 280 ? `${ev.content.slice(0, 277)}…` : ev.content,
          quoteHash: quoteHash(ev.content),
        });
      }
      if (!ids.includes(n)) ids.push(n);
    }
    return { text: seg.text, citationIds: ids };
  });

  return { segments: out, citations, invalidReferences };
}
