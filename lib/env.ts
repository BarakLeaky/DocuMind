const read = (key: string): string | undefined => {
  const v = process.env[key]?.trim();
  return v ? v : undefined;
};

const num = (key: string, fallback: number) => {
  const n = Number(read(key));
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const env = {
  DATABASE_URL: read("DATABASE_URL"),
  ANTHROPIC_API_KEY: read("ANTHROPIC_API_KEY"),
  ANTHROPIC_MODEL: read("ANTHROPIC_MODEL") ?? "claude-sonnet-5-5",
  OPENAI_API_KEY: read("OPENAI_API_KEY"),
  EMBEDDING_MODEL: read("EMBEDDING_MODEL") ?? "text-embedding-3-small",
  STORAGE_SIGNING_SECRET: read("STORAGE_SIGNING_SECRET"),
  CRON_SECRET: read("CRON_SECRET"),
  /** Vercel functions accept request bodies up to 4.5 MB, so 4 MB is the safe default. */
  MAX_UPLOAD_MB: num("MAX_UPLOAD_MB", 4),
  STORAGE_QUOTA_MB: num("STORAGE_QUOTA_MB", 500),
  /** Per-user hourly caps. They protect your AI bill once other people can sign up. */
  RATE_LIMIT_AI_PER_HOUR: num("RATE_LIMIT_AI_PER_HOUR", 30),
  RATE_LIMIT_UPLOADS_PER_HOUR: num("RATE_LIMIT_UPLOADS_PER_HOUR", 20),
};