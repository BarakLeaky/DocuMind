/**
 * Seeds demo data into Postgres. Usage:
 *   npm run db:seed                      -> tenant "demo-org" (matches NEXT_PUBLIC_DEMO_MODE=true with DATABASE_URL)
 *   npm run db:seed -- --tenant user_123 -> your Clerk user id or org id (shown in the Clerk dashboard)
 */
import { eq } from "drizzle-orm";
import { getDb, schema } from "./index";
import { demoChunks, demoDocuments, demoReview } from "../lib/demo-data";
import { embedTexts } from "../lib/ai/embeddings";
import { env } from "../lib/env";

const tenantArg = process.argv.indexOf("--tenant");
const slug = tenantArg > -1 ? process.argv[tenantArg + 1] : "demo-org";
const db = getDb();

async function main() {
  let [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.slug, slug));
  org ??= (await db.insert(schema.organizations).values({ name: "DocuMind Demo Org", slug }).returning())[0];
  let [ws] = await db.select().from(schema.workspaces).where(eq(schema.workspaces.organizationId, org.id));
  ws ??= (await db.insert(schema.workspaces).values({ organizationId: org.id, name: "Main workspace" }).returning())[0];

  const collectionNames = [...new Set(demoDocuments.map((d) => d.collection))];
  const collections = new Map<string, string>();
  for (const name of collectionNames) {
    const [c] = await db.insert(schema.collections).values({ workspaceId: ws.id, name }).returning();
    collections.set(name, c.id);
  }

  const idMap = new Map<string, { documentId: string; versionId: string }>();
  for (const d of demoDocuments) {
    const [doc] = await db.insert(schema.documents).values({
      workspaceId: ws.id, collectionId: collections.get(d.collection), title: d.title, docType: d.type,
      status: d.status, createdBy: "seed", updatedAt: new Date(d.updatedAt),
    }).returning();
    const [ver] = await db.insert(schema.documentVersions).values({
      documentId: doc.id, versionNumber: d.version, objectKey: `seed/${doc.id}`, checksum: "seed", mime: "application/pdf",
      sizeBytes: d.sizeBytes, pageCount: d.pages, createdBy: "seed",
    }).returning();
    await db.update(schema.documents).set({ currentVersionId: ver.id }).where(eq(schema.documents.id, doc.id));
    idMap.set(d.id, { documentId: doc.id, versionId: ver.id });
  }

  const rows = demoChunks.map((c, i) => ({ c, versionId: idMap.get(c.documentId)!.versionId, i }));
  const chunkRows = await db.insert(schema.documentChunks).values(
    rows.map(({ c, versionId, i }) => ({
      versionId, chunkIndex: i, content: c.content, page: c.page, section: c.section, charStart: 0, charEnd: c.content.length, tokenCount: Math.ceil(c.content.length / 4),
    })),
  ).returning({ id: schema.documentChunks.id, content: schema.documentChunks.content });

  const vectors = await embedTexts(chunkRows.map((r) => r.content)).catch(() => null);
  if (vectors) {
    await db.insert(schema.documentEmbeddings).values(chunkRows.map((r, i) => ({ chunkId: r.id, modelId: env.EMBEDDING_MODEL, embedding: vectors[i] })));
    console.log("Embeddings created.");
  } else {
    console.log("No OPENAI_API_KEY: skipped embeddings (keyword search still works).");
  }

  const inv = idMap.get(demoReview.documentId)!;
  const [run] = await db.insert(schema.extractionRuns).values({ versionId: inv.versionId, status: "completed", modelId: "seed" }).returning();
  await db.insert(schema.extractedFields).values(
    demoReview.fields.map((f) => ({ runId: run.id, fieldPath: f.label, valueJson: f.value, confidence: f.confidence, reviewStatus: f.status })),
  );

  console.log(`Seeded tenant "${slug}": ${demoDocuments.length} documents, ${chunkRows.length} chunks.`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
