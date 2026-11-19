import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { SearchClient } from "@/components/search/search-client";
import { EmptyState } from "@/components/ui/empty-state";
import { getTenant, requirePermission } from "@/lib/auth";
import { countDocuments } from "@/lib/data";

export const metadata: Metadata = { title: "Search" };
export const dynamic = "force-dynamic";

export default async function SearchPage() {
  const tenant = await getTenant();
  requirePermission(tenant, "document.read");
  const count = await countDocuments(tenant);
  return (
    <>
      <Topbar tenant={tenant} crumbs={["Workspace", "Search"]} />
      <main className="mx-auto w-full max-w-4xl space-y-5 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
          <p className="text-sm text-dim">Find passages by exact words or by meaning, limited to documents you can read.</p>
        </div>
        {count === 0 ? (
          <EmptyState icon={SearchX} title="There's nothing to search yet" action={<Link href="/documents" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-brand-strong">Upload a document</Link>}>
            Search covers the text of every document you upload.
          </EmptyState>
        ) : (
          <SearchClient />
        )}
      </main>
    </>
  );
}
