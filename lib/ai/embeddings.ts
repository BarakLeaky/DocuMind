import { env } from "@/lib/env";

export const embeddingsEnabled = Boolean(env.OPENAI_API_KEY);

/** Returns one vector per input, or null when no embedding provider is configured. */
export async function embedTexts(texts: string[]): Promise<number[][] | null> {
  if (!env.OPENAI_API_KEY || texts.length === 0) return null;
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: env.EMBEDDING_MODEL, input: texts }),
  });
  if (!res.ok) throw new Error(`Embedding provider error ${res.status}`);
  const json = (await res.json()) as { data: { index: number; embedding: number[] }[] };
  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}
