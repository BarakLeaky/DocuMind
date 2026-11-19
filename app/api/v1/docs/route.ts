import { NextResponse } from "next/server";
import { z } from "zod";
import { getTenant, requirePermission } from "@/lib/auth";
import { createEditorDoc, listEditorDocs } from "@/lib/docs";
import { handle } from "@/lib/errors";
import { audit } from "@/lib/tenancy";

export const GET = handle(async () => {
  const tenant = await getTenant();
  requirePermission(tenant, "document.read");
  return NextResponse.json(await listEditorDocs(tenant));
});

const createBody = z.object({ title: z.string().max(200).optional() });

export const POST = handle(async (req) => {
  const tenant = await getTenant();
  requirePermission(tenant, "doc.edit");
  const { title } = createBody.parse(await req.json().catch(() => ({})));
  const id = await createEditorDoc(tenant, { title });
  await audit(tenant, "doc.create", "editor_document", id, { title: title ?? "Untitled document" });
  return NextResponse.json({ id }, { status: 201 });
});
