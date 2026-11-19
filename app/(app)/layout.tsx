import { Sidebar } from "@/components/layout/sidebar";
import { SearchShortcut } from "@/components/layout/shortcut";
import { getTenant } from "@/lib/auth";
import { getStorageUsage } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getTenant();
  const usage = await getStorageUsage(tenant);
  return (
    <div className="flex min-h-screen">
      <Sidebar usedBytes={usage.usedBytes} quotaBytes={usage.quotaBytes} />
      <div className="flex min-w-0 flex-1 flex-col">
        <SearchShortcut />
        {children}
      </div>
    </div>
  );
}
