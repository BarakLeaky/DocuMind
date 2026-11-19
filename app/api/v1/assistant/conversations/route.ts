import { NextResponse } from "next/server";
import { z } from "zod";
import { createConversation } from "@/lib/assistant";
import { getTenant, requirePermission } from "@/lib/auth";
import { handle } from "@/lib/errors";

const body = z.object({ title: z.string().max(200).optional() });

export const POST = handle(async (req) => {
  const tenant = await getTenant();
  requirePermission(tenant, "assistant.query");
  const { title } = body.parse(await req.json().catch(() => ({})));
  const conv = await createConversation(tenant, title);
  return NextResponse.json({ id: conv.id }, { status: 201 });
});
