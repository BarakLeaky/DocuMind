"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, UploadCloud, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type State = { kind: "idle" } | { kind: "busy"; step: string } | { kind: "done"; name: string } | { kind: "error"; message: string };

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message ?? `Request failed (${res.status})`);
  return body as T;
}

export function UploadButton({ disabled = false }: { disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "idle" });

  async function onFile(file: File) {
    try {
      setState({ kind: "busy", step: "Requesting upload…" });
      const intent = await json<{ key: string; uploadUrl: string }>(
        await fetch("/api/v1/documents/upload-intents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, size: file.size, mime: file.type }),
        }),
      );
      setState({ kind: "busy", step: "Uploading…" });
      await json(await fetch(intent.uploadUrl, { method: "PUT", body: file }));
      setState({ kind: "busy", step: "Processing…" });
      await json(
        await fetch("/api/v1/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: intent.key, title: file.name.replace(/\.[^.]+$/, "") }),
        }),
      );
      setState({ kind: "done", name: file.name });
      router.refresh();
      setTimeout(() => setState({ kind: "idle" }), 4000);
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "Upload failed" });
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-3">
      <input
        ref={input}
        type="file"
        accept=".pdf,.docx,.txt,.md"
        className="hidden"
        data-testid="upload-input"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
      <Button onClick={() => input.current?.click()} disabled={disabled || state.kind === "busy"}>
        {state.kind === "busy" ? <Loader2 className="animate-spin" /> : <UploadCloud />}
        {state.kind === "busy" ? state.step : "Upload document"}
      </Button>
      {state.kind === "done" && <span role="status" className="flex items-center gap-1 text-xs text-ok"><CheckCircle2 className="size-4" />{state.name} uploaded. Processing has started.</span>}
      {state.kind === "error" && <span role="alert" className="flex items-center gap-1 text-xs text-danger"><XCircle className="size-4" />{state.message}</span>}
    </div>
  );
}
