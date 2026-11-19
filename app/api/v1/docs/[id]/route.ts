import { NextResponse } from "next/server";
import { z } from "zod";
import { getTenant, requirePermission } from "@/lib/auth";
import { deleteEditorDoc, getEditorDoc, saveEditorDoc } from "@/lib/docs";
import { handle, notFound } from "@/lib/errors";
import { audit } from "@/lib/tenancy";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle<Ctx>(async (_req, { params }) => {
  const tenant = await getTenant();
  requirePermission(tenant, "document.read");
  const doc = await getEditorDoc(tenant, (await params).id);
  if (!doc) throw notFound("Document");
  return NextResponse.json(doc);
});

const patchBody = z.object({
  title: z.string().max(200).optional(),
  contentHtml: z.string().max(2_000_000).optional(),
  baseRevision: z.number().int().min(1),
});

export const PATCH = handle<Ctx>(async (req, { params }) => {
  const tenant = await getTenant();
  requirePermission(tenant, "document.read");
  const { id } = await params;
  const body = patchBody.parse(await req.json());
  const result = await saveEditorDoc(tenant, id, body);
  return NextResponse.json(result);
});

export const DELETE = handle<Ctx>(async (_req, { params }) => {
  const tenant = await getTenant();
  requirePermission(tenant, "doc.edit");
  const { id } = await params;
  await deleteEditorDoc(tenant, id);
  await audit(tenant, "doc.delete", "editor_document", id);
  return NextResponse.json({ ok: true });
});
