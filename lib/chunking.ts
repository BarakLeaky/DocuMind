export type PageText = { page: number; text: string };
export type Chunk = {
  chunkIndex: number;
  content: string;
  page: number;
  section: string | null;
  /** Offset in the concatenated document text (pages joined by a newline). */
  charStart: number;
  charEnd: number;
  tokenCount: number;
};

export type ChunkPolicy = { maxChars: number; overlapChars: number };
export const DEFAULT_POLICY: ChunkPolicy = { maxChars: 1200, overlapChars: 150 };

const HEADING = /^(#{1,6}\s+.+|\d+(\.\d+)*\.?\s+[A-Z][^\n]{2,80})$/;

type Piece = { text: string; start: number; section: string | null };

function splitLong(text: string, start: number, section: string | null, max: number): Piece[] {
  if (text.length <= max) return [{ text, start, section }];
  const out: Piece[] = [];
  let pos = 0;
  while (pos < text.length) {
    let end = Math.min(pos + max, text.length);
    if (end < text.length) {
      const boundary = text.lastIndexOf(". ", end);
      if (boundary > pos + max / 2) end = boundary + 1;
    }
    out.push({ text: text.slice(pos, end).trim(), start: start + pos, section });
    pos = end;
  }
  return out.filter((p) => p.text.length > 0);
}

/**
 * Structure-aware chunking. Paragraphs are packed up to `maxChars`; each chunk keeps its page,
 * the nearest preceding heading, and character offsets so citations can point to real text.
 */
export function createChunks(pages: PageText[], policy: ChunkPolicy = DEFAULT_POLICY): Chunk[] {
  const chunks: Chunk[] = [];
  let index = 0;
  let docOffset = 0;

  for (const { page, text } of pages) {
    const pieces: Piece[] = [];
    let section: string | null = null;
    let cursor = 0;

    for (const raw of text.split(/\n{2,}/)) {
      const para = raw.trim();
      if (!para) continue;
      const start = Math.max(0, text.indexOf(para, cursor));
      cursor = start + para.length;
      const firstLine = para.split("\n")[0];
      if (HEADING.test(firstLine)) section = firstLine.replace(/^#+\s*/, "");
      pieces.push(...splitLong(para, start, section, policy.maxChars));
    }

    let buffer = "";
    let bufferStart = 0;
    let bufferSection: string | null = null;

    const emit = () => {
      const content = buffer.trim();
      if (!content) return;
      chunks.push({
        chunkIndex: index++,
        content,
        page,
        section: bufferSection,
        charStart: docOffset + bufferStart,
        charEnd: docOffset + bufferStart + content.length,
        tokenCount: Math.ceil(content.length / 4),
      });
    };

    for (const piece of pieces) {
      if (buffer && buffer.length + piece.text.length + 2 > policy.maxChars) {
        emit();
        const tail = buffer.slice(Math.max(0, buffer.length - policy.overlapChars));
        bufferStart = bufferStart + buffer.length - tail.length;
        buffer = tail;
      }
      if (!buffer) {
        bufferStart = piece.start;
        bufferSection = piece.section;
      }
      buffer += (buffer ? "\n\n" : "") + piece.text;
    }
    emit();
    docOffset += text.length + 1;
  }
  return chunks;
}
