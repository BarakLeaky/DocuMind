/** One-time database prep: enables the pgvector extension. `npm run db:setup` runs this and then pushes the schema. */
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is missing. Copy .env.example to .env.local and paste your Postgres connection string.");
  process.exit(1);
}

const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 20 });
try {
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;
  console.log("pgvector extension is enabled.");
} catch (err) {
  console.error("Could not enable pgvector:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
