"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NewDocButtons({ disabled = false }: { disabled?: boolean }) {
  const router = useRouter();
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"new" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function go(kind: "new" | "import", init: RequestInit, url: string) {
    setBusy(kind); setError(null);
    try {
      const res = await fetch(url, init);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error?.message ?? "Something went wrong");
      router.push(`/docs/${body.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <Button variant="outline" disabled={disabled || busy !== null} onClick={() => file.current?.click()}>
          {busy === "import" ? <Loader2 className="animate-spin" /> : <Upload />}Import .txt .md .docx
        </Button>
        <Button disabled={disabled || busy !== null} onClick={() => go("new", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }, "/api/v1/docs")}>
          {busy === "new" ? <Loader2 className="animate-spin" /> : <FilePlus2 />}New document
        </Button>
      </div>
      <input ref={file} type="file" accept=".txt,.md,.docx" hidden onChange={(e) => {
        const f = e.target.files?.[0]; e.target.value = "";
        if (!f) return;
        const form = new FormData(); form.append("file", f);
        void go("import", { method: "POST", body: form }, "/api/v1/docs/import");
      }} />
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}
