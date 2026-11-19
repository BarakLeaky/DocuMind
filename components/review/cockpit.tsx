"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, ArrowRight, BadgeCheck, Building2, Calendar, CalendarClock, Check, ChevronDown, CircleCheck, CircleDollarSign, Download, FileSearch,
  ChevronLeft, ChevronRight, FileText, Hash, Layers, ListChecks, Mail, Maximize2, MessageSquare, Minus, Pencil, Percent, Plus, RefreshCw, ScanSearch, Send, ShieldCheck, Sparkles, Upload, User, X,
} from "lucide-react";
import { approveDocumentAction, reextractAction, reviewFieldAction, saveReviewNoteAction, sendToReviewAction } from "@/app/actions";
import { Ring } from "@/components/review/ring";
import { Badge, StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Cockpit, TimelineEvent } from "@/lib/review-center";
import type { ExtractedField } from "@/lib/types";
import { cn, formatBytes } from "@/lib/utils";

const TABS = ["Extracted Data", "Source Document", "Audit Trail"] as const;
type Tab = (typeof TABS)[number];

function fieldIcon(label: string) {
  const l = label.toLowerCase();
  if (/due/.test(l)) return CalendarClock;
  if (/date|effective|term/.test(l)) return Calendar;
  if (/email/.test(l)) return Mail;
  if (/tax|vat/.test(l)) return Percent;
  if (/total|amount|price|fee|cost|subtotal/.test(l)) return CircleDollarSign;
  if (/number|no\.|id|reference/.test(l)) return Hash;
  if (/vendor|supplier|company|bill|party|parties|customer|client|organi/.test(l)) return Building2;
  if (/name|owner|author|signatory/.test(l)) return User;
  if (/item|line/.test(l)) return Layers;
  return FileText;
}

const tone = (c: number) => (c >= 0.9 ? "ok" : c >= 0.8 ? "warn" : "danger");

const EVENT_ICON: Record<TimelineEvent["kind"], { icon: typeof Upload; cls: string }> = {
  upload: { icon: Upload, cls: "text-brand" },
  extracted: { icon: ScanSearch, cls: "text-brand" },
  validation: { icon: ListChecks, cls: "text-brand" },
  anomaly: { icon: AlertTriangle, cls: "text-danger" },
  review: { icon: Send, cls: "text-brand" },
  approved: { icon: BadgeCheck, cls: "text-ok" },
  exported: { icon: Download, cls: "text-brand" },
  note: { icon: MessageSquare, cls: "text-dim" },
};

const dotCls = { passed: "bg-ok", warnings: "bg-warn", failed: "bg-danger" } as const;

