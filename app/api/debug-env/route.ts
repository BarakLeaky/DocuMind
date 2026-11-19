import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const matches = Object.keys(process.env)
    .filter((k) => /anthropic/i.test(k))
    .map((k) => ({ name: JSON.stringify(k), length: (process.env[k] ?? "").length }));
  return NextResponse.json({
    vercelEnv: process.env.VERCEL_ENV,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7),
    matches,
  });
}
