import type { DocumentType, ProcessingState } from "@/lib/constants";

export type DocumentRow = {
  id: string;
  title: string;
  type: DocumentType;
  status: ProcessingState;
  pages: number;
  version: number;
  sizeBytes: number;
  owner: string;
  updatedAt: string;
  /** Average model confidence across extracted fields, or null when nothing has been extracted. */
  confidence: number | null;
};

export type ExtractedField = {
  id: string;
  label: string;
  value: string;
  confidence: number;
  page: number;
  status: "pending" | "approved" | "edited" | "rejected";
  /** The passage the value was found in, used to highlight it in the viewer. */
  sourceChunkId: string | null;
};

export type Passage = { id: string; page: number; section: string | null; content: string };

export type Review = {
  documentId: string;
  title: string;
  docType: DocumentType;
  status: ProcessingState;
  version: number;
  pages: number;
  mime: string | null;
  sizeBytes: number;
  failure: string | null;
  fields: ExtractedField[];
  passages: Passage[];
};

export type Stats = {
  totalDocuments: number;
  processedThisWeek: number;
  /** Change versus the previous 7 days, in percent. Null when there is nothing to compare against. */
  processedDelta: number | null;
  searchablePassages: number;
  medianTimeToSearchableSec: number | null;
};
