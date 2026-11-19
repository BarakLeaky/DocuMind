"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CornerDownLeft, Loader2, ShieldAlert, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";

type Citation = { id: string; documentId: string; documentTitle: string; versionNumber: number; page: number; section: string | null; excerpt: string };
type Segment = { text: string; citationIds: string[] };
type Msg =
  | { role: "user"; text: string }
  | { role: "assistant"; segments: Segment[]; citations: Citation[]; insufficient: boolean; model: string; notice: string | null; fresh: boolean };

export type ConsoleStatus = { model: string | null; semantic: boolean; documents: number; passages: number };

const STARTERS = [
  "Summarize the key obligations in my documents.",
  "What deadlines or due dates are mentioned?",
  "Which people or companies are named across my documents?",
];

/** Reveals text quickly, like a terminal printing, without delaying anyone for long. Skipped for reduced motion. */
function useReveal(total: number, enabled: boolean) {
  const [n, setN] = useState(enabled ? 0 : total);
  useEffect(() => {
    if (!enabled || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setN(total);
      return;
    }
    const step = Math.max(2, Math.ceil(total / 60)); // finishes in about a second
    const id = window.setInterval(() => setN((v) => (v + step >= total ? (window.clearInterval(id), total) : v + step)), 16);
    return () => window.clearInterval(id);
  }, [total, enabled]);
  return n;
}

function Answer({ msg, onCite }: { msg: Extract<Msg, { role: "assistant" }>; onCite: (id: string) => void }) {
  const total = msg.segments.reduce((s, x) => s + x.text.length, 0);
  const shown = useReveal(total, msg.fresh);
  let left = shown;
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {msg.insufficient ? (
        <p className="flex items-start gap-2 text-warn">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          Nothing in your documents answers that. Try different words, or upload the document that covers it.
        </p>
      ) : (
        msg.segments.map((s, j) => {
          const part = s.text.slice(0, Math.max(0, left));
          const complete = left >= s.text.length;
          left -= s.text.length;
          if (!part) return null;
          return (
            <p key={j}>
              {part}
              {complete && s.citationIds.map((id) => (
                <button key={id} onClick={() => onCite(id)} className="neon-edge mx-0.5 inline-grid size-5 place-items-center rounded bg-brand/15 align-middle font-mono text-[10px] font-semibold text-brand hover:bg-brand/30" aria-label={`Citation ${id}`}>
                  {id}
                </button>
              ))}
            </p>
          );
        })
      )}
      {msg.notice && <p className="font-mono text-[11px] text-warn">{msg.notice}</p>}
      <p className="font-mono text-[10px] text-dim">{msg.model === "extractive-fallback" ? "source: closest passages" : `model: ${msg.model}`}</p>
    </div>
  );
}

