import { getTenant, requirePermission } from "@/lib/auth";
import { getDocumentFile } from "@/lib/data";
import { handle, notFound } from "@/lib/errors";
import { audit } from "@/lib/tenancy";

type Ctx = { params: Promise<{ id: string }> };

/** Streams the original file back to an authorized user as a download. */
export const GET = handle<Ctx>(async (_req, ctx) => {
  const tenant = await getTenant();
  requirePermission(tenant, "document.download");
  const { id } = await ctx.params;
  const file = await getDocumentFile(tenant, id);
  if (!file) throw notFound("Document");
  await audit(tenant, "document.download", "document", id);
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.mime,
      "Content-Disposition": `attachment; filename="${file.filename.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
