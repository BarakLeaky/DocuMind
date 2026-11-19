import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Users } from "lucide-react";
import { NewDocButtons } from "@/components/docs/new-doc-buttons";
import { Topbar } from "@/components/layout/topbar";
import { Badge } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getTenant, requirePermission } from "@/lib/auth";
import { listEditorDocs, type DocSummary } from "@/lib/docs";
import { can } from "@/lib/rbac";
import { timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Docs" };
export const dynamic = "force-dynamic";

function DocList({ items }: { items: DocSummary[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((d) => (
        <li key={d.id}>
          <Link href={`/docs/${d.id}`} className="block h-full">
            <Card className="h-full p-4 transition-colors hover:border-brand/40">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand ring-1 ring-brand/25"><FileText className="size-4" /></span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold">{d.title}</h3>
                  <p className="mt-0.5 text-xs text-dim">Edited {timeAgo(d.updatedAt)}{d.role !== "owner" && <> · {d.ownerName}</>}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                {d.role === "owner" ? <Badge tone="info">Owner</Badge> : <Badge tone={d.role === "editor" ? "ok" : "neutral"}>{d.role === "editor" ? "Can edit" : "View only"}</Badge>}
                {d.sharedCount > 0 && <span className="flex items-center gap-1 text-xs text-dim"><Users className="size-3.5" />Shared with {d.sharedCount}</span>}
              </div>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function DocsPage() {
  const tenant = await getTenant();
  requirePermission(tenant, "document.read");
  const { mine, shared } = await listEditorDocs(tenant);
  const canCreate = can(tenant.role, "doc.edit");
  return (
    <>
      <Topbar tenant={tenant} crumbs={["Workspace", "Docs"]} />
      <main className="mx-auto w-full max-w-[1500px] space-y-8 p-4 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Docs</h1>
            <p className="text-sm text-dim">Write, edit and share documents with your team.</p>
          </div>
          {canCreate && <NewDocButtons />}
        </div>

        <section aria-labelledby="mine" className="space-y-3">
          <h2 id="mine" className="text-sm font-semibold uppercase tracking-wide text-dim">My documents</h2>
          {mine.length === 0 ? (
            <EmptyState icon={FileText} title="No documents yet" action={canCreate ? <NewDocButtons /> : undefined}>
              {canCreate ? "Start a blank document or import a .txt, .md or .docx file. You can share it with a teammate afterwards." : "Your role can't create documents, but anything shared with you appears below."}
            </EmptyState>
          ) : <DocList items={mine} />}
        </section>

        <section aria-labelledby="shared" className="space-y-3">
          <h2 id="shared" className="text-sm font-semibold uppercase tracking-wide text-dim">Shared with me</h2>
          {shared.length === 0 ? <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-dim">Documents teammates share with you will appear here.</p> : <DocList items={shared} />}
        </section>
      </main>
    </>
  );
}