export function Console({ status }: { status: ConsoleStatus }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<Citation[]>([]);
  const [activeCite, setActiveCite] = useState<string | null>(null);
  const convo = useRef<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send(question: string) {
    const q = question.trim();
    if (q === "/clear") {
      setMessages([]); setEvidence([]); setActiveCite(null); setError(null); setInput("");
      convo.current = null;
      return;
    }
    if (q.length < 2 || busy) return;
    setInput("");
    setError(null);
    setBusy(true);
    setMessages((m) => [...m.map((x) => (x.role === "assistant" ? { ...x, fresh: false } : x)), { role: "user", text: q }]);
    try {
      if (!convo.current) {
        const res = await fetch("/api/v1/assistant/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error?.message ?? "Could not start a conversation.");
        convo.current = body.id;
      }
      const res = await fetch(`/api/v1/assistant/conversations/${convo.current}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "The console could not answer. Try again.");
      setMessages((m) => [...m, { role: "assistant", segments: body.segments, citations: body.citations, insufficient: body.insufficientEvidence, model: body.model, notice: body.notice, fresh: true }]);
      setEvidence(body.citations);
      setActiveCite(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const chips = [
    { label: "model", value: status.model ?? "none", ok: Boolean(status.model) },
    { label: "search", value: status.semantic ? "keyword + meaning" : "keyword", ok: true },
    { label: "indexed", value: `${status.passages.toLocaleString()} passages`, ok: status.passages > 0 },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="console-frame flex h-[min(70vh,680px)] min-h-[520px] flex-col" aria-label="AI console">
        <header className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-brand/20 px-4 py-2.5 font-mono text-xs">
          <span className="neon-text flex items-center gap-2 font-semibold text-brand"><Terminal className="size-4" />documind console</span>
          <span className="ml-auto flex flex-wrap gap-x-4 gap-y-1 text-dim">
            {chips.map((c) => (
              <span key={c.label}>{c.label} <span className={c.ok ? "text-brand" : "text-warn"}>{c.value}</span></span>
            ))}
          </span>
        </header>

        <div ref={scroller} className="flex-1 space-y-5 overflow-auto px-4 py-4" aria-live="polite">
          {messages.length === 0 && (
            <div className="max-w-xl space-y-4">
              <p className="font-mono text-sm text-brand/90">Ask anything about your documents. Every answer cites the passage it came from.</p>
              <div className="flex flex-col items-start gap-2">
                {STARTERS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded-lg border border-brand/25 bg-brand/5 px-3 py-2 text-left font-mono text-xs text-foreground/90 hover:border-brand/60 hover:bg-brand/10">
                    <span className="mr-2 text-brand">›</span>{s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) =>
            m.role === "user" ? (
              <p key={i} className="font-mono text-sm text-violet-300"><span className="mr-2 text-violet-400">›</span>{m.text}</p>
            ) : (
              <div key={i} className="border-l-2 border-brand/50 pl-4">
                <Answer msg={m} onCite={(id) => { setEvidence(m.citations); setActiveCite(id); }} />
              </div>
            ),
          )}
          {busy && <p className="flex items-center gap-2 font-mono text-xs text-brand"><Loader2 className="size-3.5 animate-spin" />searching your documents…</p>}
          {error && <p role="alert" className="font-mono text-xs text-danger">error: {error}</p>}
        </div>

        <form className="flex items-center gap-3 border-t border-brand/20 px-4 py-3" onSubmit={(e) => { e.preventDefault(); void send(input); }}>
          <span className="neon-text font-mono text-brand" aria-hidden>›</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question, or type /clear to start over"
            aria-label="Question"
            autoComplete="off"
            maxLength={2000}
            className="min-w-0 flex-1 bg-transparent font-mono text-sm text-foreground outline-none placeholder:text-dim"
          />
          {!input && !busy && <span className="caret" aria-hidden />}
          <button type="submit" disabled={busy || input.trim().length < 2} className="inline-flex items-center gap-1.5 rounded-md border border-brand/40 px-2.5 py-1 font-mono text-xs text-brand hover:bg-brand/10 disabled:opacity-40">
            Ask <CornerDownLeft className="size-3.5" />
          </button>
        </form>
      </section>

      <aside className="console-frame flex h-[min(70vh,680px)] min-h-[520px] flex-col" aria-label="Sources">
        <header className="flex items-center justify-between border-b border-brand/20 px-4 py-2.5 font-mono text-xs">
          <span className="font-semibold text-brand">sources</span>
          <span className="text-dim">{evidence.length} cited</span>
        </header>
        <div className="flex-1 space-y-3 overflow-auto p-4">
          {evidence.length === 0 ? (
            <p className="py-10 text-center font-mono text-xs leading-relaxed text-dim">Passages cited in an answer show up here, with the document and page.</p>
          ) : (
            evidence.map((c) => (
              <div key={c.id} className={cn("rounded-lg border border-line bg-panel-2/40 p-3 transition-colors", activeCite === c.id && "neon-edge border-brand/60 bg-brand/5")}>
                <div className="mb-1 flex items-center gap-2 text-xs">
                  <span className="grid size-5 place-items-center rounded bg-brand/20 font-mono font-semibold text-brand">{c.id}</span>
                  <Link href={`/documents/${c.documentId}`} className="truncate font-medium hover:text-brand">{c.documentTitle}</Link>
                </div>
                <p className="font-mono text-[11px] text-dim">v{c.versionNumber} · page {c.page}{c.section ? ` · ${c.section}` : ""}</p>
                <p className="mt-2 border-l-2 border-brand/50 pl-2 text-xs leading-relaxed text-foreground/90">{c.excerpt}</p>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