function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="space-y-4" aria-label="Activity timeline">
      {events.map((e) => {
        const { icon: Icon, cls } = EVENT_ICON[e.kind];
        return (
          <li key={e.id} className="flex gap-3">
            <span className={cn("grid size-8 shrink-0 place-items-center rounded-full border border-line bg-panel-2", e.kind === "anomaly" && "border-danger/40 bg-danger/10")}><Icon className={cn("size-4", cls)} /></span>
            <div className="min-w-0">
              <p className={cn("text-sm font-medium", e.kind === "anomaly" && "text-danger")}>{e.title}{e.detail && e.kind !== "validation" && e.kind !== "anomaly" && <span className="ml-2 rounded border border-line px-1.5 py-0.5 text-[10px] font-normal text-dim">{e.detail}</span>}</p>
              {e.detail && (e.kind === "validation" || e.kind === "anomaly") && <p className="text-xs text-dim">{e.detail}</p>}
              <p className="text-xs text-dim"><time dateTime={e.at}>{new Date(e.at).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</time></p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function ReviewCockpit({ data, canReview, canExport }: { data: Cockpit; canReview: boolean; canExport: boolean }) {
  const { review } = data;
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Extracted Data");
  const [fields, setFields] = useState<ExtractedField[]>(review.fields);
  const [sort, setSort] = useState<"confidence" | "name" | "original">("confidence");
  const [note, setNote] = useState(data.note);
  const [active, setActive] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const isPdf = review.mime === "application/pdf";
  const [view, setView] = useState<"pdf" | "text">(isPdf ? "pdf" : "text");
  const [zoom, setZoom] = useState(100);
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, review.pages);
  const previewSrc = `/api/v1/documents/${review.documentId}/preview#page=${page}&zoom=${zoom}&toolbar=0&navpanes=0`;
  const passageRefs = useRef(new Map<string, HTMLElement>());
  const savedNote = useRef(data.note);

  // Server data changes after an action refresh; keep local rows in step with it.
  useEffect(() => setFields(review.fields), [review.fields]);

  const activeChunk = fields.find((f) => f.id === active)?.sourceChunkId ?? null;
  useEffect(() => { if (activeChunk) passageRefs.current.get(activeChunk)?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [activeChunk]);

  const sorted = useMemo(() => {
    const f = [...fields];
    if (sort === "confidence") f.sort((a, b) => b.confidence - a.confidence);
    if (sort === "name") f.sort((a, b) => a.label.localeCompare(b.label));
    return f;
  }, [fields, sort]);

  const verified = fields.filter((f) => f.status === "approved").length;
  const pct = data.confidence == null ? 0 : Math.round(data.confidence * 1000) / 10;
  const ringTone = data.confidenceLabel.tone === "ok" ? "brand" : data.confidenceLabel.tone === "warn" ? "warn" : "danger";
  const approved = data.decision === "approved";

  function run(fn: () => Promise<unknown>, success?: string) {
    setError(null); setOkMsg(null);
    startTransition(async () => {
      try { await fn(); if (success) setOkMsg(success); router.refresh(); }
      catch (e) { setError(e instanceof Error ? e.message : "Something went wrong. Try again."); }
    });
  }

  function reviewField(id: string, status: "approved" | "rejected") {
    const before = fields;
    setFields((fs) => fs.map((f) => (f.id === id ? { ...f, status } : f)));
    startTransition(async () => {
      try { await reviewFieldAction({ fieldId: id, status, documentId: review.documentId }); router.refresh(); }
      catch { setFields(before); setError("Could not save that change. Try again."); }
    });
  }

  const persistNote = async () => {
    if (note === savedNote.current) return;
    await saveReviewNoteAction({ documentId: review.documentId, note });
    savedNote.current = note;
  };

  function approve(format: "json" | "csv" | null) {
    setMenu(false);
    run(async () => {
      await persistNote();
      await approveDocumentAction({ documentId: review.documentId, note: note || undefined });
      if (format) window.location.assign(`/api/v1/documents/${review.documentId}/export?format=${format}`);
    }, format ? `Approved. Your ${format.toUpperCase()} export is downloading.` : "Approved.");
  }

  const reviewDisabled = !canReview || busy;

  return (
    <section aria-label="Document review" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
      <div role="tablist" aria-label="Review views" className="inline-flex rounded-xl border border-line bg-panel/80 p-1">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={cn("rounded-lg px-4 py-1.5 text-sm transition-colors", tab === t ? "bg-brand/15 text-brand ring-1 ring-brand/30" : "text-dim hover:text-foreground")}>{t}</button>
        ))}
      </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-panel/80 px-3 py-1.5 text-xs text-dim">
            <Sparkles className="size-3.5 text-brand" aria-hidden />AI model
            <span className="flex items-center gap-1.5 font-medium text-foreground"><span className="size-1.5 rounded-full bg-brand" />{data.modelId ?? "not run yet"}</span>
          </span>
          {canReview && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => run(async () => { await reextractAction({ documentId: review.documentId }); }, "AI extraction re-run. Review marks were reset.")}>
              <RefreshCw className={cn(busy && "animate-spin")} />Re-run AI
            </Button>
          )}
        </div>
      </div>

      {tab === "Extracted Data" && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.15fr)_minmax(0,0.85fr)]">
          {/* Source document */}
          <Card className="flex min-h-[520px] flex-col overflow-hidden">
            <CardHeader>
              <div className="min-w-0">
                <CardTitle className="truncate">{review.title}</CardTitle>
                <p className="mt-0.5 text-xs text-dim">{review.docType} · v{review.version} · {formatBytes(review.sizeBytes)}</p>
              </div>
              <div className="flex items-center gap-1">
                {isPdf && view === "pdf" && (
                  <>
                    <Button size="icon" variant="outline" className="size-8" aria-label="Zoom out" disabled={zoom <= 50} onClick={() => setZoom((z) => Math.max(50, z - 25))}><Minus /></Button>
                    <span className="w-11 text-center text-xs tabular-nums text-dim">{zoom}%</span>
                    <Button size="icon" variant="outline" className="size-8" aria-label="Zoom in" disabled={zoom >= 200} onClick={() => setZoom((z) => Math.min(200, z + 25))}><Plus /></Button>
                    <Button asChild size="icon" variant="outline" className="size-8" aria-label="Open full screen"><a href={`/api/v1/documents/${review.documentId}/preview`} target="_blank" rel="noreferrer"><Maximize2 /></a></Button>
                  </>
                )}
                {canExport && <Button asChild size="icon" variant="outline" className="size-8" aria-label="Download original"><a href={`/api/v1/documents/${review.documentId}/file`}><Download /></a></Button>}
              </div>
            </CardHeader>
            <CardContent className="relative flex-1 overflow-hidden bg-[#030909] p-0">
              {view === "pdf" && isPdf ? (
                <iframe key={previewSrc} title={`Preview of ${review.title}`} src={previewSrc} className="h-[560px] w-full border-0 bg-white" />
              ) : (
                <div className="max-h-[560px] space-y-2 overflow-auto p-4">
                  {review.passages.length === 0 ? (
                    <div className="grid h-60 place-items-center text-center text-sm text-dim"><div><FileSearch className="mx-auto mb-2 size-7" />No text was extracted from this document.</div></div>
                  ) : review.passages.map((p) => (
                    <article key={p.id} ref={(el) => { if (el) passageRefs.current.set(p.id, el); else passageRefs.current.delete(p.id); }}
                      className={cn("rounded-lg border border-transparent p-3 text-sm leading-relaxed text-foreground/90 transition-colors", activeChunk === p.id && "border-brand/70 bg-brand/10")}>
                      {p.section && <h4 className="mb-1 text-xs font-semibold text-brand">{p.section}</h4>}
                      <p className="whitespace-pre-wrap">{p.content}</p>
                    </article>
                  ))}
                </div>
              )}
            </CardContent>
            <div className="flex items-center justify-between border-t border-line px-3 py-2 text-xs text-dim">
              {isPdf ? (
                <div role="group" aria-label="Preview mode" className="inline-flex rounded-lg border border-line p-0.5">
                  {(["pdf", "text"] as const).map((v) => (
                    <button key={v} aria-pressed={view === v} onClick={() => setView(v)} className={cn("rounded-md px-2.5 py-1", view === v ? "bg-brand/15 text-brand" : "hover:text-foreground")}>{v === "pdf" ? "Document" : "Text"}</button>
                  ))}
                </div>
              ) : <span>Text view</span>}
              {isPdf && view === "pdf" && (
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="size-7" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeft /></Button>
                  <span className="tabular-nums">{page} / {totalPages}</span>
                  <Button size="icon" variant="ghost" className="size-7" aria-label="Next page" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}><ChevronRight /></Button>
                </div>
              )}
            </div>
          </Card>

          {/* Extracted data + anomalies */}
          <Card className="flex flex-col">
            <CardHeader>
              <div className="flex items-center gap-2"><CardTitle>Extracted Data</CardTitle><Badge tone="info">{fields.length} fields</Badge></div>
              <label className="flex items-center gap-1.5 text-xs text-dim">
                <span className="sr-only">Sort fields by</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="rounded-md border border-line bg-panel px-2 py-1 text-xs text-foreground">
                  <option value="confidence">Confidence</option><option value="name">Name</option><option value="original">Original</option>
                </select>
              </label>
            </CardHeader>
            <CardContent className="flex-1 space-y-2 overflow-auto">
              {fields.length === 0 ? (
                <p className="py-10 text-center text-sm text-dim">No fields were extracted for this document.</p>
              ) : (
                <ul className="space-y-2" aria-label="Extracted fields">
                  {sorted.map((f) => {
                    const Icon = fieldIcon(f.label);
                    const low = f.confidence < 0.9 && f.status === "pending";
                    return (
                      <li key={f.id} onMouseEnter={() => setActive(f.id)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(f.id)} onBlur={() => setActive(null)}
                        className={cn("flex items-center gap-3 rounded-lg border border-line bg-panel-2/40 px-3 py-2.5 transition-colors", active === f.id && "border-brand/60 bg-brand/5", low && "border-warn/40")}>
                        <Icon className="size-4 shrink-0 text-dim" aria-hidden />
                        <span className="w-28 shrink-0 truncate text-sm text-dim" title={f.label}>{f.label}</span>
                        <span className="min-w-0 flex-1 break-words text-sm font-medium">{f.value}</span>
                        <Badge tone={tone(f.confidence)}>{Math.round(f.confidence * 100)}%</Badge>
                        {f.status === "approved" ? (
                          <span className="grid size-7 place-items-center text-ok" title="Verified"><CircleCheck className="size-5" /><span className="sr-only">Verified</span></span>
                        ) : f.status === "rejected" ? (
                          <span className="grid size-7 place-items-center text-danger" title="Rejected"><X className="size-5" /><span className="sr-only">Rejected</span></span>
                        ) : canReview ? (
                          <span className="flex gap-1">
                            <Button size="icon" variant="outline" className="size-7" aria-label={`Approve ${f.label}`} onClick={() => reviewField(f.id, "approved")}><Check /></Button>
                            <Button size="icon" variant="outline" className="size-7" aria-label={`Reject ${f.label}`} onClick={() => reviewField(f.id, "rejected")}><X /></Button>
                          </span>
                        ) : <span className="size-7" />}
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="pt-3">
                <div className="mb-2 flex items-center gap-2">
                  <h4 className="text-sm font-semibold">Anomaly Detection</h4>
                  {data.anomalies.length > 0 ? <Badge tone="danger">{data.anomalies.length} {data.anomalies.length === 1 ? "flag" : "flags"}</Badge> : <Badge tone="ok">None</Badge>}
                </div>
                {data.anomalies.length === 0 ? (
                  <p className="rounded-lg border border-line bg-panel-2/40 px-3 py-3 text-xs text-dim">Nothing unusual. Amounts are compared with your recent {review.docType.toLowerCase()}s once at least three are on file.</p>
                ) : data.anomalies.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2.5">
                    <AlertTriangle className="size-5 shrink-0 text-danger" aria-hidden />
                    <div className="min-w-0 flex-1"><p className="text-sm font-medium text-danger">{a.field}</p><p className="text-xs text-dim">{a.message}</p></div>
                    <Button asChild size="sm" variant="outline"><Link href={`/documents/${review.documentId}`}>Review</Link></Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Validation + timeline */}
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Validation Checks</CardTitle></CardHeader>
              <CardContent>
                {data.summary.total === 0 ? <p className="text-sm text-dim">Checks run once fields are extracted.</p> : (
                  <>
                    <div className="flex items-center gap-4">
                      <Ring value={data.summary.passed / data.summary.total} tone={data.summary.failed > 0 ? "warn" : "brand"} label={`${data.summary.passed} of ${data.summary.total} checks passed`}>
                        <div><div className="text-base font-semibold leading-none">{data.summary.passed}/{data.summary.total}</div><div className="text-[10px] text-dim">Passed</div></div>
                      </Ring>
                      <dl className="flex-1 space-y-1.5 text-sm">
                        {([["passed", "Passed", data.summary.passed], ["warnings", "Warnings", data.summary.warnings], ["failed", "Failed", data.summary.failed]] as const).map(([k, l, n]) => (
                          <div key={k} className="flex items-center justify-between"><dt className="flex items-center gap-2 text-dim"><span className={cn("size-2 rounded-full", dotCls[k])} />{l}</dt><dd className="font-medium">{n}</dd></div>
                        ))}
                      </dl>
                    </div>
                    <ul className="mt-4 space-y-1.5">
                      {data.checks.filter((c) => c.status !== "passed").map((c) => (
                        <li key={c.id} className="flex items-start gap-2 text-xs"><span className={cn("mt-1 size-2 shrink-0 rounded-full", c.status === "failed" ? "bg-danger" : "bg-warn")} /><span><span className="font-medium">{c.label}.</span> <span className="text-dim">{c.detail}</span></span></li>
                      ))}
                    </ul>
                  </>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Activity Timeline</CardTitle><button className="text-xs text-brand hover:underline" onClick={() => setTab("Audit Trail")}>View all</button></CardHeader>
              <CardContent><Timeline events={data.timeline} /></CardContent>
            </Card>
          </div>
        </div>
      )}

      {tab === "Source Document" && (
        <Card><CardHeader><CardTitle>{review.title}</CardTitle><StatusBadge status={review.status} /></CardHeader>
          <CardContent className="max-h-[640px] space-y-3 overflow-auto bg-[#030909]">
            {review.passages.map((p) => (<article key={p.id} className="rounded-lg p-3 text-sm leading-relaxed">{p.section && <h4 className="mb-1 text-xs font-semibold text-brand">{p.section}</h4>}<p className="whitespace-pre-wrap">{p.content}</p></article>))}
            {review.passages.length === 0 && <p className="py-10 text-center text-sm text-dim">No text has been extracted from this document.</p>}
          </CardContent></Card>
      )}

      {tab === "Audit Trail" && (
        <Card><CardHeader><CardTitle>Audit Trail</CardTitle><Link href="/governance" className="inline-flex items-center gap-1 text-xs text-brand hover:underline">Workspace audit log <ArrowRight className="size-3.5" /></Link></CardHeader>
          <CardContent><Timeline events={data.timeline} /></CardContent></Card>
      )}

      {/* Decision bar */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
          <div className="flex items-center gap-4">
            <Ring value={(data.confidence ?? 0)} size={72} tone={ringTone} label={`Confidence ${pct}%`}><span className="text-sm font-semibold">{data.confidence == null ? "—" : `${pct}%`}</span></Ring>
            <div>
              <p className="text-xs text-dim">Confidence Score</p>
              <p className={cn("text-sm font-semibold", data.confidenceLabel.tone === "ok" ? "text-brand" : data.confidenceLabel.tone === "warn" ? "text-warn" : data.confidenceLabel.tone === "danger" ? "text-danger" : "text-dim")}>{data.confidenceLabel.label}</p>
              <p className="text-xs text-dim">{approved ? "Approved" : data.decision === "sent_to_review" ? "Waiting for review" : `${verified}/${fields.length} verified`}</p>
            </div>
          </div>

          <div className="min-w-[220px] flex-1 border-line lg:border-l lg:pl-6">
            <label htmlFor="review-note" className="mb-1 block text-xs font-medium">Review Notes</label>
            <div className="relative">
              <input id="review-note" value={note} maxLength={1000} disabled={!canReview} placeholder="Add an internal note (optional)" onChange={(e) => setNote(e.target.value)} onBlur={() => { void persistNote().catch(() => setError("Could not save the note.")); }}
                className="h-10 w-full rounded-lg border border-line bg-panel px-3 pr-9 text-sm placeholder:text-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60" />
              <Pencil className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-dim" aria-hidden />
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" className="h-10" disabled={reviewDisabled || approved} onClick={() => run(async () => { await persistNote(); await sendToReviewAction({ documentId: review.documentId, note: note || undefined }); }, "Sent to review.")}><Send />Send to Review</Button>
            <div className="relative flex">
              <Button className="h-10 rounded-r-none" disabled={reviewDisabled || approved} onClick={() => approve(canExport ? "json" : null)}><ShieldCheck />{approved ? "Approved" : canExport ? "Approve & Export" : "Approve"}</Button>
              <Button className="h-10 rounded-l-none border-l border-primary-foreground/20 px-2" aria-label="More approve options" aria-haspopup="menu" aria-expanded={menu} disabled={reviewDisabled || approved} onClick={() => setMenu((m) => !m)}><ChevronDown /></Button>
              {menu && (
                <div role="menu" className="absolute bottom-12 right-0 z-30 w-52 rounded-xl border border-line bg-panel p-1 shadow-2xl" onKeyDown={(e) => e.key === "Escape" && setMenu(false)}>
                  {canExport && <><button role="menuitem" className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-panel-2" onClick={() => approve("json")}>Approve & export JSON</button>
                  <button role="menuitem" className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-panel-2" onClick={() => approve("csv")}>Approve & export CSV</button></>}
                  <button role="menuitem" className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-panel-2" onClick={() => approve(null)}>Approve only</button>
                </div>
              )}
            </div>
            {approved && canExport && (
              <Button asChild variant="outline" size="icon" className="size-10" aria-label="Download CSV export"><a href={`/api/v1/documents/${review.documentId}/export?format=csv`}><Download /></a></Button>
            )}
          </div>
        </div>
        {(error || okMsg) && <p role={error ? "alert" : "status"} className={cn("mt-3 text-sm", error ? "text-danger" : "text-ok")}>{error ?? okMsg}</p>}
        {!canReview && <p className="mt-3 text-xs text-dim">Your role can view this review but not approve it.</p>}
      </Card>
    </section>
  );
}
