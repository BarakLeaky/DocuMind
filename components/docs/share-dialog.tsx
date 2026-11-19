"use client";

import { useState } from "react";
import { Loader2, Share2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Share } from "@/lib/docs";

export function ShareDialog({ docId, initial }: { docId: string; initial: Share[] }) {
  const [open, setOpen] = useState(false);
  const [shares, setShares] = useState(initial);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"viewer" | "editor">("viewer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/v1/docs/${docId}/shares`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, role }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error?.message ?? "Could not share");
      setShares((s) => [...s.filter((x) => x.userId !== body.share.userId), body.share]);
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not share");
    } finally {
      setBusy(false);
    }
  }

  async function remove(shareId: string) {
    const before = shares;
    setShares((s) => s.filter((x) => x.id !== shareId));
    const res = await fetch(`/api/v1/docs/${docId}/shares`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shareId }) });
    if (!res.ok) { setShares(before); setError("Could not remove access. Try again."); }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}><Share2 />Share</Button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Share document" className="w-full max-w-md rounded-xl border border-line bg-panel p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">Share this document</h2>
              <Button size="icon" variant="ghost" aria-label="Close" onClick={() => setOpen(false)}><X /></Button>
            </div>
            <form onSubmit={add} className="flex gap-2">
              <Input type="email" required autoFocus placeholder="teammate@company.com" aria-label="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
              <select aria-label="Access level" value={role} onChange={(e) => setRole(e.target.value as "viewer" | "editor")} className="h-9 rounded-lg border border-line bg-panel px-2 text-sm">
                <option value="viewer">Can view</option>
                <option value="editor">Can edit</option>
              </select>
              <Button type="submit" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : "Add"}</Button>
            </form>
            {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
            <h3 className="mb-2 mt-5 text-xs font-medium uppercase tracking-wide text-dim">People with access</h3>
            {shares.length === 0 ? (
              <p className="text-sm text-dim">Only you. Add an email above to share this document.</p>
            ) : (
              <ul className="space-y-1.5">
                {shares.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 rounded-lg border border-line bg-panel-2/40 px-3 py-2 text-sm">
                    <div className="min-w-0 flex-1"><div className="truncate font-medium">{s.name || s.email}</div><div className="truncate text-xs text-dim">{s.email}</div></div>
                    <span className="text-xs text-dim">{s.role === "editor" ? "Can edit" : "Can view"}</span>
                    <Button size="icon" variant="ghost" className="size-7" aria-label={`Remove ${s.email}`} onClick={() => remove(s.id)}><Trash2 /></Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
