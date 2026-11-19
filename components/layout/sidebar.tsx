"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrainCircuit, FileText, Files, LayoutDashboard, Search, ShieldCheck, Terminal } from "lucide-react";
import { formatBytes, cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/documents", label: "Library", icon: Files },
  { href: "/docs", label: "Docs", icon: FileText },
  { href: "/search", label: "Search", icon: Search },
  { href: "/assistant", label: "AI console", icon: Terminal },
  { href: "/governance", label: "Governance", icon: ShieldCheck },
];

export function Sidebar({ usedBytes, quotaBytes }: { usedBytes: number; quotaBytes: number }) {
  const pathname = usePathname();
  const pct = quotaBytes > 0 ? Math.min(100, (usedBytes / quotaBytes) * 100) : 0;
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-panel/60 p-3 backdrop-blur md:flex">
      <Link href="/dashboard" className="mb-6 flex items-center gap-2.5 px-2 py-2">
        <span className="grid size-9 place-items-center rounded-xl bg-brand/15 text-brand ring-1 ring-brand/40">
          <BrainCircuit className="size-5" />
        </span>
        <span className="text-lg font-semibold tracking-tight">DocuMind</span>
      </Link>
      <nav className="flex flex-1 flex-col gap-1" aria-label="Main">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-dim transition-colors hover:bg-panel-2 hover:text-foreground",
                active && "bg-brand/10 text-brand ring-1 ring-brand/25",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="rounded-xl border border-line bg-panel-2/60 p-3">
        <div className="mb-2 flex items-center justify-between text-xs text-dim">
          <span>Storage</span>
          <span>{pct < 1 && usedBytes > 0 ? "<1" : Math.round(pct)}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-label="Storage used" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-xs text-dim">{formatBytes(usedBytes)} of {formatBytes(quotaBytes)} used</p>
      </div>
    </aside>
  );
}
