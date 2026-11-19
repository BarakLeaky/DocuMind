import type { Metadata } from "next";
import { Files } from "lucide-react";
import { DocumentsTable } from "@/components/dashboard/documents-table";
import { Topbar } from "@/components/layout/topbar";
import { EmptyState } from "@/components/ui/empty-state";
import { UploadButton } from "@/components/upload-button";
import { getTenant, requirePermission } from "@/lib/auth";
import { listDocuments } from "@/lib/data";
import { can } from "@/lib/rbac";

export const metadata: Metadata = { title: "Library" };
export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const tenant = await getTenant();
  requirePermission(tenant, "document.read");
  const docs = await listDocuments(tenant, { limit: 200 });
  const canUpload = can(tenant.role, "document.upload");
  return (
    <>
      <Topbar tenant={tenant} crumbs={["Workspace", "Library"]} />
      <main className="mx-auto w-full max-w-[1500px] space-y-5 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
            <p className="text-sm text-dim">Every document in your workspace.</p>
          </div>
          {docs.data.length > 0 && <UploadButton disabled={!canUpload} />}
        </div>
        {docs.data.length === 0 ? (
          <EmptyState icon={Files} title="No documents yet" action={canUpload ? <UploadButton /> : undefined}>
            Uploaded documents are listed here with their processing status.
          </EmptyState>
        ) : (
          <DocumentsTable data={docs.data} pageSize={12} canDelete={can(tenant.role, "document.delete")} />
        )}
      </main>
    </>
  );
}
