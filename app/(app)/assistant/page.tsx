import type { Metadata } from "next";
import Link from "next/link";
import { FileUp } from "lucide-react";
import { Console } from "@/components/assistant/console";
import { Topbar } from "@/components/layout/topbar";
import { EmptyState } from "@/components/ui/empty-state";
import { getTenant, requirePermission } from "@/lib/auth";
import { getStats } from "@/lib/data";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "AI console" };
export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  const tenant = await getTenant();
  requirePermission(tenant, "assistant.query");
  const stats = await getStats(tenant);
  return (
    <>
      <Topbar tenant={tenant} crumbs={["Workspace", "AI console"]} />
      <main className="mx-auto w-full max-w-[1500px] space-y-4 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI console</h1>
          <p className="text-sm text-dim">Answers come only from documents you can read, and each one cites its source.</p>
        </div>
        {stats.searchablePassages === 0 ? (
          <EmptyState
            icon={FileUp}
            title="Nothing to ask about yet"
            action={<Link href="/documents" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-brand-strong">Go to library</Link>}
          >
            Upload a document and wait for it to show as Ready. Then the console can answer questions about it.
          </EmptyState>
        ) : (
          <Console
            status={{
              model: env.ANTHROPIC_API_KEY ? env.ANTHROPIC_MODEL : null,
              semantic: Boolean(env.OPENAI_API_KEY),
              documents: stats.totalDocuments,
              passages: stats.searchablePassages,
            }}
          />
        )}
      </main>
    </>
  );
}
