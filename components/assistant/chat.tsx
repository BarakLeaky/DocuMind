"use client";

import { useRef, useState } from "react";
import { Loader2, Send, ShieldAlert, Sparkles } from "lucide-react";
import { Badge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Citation = { id: string; documentId: string; documentTitle: string; versionNumber: number; page: number; section: string | null; excerpt: string };
type Segment = { text: string; citationIds: string[] };
type Msg =
  | { role: "user"; text: string }
  | { role: "assistant"; segments: Segment[]; citations: Citation[]; insufficient: boolean; model: string };

const EXAMPLES = ["How much notice is needed to terminate the agreement?", "How long must we keep invoices?", "What is the deadline to report a security incident?"];

export function Chat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<Citation[]>([]);
  const convo = useRef<string | null>(null);

  async function send(question: string) {
    const q = question.trim();
    if (q.length < 2 || busy) return;
    setInput("");
    setError(null);
    setBusy(true);
    setMessages((m) => [...m, { role: "user", text: q }]);
    try {
      if (!convo.current) {
        const res = await fetch("/api/v1/assistant/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error?.message ?? "Could not start conversation");
        convo.current = body.id;
      }
      const res = await fetch(`/api/v1/assistant/conversations/${convo.current}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "The assistant failed to respond");
      setMessages((m) => [...m, { role: "assistant", segments: body.segments, citations: body.citations, insufficient: body.insufficientEvidence, model: body.model }]);
      setEvidence(body.citations);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <Card className="flex min-h-[560px] flex-col">
        <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="size-4 text-brand" />Ask your documents</CardTitle></CardHeader>
        <CardContent className="flex flex-1 flex-col gap-4 overflow-auto">
          {messages.length === 0 && (
            <div className="m-auto max-w-md space-y-3 text-center">
              <p className="text-sm text-dim">Answers are grounded in passages you are allowed to read, with citations you can verify.</p>
              <div className="flex flex-col gap-2">
                {EXAMPLES.map((e) => (
                  <button key={e} onClick={() => send(e)} className="rounded-lg border border-line bg-panel-2/50 px-3 py-2 text-left text-sm hover:border-brand/50">{e}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-brand/15 px-4 py-2 text-sm ring-1 ring-brand/30">{m.text}</div>
            ) : (
              <div key={i} className="max-w-[90%] space-y-2 rounded-2xl rounded-bl-sm border border-line bg-panel-2/50 px-4 py-3 text-sm leading-relaxed">
                {m.insufficient ? (
                  <p className="flex items-start gap-2 text-warn"><ShieldAlert className="mt-0.5 size-4 shrink-0" />I couldn&apos;t find enough evidence in your authorized documents to answer that.</p>
                ) : (
                  m.segments.map((s, j) => (
                    <p key={j}>
                      {s.text}{" "}
                      {s.citationIds.map((id) => (
                        <button key={id} onClick={() => setEvidence(m.citations)} className="mx-0.5 inline-grid size-5 place-items-center rounded bg-brand/20 align-middle text-[10px] font-semibold text-brand hover:bg-brand/30" aria-label={`Citation ${id}`}>{id}</button>
                      ))}
                    </p>
                  ))
                )}
                <p className="text-[10px] text-dim">model: {m.model}</p>
              </div>
            ),
          )}
          {busy && <div className="flex items-center gap-2 text-sm text-dim"><Loader2 className="size-4 animate-spin" />Searching evidence…</div>}
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        </CardContent>
        <form className="flex gap-2 border-t border-line p-3" onSubmit={(e) => { e.preventDefault(); send(input); }}>
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a question about your documents…" aria-label="Question" />
          <Button type="submit" disabled={busy || input.trim().length < 2}><Send />Ask</Button>
        </form>
      </Card>

      <Card className="flex flex-col">
        <CardHeader><CardTitle>Evidence</CardTitle><Badge>{evidence.length} sources</Badge></CardHeader>
        <CardContent className="flex-1 space-y-3 overflow-auto">
          {evidence.length === 0 ? (
            <p className="py-10 text-center text-sm text-dim">Cited passages appear here.</p>
          ) : (
            evidence.map((c) => (
              <div key={c.id} className="rounded-lg border border-line bg-panel-2/40 p-3">
                <div className="mb-1 flex items-center gap-2 text-xs">
                  <span className="grid size-5 place-items-center rounded bg-brand/20 font-semibold text-brand">{c.id}</span>
                  <span className="truncate font-medium">{c.documentTitle}</span>
                </div>
                <p className="text-[11px] text-dim">v{c.versionNumber} · page {c.page}{c.section ? ` · ${c.section}` : ""}</p>
                <p className="mt-2 border-l-2 border-brand/50 pl-2 text-xs leading-relaxed text-foreground/90">{c.excerpt}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
