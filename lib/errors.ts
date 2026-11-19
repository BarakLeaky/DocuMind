import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(public code: string, public status: number, message: string, public details?: unknown) {
    super(message);
  }
}
export const unauthorized = () => new AppError("unauthorized", 401, "Authentication required");
export const forbidden = (p?: string) => new AppError("forbidden", 403, p ? `Missing permission: ${p}` : "Forbidden");
export const notFound = (what = "Resource") => new AppError("not_found", 404, `${what} not found`);
export const quotaExceeded = (msg: string) => new AppError("quota_exceeded", 413, msg);

export function errorResponse(err: unknown) {
  if (err instanceof AppError) {
    return NextResponse.json({ error: { code: err.code, message: err.message, details: err.details } }, { status: err.status });
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Invalid request", details: err.issues } },
      { status: 422 },
    );
  }
  console.error("[api] unhandled", err);
  return NextResponse.json({ error: { code: "internal_error", message: "Unexpected error" } }, { status: 500 });
}

/** Wraps a route handler so every failure uses the same error envelope. */
export function handle<C = unknown>(fn: (req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      return errorResponse(err);
    }
  };
}
