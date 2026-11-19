import { NextResponse } from "next/server";
import { z } from "zod";
import { getTenant, requirePermission } from "@/lib/auth";
import { env } from "@/lib/env";
import { handle, quotaExceeded } from "@/lib/errors";
import { storage } from "@/lib/storage";

const ALLOWED = ["pdf", "docx", "txt", "md"] as const;

const body = z.object({
  filename: z.string().min(1).max(255),
  size: z.number().int().positive(),
  mime: z.string().max(200).optional(),
});

export const POST = handle(async (req) => {
  const tenant = await getTenant();
  requirePermission(tenant, "document.upload");
  const input = body.parse(await req.json());

  const ext = input.filename.split(".").pop()?.toLowerCase() ?? "";
  if (!(ALLOWED as readonly string[]).includes(ext)) {
    return NextResponse.json(
      { error: { code: "unsupported_type", message: `Allowed types: ${ALLOWED.join(", ")}` } },
      { status: 415 },
    );
  }
  const maxBytes = env.MAX_UPLOAD_MB * 1024 * 1024;
  if (input.size > maxBytes) throw quotaExceeded(`Files are limited to ${env.MAX_UPLOAD_MB} MB`);

  const target = storage.createUploadTarget(tenant.tenantKey, ext);
  return NextResponse.json({ key: target.key, uploadUrl: target.uploadUrl, method: "PUT", expiresAt: target.expiresAt, maxBytes });
});
