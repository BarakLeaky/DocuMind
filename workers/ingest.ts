/**
 * Optional background worker: `npm run worker`. Uploads are already processed inline by the web app;
 * this loop only matters for retries and for self-hosted setups without cron.
 */
import { drainQueue } from "../lib/ingest";

async function main() {
  console.log("[worker] started; polling for queued jobs…");
  for (;;) {
    const n = await drainQueue(5);
    if (n === 0) await new Promise((r) => setTimeout(r, 3000));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
