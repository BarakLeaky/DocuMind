import { NextResponse } from "next/server";
import { z } from "zod";
import { ask } from "@/lib/assistant";
import { getTenant, requirePermission } from "@/lib/auth";
import { AppError, handle } from "@/lib/errors";

const body = z.object({ question: z.string().min(2).max(2000) });
type Ctx = { params: Promise<{ id: string }> };

export const POST = handle<Ctx>(async (req, ctx) => {
  const tenant = await getTenant();
  requirePermission(tenant, "assistant.query");
  const { id } = await ctx.params;
  const { question } = body.parse(await req.json());
  try {
    return NextResponse.json(await ask(tenant, id, question));
  } catch (err) {
    if (err instanceof Error && err.message === "Conversation not found") throw new AppError("not_found", 404, "Conversation not found");
    throw err;
  }
});
