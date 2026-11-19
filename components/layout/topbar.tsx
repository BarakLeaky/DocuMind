import Link from "next/link";
import { Search } from "lucide-react";
import { ROLE_LABELS } from "@/lib/rbac";
import type { Tenant } from "@/lib/auth";
import { UserMenu } from "@/components/layout/user-menu";

export function Topbar({ tenant, crumbs }: { tenant: Tenant; crumbs: string[] }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-line bg-background/70 px-4 backdrop-blur md:px-6">
      <nav className="flex min-w-0 items-center gap-2 text-sm text-dim" aria-label="Breadcrumb">
        {crumbs.map((c, i) => (
          <span key={`${c}-${i}`} className="flex min-w-0 items-center gap-2">
            {i > 0 && <span>/</span>}
            <span className={i === crumbs.length - 1 ? "truncate text-foreground" : ""}>{c}</span>
          </span>
        ))}
      </nav>
      <Link
        href="/search"
        className="ml-auto hidden h-9 w-72 items-center gap-2 rounded-lg border border-line bg-panel px-3 text-sm text-dim hover:border-brand/40 md:flex"
      >
        <Search className="size-4" />
        Search documents…
        <kbd className="ml-auto rounded border border-line px-1.5 text-[10px]">Ctrl K</kbd>
      </Link>
      <div className="ml-auto hidden text-right leading-tight sm:block md:ml-0">
        <div className="text-sm font-medium">{tenant.name}</div>
        <div className="text-xs text-dim">{ROLE_LABELS[tenant.role]}</div>
      </div>
      <UserMenu />
    </header>
  );
}
