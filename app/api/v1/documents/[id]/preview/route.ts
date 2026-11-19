import { getTenant, requirePermission } from "@/lib/auth";
import { getDocumentFile } from "@/lib/data";
import { AppError, handle, notFound } from "@/lib/errors";

type Ctx = { params: Promise<{ id: string }> };

/** Serves a PDF inline so the review screen can display it. Other file types are shown as extracted text instead. */
export const GET = handle<Ctx>(async (_req, ctx) => {
  const tenant = await getTenant();
  requirePermission(tenant, "document.read");
  const { id } = await ctx.params;
  const file = await getDocumentFile(tenant, id);
  if (!file) throw notFound("Document");
  if (file.mime !== "application/pdf") throw new AppError("unsupported_type", 415, "Only PDF files can be previewed.");
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
