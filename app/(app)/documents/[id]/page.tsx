import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { ReviewCockpit } from "@/components/review/cockpit";
import { getTenant, requirePermission } from "@/lib/auth";
import { getCockpit } from "@/lib/review-center";
import { can } from "@/lib/rbac";

export const metadata: Metadata = { title: "Document review" };
export const dynamic = "force-dynamic";

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await getTenant();
  requirePermission(tenant, "document.read");
  const cockpit = await getCockpit(tenant, id);
  if (!cockpit) notFound();
  return (
    <>
      <Topbar tenant={tenant} crumbs={["Workspace", "Library", cockpit.review.title]} />
      <main className="mx-auto w-full max-w-[1500px] space-y-4 p-4 md:p-6">
        <h1 className="text-2xl font-semibold tracking-tight">{cockpit.review.title}</h1>
        <ReviewCockpit data={cockpit} canReview={can(tenant.role, "extraction.run")} canExport={can(tenant.role, "document.download")} />
      </main>
    </>
  );
}
