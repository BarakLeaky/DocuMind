import { NextResponse } from "next/server";
import { z } from "zod";
import { getTenant, requirePermission } from "@/lib/auth";
import { handle } from "@/lib/errors";
import { retrieve } from "@/lib/retrieval";

const body = z.object({ query: z.string().min(2).max(500), limit: z.number().int().min(1).max(20).default(8) });

export const POST = handle(async (req) => {
  const tenant = await getTenant();
  requirePermission(tenant, "document.read");
  const { query, limit } = body.parse(await req.json());
  const results = await retrieve(tenant, query, limit);
  return NextResponse.json({
    query,
    results: results.map((r) => ({
      chunkId: r.chunkId,
      documentId: r.documentId,
      documentTitle: r.documentTitle,
      version: r.versionNumber,
      page: r.page,
      section: r.section,
      excerpt: r.content,
      score: Number(r.score.toFixed(4)),
      via: r.via,
    })),
  });
});
