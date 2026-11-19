
import { NextResponse } from "next/server";
import { z } from "zod";
import { getTenant, requirePermission } from "@/lib/auth";
import { env } from "@/lib/env";
import { AppError, handle, quotaExceeded } from "@/lib/errors";
import { storage } from "@/lib/storage";

const intentBody = z.object({
  filename: z.string().trim().min(1).max(255),
  size: z.number().int().positive(),
  mime: z.string().max(150),
});

export const POST = handle(async (req) => {
  const tenant = await getTenant();
  requirePermission(tenant, "document.upload");

  const input = intentBody.parse(await req.json());

  if (input.size > env.MAX_UPLOAD_MB * 1024 * 1024) {
    throw quotaExceeded(
      `Files are limited to ${env.MAX_UPLOAD_MB} MB`
    );
  }

  const ext = input.filename.split(".").pop()?.toLowerCase() ?? "";
  const allowedExtensions = ["pdf", "docx", "txt", "md"];

  if (!allowedExtensions.includes(ext)) {
    throw new AppError(
      "unsupported_type",
      415,
      "This file isn't a readable PDF, Word (.docx) or text file."
    );
  }

  const target = storage.createUploadTarget(tenant.tenantKey, ext);

  return NextResponse.json({
    key: target.key,
    uploadUrl: target.uploadUrl,
    expiresAt: target.expiresAt.toISOString(),
  });
});
