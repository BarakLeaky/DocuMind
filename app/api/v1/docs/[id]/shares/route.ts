import { NextResponse } from "next/server";
import { z } from "zod";
import { getTenant, requirePermission } from "@/lib/auth";
import { shareEditorDoc, unshareEditorDoc } from "@/lib/docs";
import { handle } from "@/lib/errors";
import { audit } from "@/lib/tenancy";

type Ctx = { params: Promise<{ id: string }> };

const shareBody = z.object({ email: z.string().email().max(254), role: z.enum(["viewer", "editor"]) });

export const POST = handle<Ctx>(async (req, { params }) => {
  const tenant = await getTenant();
  requirePermission(tenant, "doc.edit");
  const { id } = await params;
  const { email, role } = shareBody.parse(await req.json());
  const share = await shareEditorDoc(tenant, id, email, role);
  await audit(tenant, "doc.share", "editor_document", id, { title: email, role });
  return NextResponse.json({ share }, { status: 201 });
});

const removeBody = z.object({ shareId: z.string().min(1) });

export const DELETE = handle<Ctx>(async (req, { params }) => {
  const tenant = await getTenant();
  requirePermission(tenant, "doc.edit");
  const { id } = await params;
  const { shareId } = removeBody.parse(await req.json());
  await unshareEditorDoc(tenant, id, shareId);
  await audit(tenant, "doc.unshare", "editor_document", id);
  return NextResponse.json({ ok: true });
});
