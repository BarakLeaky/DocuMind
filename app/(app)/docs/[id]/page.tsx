import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocEditor } from "@/components/docs/editor";
import { Topbar } from "@/components/layout/topbar";
import { getTenant, requirePermission } from "@/lib/auth";
import { getEditorDoc } from "@/lib/docs";

export const metadata: Metadata = { title: "Document" };
export const dynamic = "force-dynamic";

export default async function DocPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await getTenant();
  requirePermission(tenant, "document.read");
  const doc = await getEditorDoc(tenant, id);
  if (!doc) notFound();
  return (
    <>
      <Topbar tenant={tenant} crumbs={["Workspace", "Docs", doc.title]} />
      <main className="p-4 md:p-6"><DocEditor doc={doc} /></main>
    </>
  );
}
