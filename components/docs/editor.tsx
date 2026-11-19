"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { AlertTriangle, ArrowLeft, Bold, Check, Heading1, Heading2, Italic, List, ListOrdered, Loader2, Redo2, Underline as UnderlineIcon, Undo2 } from "lucide-react";
import { ShareDialog } from "@/components/docs/share-dialog";
import { Badge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import type { EditorDoc } from "@/lib/docs";
import { canEditDoc, canShareDoc } from "@/lib/docs-access";
import { cn } from "@/lib/utils";

type Save = "saved" | "dirty" | "saving" | "error" | "conflict";

function ToolbarButton({ label, active, disabled, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button type="button" variant="ghost" size="icon" aria-label={label} title={label} aria-pressed={active} disabled={disabled} onClick={onClick}
      className={cn("size-8", active && "bg-brand/15 text-brand ring-1 ring-brand/30")}>
      {children}
    </Button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"), italic: e.isActive("italic"), underline: e.isActive("underline"),
      h1: e.isActive("heading", { level: 1 }), h2: e.isActive("heading", { level: 2 }),
      bullet: e.isActive("bulletList"), ordered: e.isActive("orderedList"),
      canUndo: e.can().undo(), canRedo: e.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();
  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-0.5 border-b border-line bg-panel-2/40 px-2 py-1.5">
      <ToolbarButton label="Bold" active={s.bold} onClick={() => chain().toggleBold().run()}><Bold /></ToolbarButton>
      <ToolbarButton label="Italic" active={s.italic} onClick={() => chain().toggleItalic().run()}><Italic /></ToolbarButton>
      <ToolbarButton label="Underline" active={s.underline} onClick={() => chain().toggleUnderline().run()}><UnderlineIcon /></ToolbarButton>
      <span className="mx-1 h-5 w-px bg-line" />
      <ToolbarButton label="Heading 1" active={s.h1} onClick={() => chain().toggleHeading({ level: 1 }).run()}><Heading1 /></ToolbarButton>
      <ToolbarButton label="Heading 2" active={s.h2} onClick={() => chain().toggleHeading({ level: 2 }).run()}><Heading2 /></ToolbarButton>
      <span className="mx-1 h-5 w-px bg-line" />
      <ToolbarButton label="Bulleted list" active={s.bullet} onClick={() => chain().toggleBulletList().run()}><List /></ToolbarButton>
      <ToolbarButton label="Numbered list" active={s.ordered} onClick={() => chain().toggleOrderedList().run()}><ListOrdered /></ToolbarButton>
      <span className="mx-1 h-5 w-px bg-line" />
      <ToolbarButton label="Undo" disabled={!s.canUndo} onClick={() => chain().undo().run()}><Undo2 /></ToolbarButton>
      <ToolbarButton label="Redo" disabled={!s.canRedo} onClick={() => chain().redo().run()}><Redo2 /></ToolbarButton>
    </div>
  );
}

const STATUS_TEXT: Record<Save, string> = { saved: "Saved", dirty: "Unsaved changes", saving: "Saving…", error: "Couldn't save", conflict: "Out of date" };

export function DocEditor({ doc }: { doc: EditorDoc }) {
  const editable = canEditDoc(doc.role);
  const [title, setTitle] = useState(doc.title);
  const [save, setSave] = useState<Save>("saved");
  const [message, setMessage] = useState<string | null>(null);
  const revision = useRef(doc.revision);
  const pending = useRef<{ title?: string; contentHtml?: string }>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef(false);

  const flush = useCallback(async () => {
    if (inflight.current || Object.keys(pending.current).length === 0) return;
    const patch = pending.current;
    pending.current = {};
    inflight.current = true;
    setSave("saving");
    try {
      const res = await fetch(`/api/v1/docs/${doc.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...patch, baseRevision: revision.current }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 409) { setSave("conflict"); setMessage(body?.error?.message ?? "A newer version exists."); return; }
      if (!res.ok) throw new Error(body?.error?.message ?? "Save failed");
      revision.current = body.revision;
      setMessage(null);
      setSave(Object.keys(pending.current).length > 0 ? "dirty" : "saved");
    } catch (e) {
      pending.current = { ...patch, ...pending.current }; // keep the work so Save can retry
      setSave("error");
      setMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      inflight.current = false;
      if (Object.keys(pending.current).length > 0 && timer.current === null) timer.current = setTimeout(() => { timer.current = null; void flush(); }, 1200);
    }
  }, [doc.id]);

  const schedule = useCallback((patch: { title?: string; contentHtml?: string }) => {
    pending.current = { ...pending.current, ...patch };
    setSave((s) => (s === "conflict" ? s : "dirty"));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; void flush(); }, 1200);
  }, [flush]);

  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [1, 2] } })],
    content: doc.contentHtml,
    editable,
    immediatelyRender: false,
    editorProps: { attributes: { "aria-label": "Document body", class: "doc-prose min-h-[60vh] px-8 py-6 focus:outline-none" } },
    onUpdate: ({ editor: e }) => schedule({ contentHtml: e.getHTML() }),
  });

  const saveNow = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } void flush(); };

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (Object.keys(pending.current).length > 0) e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="icon" aria-label="Back to documents"><Link href="/docs"><ArrowLeft /></Link></Button>
        <input
          value={title} disabled={!editable} aria-label="Document title" maxLength={200}
          onChange={(e) => { setTitle(e.target.value); schedule({ title: e.target.value }); }}
          className="min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1 text-2xl font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-100"
        />
        <Badge tone={doc.role === "owner" ? "info" : doc.role === "editor" ? "ok" : "neutral"}>{doc.role === "owner" ? "Owner" : doc.role === "editor" ? "Can edit" : "View only"}</Badge>
        <span role="status" aria-live="polite" className={cn("flex items-center gap-1.5 text-xs", save === "error" || save === "conflict" ? "text-danger" : "text-dim")}>
          {save === "saving" && <Loader2 className="size-3.5 animate-spin" />}
          {save === "saved" && <Check className="size-3.5 text-ok" />}
          {STATUS_TEXT[save]}
        </span>
        {editable && <Button size="sm" variant="outline" onClick={saveNow} disabled={save === "saving" || save === "saved"}>Save</Button>}
        {canShareDoc(doc.role) && <ShareDialog docId={doc.id} initial={doc.shares} />}
      </div>

      {!editable && <p className="rounded-lg border border-line bg-panel-2/40 px-3 py-2 text-sm text-dim">{doc.ownerName} shared this with you as view only. You can read it but not change it.</p>}
      {message && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          <AlertTriangle className="size-4 shrink-0" />
          <span className="flex-1">{message}</span>
          {save === "conflict" && <Button size="sm" variant="outline" onClick={() => window.location.reload()}>Reload</Button>}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-line bg-panel/80">
        {editable && editor && <Toolbar editor={editor} />}
        {editor ? <EditorContent editor={editor} /> : <div className="grid h-60 place-items-center text-dim"><Loader2 className="size-5 animate-spin" /></div>}
      </div>
    </div>
  );
}
