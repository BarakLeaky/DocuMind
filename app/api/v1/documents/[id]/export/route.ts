import { z } from "zod";
import { getTenant, requirePermission } from "@/lib/auth";
import { getReview } from "@/lib/data";
import { handle, notFound } from "@/lib/errors";
import { buildExport } from "@/lib/review-center";
import { audit } from "@/lib/tenancy";

type Ctx = { params: Promise<{ id: string }> };
const query = z.object({ format: z.enum(["json", "csv"]).default("json") });

/** Exports the reviewed fields. Only fields a reviewer rejected are left out. */
export const GET = handle<Ctx>(async (req, ctx) => {
  const tenant = await getTenant();
  requirePermission(tenant, "document.download");
  const { format } = query.parse(Object.fromEntries(new URL(req.url).searchParams));
  const { id } = await ctx.params;
  const review = await getReview(tenant, id);
  if (!review) throw notFound("Document");
  const out = buildExport({ ...review, fields: review.fields.filter((f) => f.status !== "rejected") }, format);
  await audit(tenant, "document.exported", "document", id, { format, title: review.title });
  return new Response(out.body, {
    headers: {
      "Content-Type": out.mime,
      "Content-Disposition": `attachment; filename="${out.filename.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
