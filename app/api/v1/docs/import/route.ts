import { NextResponse } from "next/server";
import { getTenant, requirePermission } from "@/lib/auth";
import { createEditorDoc } from "@/lib/docs";
import { importToHtml, titleFromFilename } from "@/lib/docs-html";
import { AppError, handle } from "@/lib/errors";
import { audit } from "@/lib/tenancy";

export const POST = handle(async (req) => {
  const tenant = await getTenant();
  requirePermission(tenant, "doc.edit");
  const file = (await req.formData()).get("file");
  if (!(file instanceof File)) throw new AppError("validation_error", 422, "Choose a file to import.");
  let html: string;
  try {
    html = await importToHtml(file.name, Buffer.from(await file.arrayBuffer()));
  } catch (err) {
    throw new AppError("unsupported_type", 415, err instanceof Error ? err.message : "Could not import that file.");
  }
  const title = titleFromFilename(file.name);
  const id = await createEditorDoc(tenant, { title, contentHtml: html });
  await audit(tenant, "doc.import", "editor_document", id, { title });
  return NextResponse.json({ id }, { status: 201 });
});
