import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileUp, ScanSearch } from "lucide-react";
import { IngestionChart } from "@/components/dashboard/ingestion-chart";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { PipelineCard } from "@/components/dashboard/pipeline-card";
import { DocumentsTable } from "@/components/dashboard/documents-table";
import { Topbar } from "@/components/layout/topbar";
import { AutoRefresh } from "@/components/review/auto-refresh";
import { ReviewCockpit } from "@/components/review/cockpit";
import { UploadButton } from "@/components/upload-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getTenant } from "@/lib/auth";
import { getIngestionSeries, getPipeline, getStats, listDocuments } from "@/lib/data";
import { pickCockpitDocument } from "@/lib/review-center";
import { can } from "@/lib/rbac";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const tenant = await getTenant();
  const [stats, series, pipeline, docs] = await Promise.all([
    getStats(tenant), getIngestionSeries(tenant), getPipeline(tenant), listDocuments(tenant, { limit: 50 }),
  ]);
  const canUpload = can(tenant.role, "document.upload");

  // Feature the newest document that still needs a human decision. Everything in the cockpit is read from the backend.
  const cockpit = await pickCockpitDocument(tenant, docs.data);

  const processing = pipeline.some((p) => p.count > 0 && ["uploaded", "queued", "validating", "extracting", "ocr", "normalizing", "chunking", "embedding", "indexing"].includes(p.state));

  return (
    <>
      <AutoRefresh active={processing} />
      <Topbar tenant={tenant} crumbs={["Workspace", "Dashboard"]} />
      <main className="mx-auto w-full max-w-[1500px] space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Welcome, {tenant.firstName}</h1>
            <p className="text-sm text-dim">Secure, searchable, traceable knowledge from your documents.</p>
          </div>
          {docs.data.length > 0 && <UploadButton disabled={!canUpload} />}
        </div>

        {docs.data.length === 0 ? (
          <EmptyState
            icon={FileUp}
            title="Your workspace is empty"
            className="py-20"
            action={canUpload ? <UploadButton /> : undefined}
          >
            {canUpload
              ? "Upload a PDF, Word or text file to get started. Once it's processed you can search it, ask questions about it and review its key fields."
              : "Your role can't upload documents. Ask a workspace admin to add some."}
          </EmptyState>
        ) : (
          <>
            <KpiCards stats={stats} />

            <section aria-labelledby="review-heading" className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 id="review-heading" className="text-sm font-semibold uppercase tracking-wide text-dim">Document intelligence · Review</h2>
                {cockpit && (
                  <Link href={`/documents/${cockpit.review.documentId}`} className="inline-flex items-center gap-1 text-sm text-brand hover:underline">
                    Open full review <ArrowRight className="size-4" />
                  </Link>
                )}
              </div>
              {cockpit ? (
                <ReviewCockpit data={cockpit} canReview={can(tenant.role, "extraction.run")} canExport={can(tenant.role, "document.download")} />
              ) : (
                <EmptyState icon={ScanSearch} title="Nothing waiting for review">
                  Once a document has been read and its fields extracted, it appears here with confidence scores, validation checks and anomaly flags. Add an Anthropic API key to turn on field extraction.
                </EmptyState>
              )}
            </section>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <IngestionChart data={series} />
              <PipelineCard items={pipeline} />
            </div>

            <Card>
              <CardHeader><CardTitle>Recent documents</CardTitle><Link href="/documents" className="text-xs text-brand hover:underline">View library</Link></CardHeader>
              <CardContent><DocumentsTable data={docs.data} pageSize={6} compact canDelete={can(tenant.role, "document.delete")} /></CardContent>
            </Card>
          </>
        )}
      </main>
    </>
  );
}
