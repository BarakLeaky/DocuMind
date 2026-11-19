import { NextResponse } from "next/server";
import { getTenant, requirePermission } from "@/lib/auth";
import { env } from "@/lib/env";
import { AppError, handle, quotaExceeded } from "@/lib/errors";
import { safeTenant, storage } from "@/lib/storage";

type Ctx = { params: Promise<{ key: string[] }> };

/** Receives the file bytes at the signed URL issued by upload-intents. */
export const PUT = handle<Ctx>(async (req, ctx) => {
  const tenant = await getTenant();
  requirePermission(tenant, "document.upload");

  const { key: parts } = await ctx.params;
  const key = parts.join("/");
  const url = new URL(req.url);
  const exp = Number(url.searchParams.get("exp"));
  const sig = url.searchParams.get("sig") ?? "";
  if (!key.startsWith(`${safeTenant(tenant.tenantKey)}/`) || !storage.verifyUploadSignature(key, exp, sig)) {
    throw new AppError("invalid_signature", 403, "Upload link is invalid or expired. Try again.");
  }

  const data = Buffer.from(await req.arrayBuffer());
  if (data.length === 0) throw new AppError("empty_file", 422, "The file is empty.");
  if (data.length > env.MAX_UPLOAD_MB * 1024 * 1024) throw quotaExceeded(`Files are limited to ${env.MAX_UPLOAD_MB} MB`);
  await storage.putObject(key, data);
  return NextResponse.json({ ok: true, size: data.length });
});
