import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { Badge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTenant } from "@/lib/auth";
import { listAudit, listMembers } from "@/lib/governance";
import { can, PERMISSIONS, ROLE_LABELS, ROLES } from "@/lib/rbac";
import { timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Governance" };
export const dynamic = "force-dynamic";

export default async function GovernancePage() {
  const tenant = await getTenant();
  const canAudit = can(tenant.role, "audit.read");
  const canMembers = can(tenant.role, "members.manage");
  const [members, auditRows] = await Promise.all([listMembers(tenant), canAudit ? listAudit(tenant) : Promise.resolve([])]);

  return (
    <>
      <Topbar tenant={tenant} crumbs={["Workspace", "Governance"]} />
      <main className="mx-auto w-full max-w-[1500px] space-y-6 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Governance</h1>
          <p className="text-sm text-dim">Roles, permissions and audit history. Your role: <strong className="text-foreground">{ROLE_LABELS[tenant.role]}</strong></p>
        </div>

        <Card>
          <CardHeader><CardTitle>Permission matrix</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-dim">
                  <th className="py-2 pr-4">Permission</th>
                  {ROLES.map((r) => <th key={r} className="px-3 py-2 text-center">{ROLE_LABELS[r]}</th>)}
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS.map((p) => (
                  <tr key={p} className="border-t border-line">
                    <td className="py-2 pr-4 font-mono text-xs">{p}</td>
                    {ROLES.map((r) => (
                      <td key={r} className="px-3 py-2 text-center">
                        {can(r, p) ? <Check className="mx-auto size-4 text-ok" aria-label="allowed" /> : <Minus className="mx-auto size-4 text-line" aria-label="denied" />}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Members</CardTitle>{!canMembers && <Badge>read-only</Badge>}</CardHeader>
            <CardContent>
              <ul className="divide-y divide-line">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <div className="text-sm font-medium">{m.name}{m.isYou && <span className="ml-2 text-xs text-dim">(you)</span>}</div>
                      <div className="text-xs text-dim">{m.email}</div>
                    </div>
                    <div className="text-right">
                      <Badge tone="info">{ROLE_LABELS[m.role]}</Badge>
                      <div className="mt-1 text-[11px] text-dim">joined {timeAgo(m.joinedAt)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Audit log</CardTitle>{!canAudit && <Badge tone="warn">requires audit.read</Badge>}</CardHeader>
            <CardContent>
              {canAudit ? (
                auditRows.length === 0 ? (
                  <p className="py-8 text-center text-sm text-dim">Uploads, downloads, deletions, reviews and questions are recorded here.</p>
                ) : (
                <ul className="divide-y divide-line">
                  {auditRows.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <div className="min-w-0">
                        <span className="font-mono text-xs text-brand">{a.action}</span>
                        <div className="truncate text-xs text-dim">{a.actor} · {a.resource}</div>
                      </div>
                      <span className="shrink-0 text-xs text-dim">{timeAgo(a.at)}</span>
                    </li>
                  ))}
                </ul>
                )
              ) : (
                <p className="py-8 text-center text-sm text-dim">You don&apos;t have permission to view audit records.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
