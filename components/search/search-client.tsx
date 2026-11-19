"use client";

import Link from "next/link";
import { useState } from "react";
import { FileText, Loader2, Search } from "lucide-react";
import { Badge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Result = {
  chunkId: string; documentId: string; documentTitle: string; version: number; page: number;
  section: string | null; excerpt: string; score: number; via: string[];
};

export function SearchClient() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(q: string) {
    if (q.trim().length < 2) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Search failed");
      setResults(body.results);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-dim" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run(query)}
            placeholder="Search by meaning or exact terms…"
            className="h-11 pl-9 text-base"
            aria-label="Search documents"
          />
        </div>
        <Button className="h-11" onClick={() => run(query)} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Search />} Search
        </Button>
      </div>

      {results === null && !busy && (
        <p className="text-sm text-dim">Type a few words or a full question. Results are passages from your documents, ranked by exact terms and by meaning.</p>
      )}

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {results && results.length === 0 && <p className="py-10 text-center text-dim">Nothing in your documents matched “{query}”. Try fewer or different words.</p>}

      <ul className="space-y-3">
        {results?.map((r) => (
          <li key={r.chunkId}>
            <Card className="p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <FileText className="size-4 text-brand" />
                <Link href={`/documents/${r.documentId}`} className="font-medium hover:text-brand">{r.documentTitle}</Link>
                <Badge>v{r.version}</Badge>
                <Badge>p. {r.page}</Badge>
                {r.section && <span className="text-xs text-dim">{r.section}</span>}
                <span className="ml-auto flex items-center gap-1.5">
                  {r.via.map((v) => <Badge key={v} tone="info">{v}</Badge>)}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-foreground/90">{r.excerpt}</p>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
