import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Tenant } from "@/lib/auth";
import { generateAnswer, PROMPT_VERSION } from "@/lib/ai/answer";
import { resolveCitations } from "@/lib/citations";
import { retrieve } from "@/lib/retrieval";
import { audit, ensureWorkspace } from "@/lib/tenancy";

export async function createConversation(tenant: Tenant, title = "New conversation") {
  const { workspaceId } = await ensureWorkspace(tenant);
  const [row] = await getDb()
    .insert(schema.conversations)
    .values({ workspaceId, userId: tenant.userId, title })
    .returning({ id: schema.conversations.id });
  return row;
}

export async function ask(tenant: Tenant, conversationId: string, question: string) {
  if (!/^[0-9a-f-]{36}$/i.test(conversationId)) throw new Error("Conversation not found");
  const db = getDb();
  const { workspaceId } = await ensureWorkspace(tenant);
  // A conversation is only usable by its owner inside the current workspace.
  const [conv] = await db
    .select()
    .from(schema.conversations)
    .where(and(eq(schema.conversations.id, conversationId), eq(schema.conversations.userId, tenant.userId), eq(schema.conversations.workspaceId, workspaceId)))
    .limit(1);
  if (!conv) throw new Error("Conversation not found");

  const evidence = await retrieve(tenant, question, 6);
  const generated = await generateAnswer(question, evidence);
  const resolved = resolveCitations(generated.segments, evidence);
  const insufficient = generated.insufficientEvidence || resolved.segments.length === 0;

  await db.insert(schema.messages).values({ conversationId, role: "user", content: question });
  const [msg] = await db
    .insert(schema.messages)
    .values({
      conversationId,
      role: "assistant",
      content: resolved.segments.map((s) => s.text).join("\n"),
      modelId: generated.model,
      promptVersion: PROMPT_VERSION,
      insufficientEvidence: insufficient ? 1 : 0,
    })
    .returning({ id: schema.messages.id });
  if (conv.title === "New conversation") {
    await db.update(schema.conversations).set({ title: question.slice(0, 80) }).where(eq(schema.conversations.id, conversationId));
  }
  if (resolved.citations.length) {
    await db.insert(schema.messageCitations).values(
      resolved.citations.map((c) => ({ messageId: msg.id, chunkId: c.chunkId, versionId: c.versionId, pageNumber: c.page, quoteHash: c.quoteHash })),
    );
  }

  await audit(tenant, "assistant.query", "conversation", conversationId, { sources: resolved.citations.length });

  return {
    conversationId,
    messageId: msg.id,
    segments: resolved.segments,
    citations: resolved.citations,
    insufficientEvidence: insufficient,
    invalidReferences: resolved.invalidReferences,
    model: generated.model,
    notice: generated.notice ?? null,
  };
}
