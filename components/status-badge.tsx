import { STATUS_META, type ProcessingState, type Tone } from "@/lib/constants";
import { cn } from "@/lib/utils";

const tones: Record<Tone, string> = {
  ok: "bg-ok/10 text-ok border-ok/30",
  warn: "bg-warn/10 text-warn border-warn/30",
  danger: "bg-danger/10 text-danger border-danger/30",
  info: "bg-brand/10 text-brand border-brand/30",
  neutral: "bg-panel-2 text-dim border-line",
};

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium", tones[tone], className)}>{children}</span>;
}

export function StatusBadge({ status }: { status: ProcessingState }) {
  const meta = STATUS_META[status];
  const active = meta.tone === "info";
  return (
    <Badge tone={meta.tone}>
      <span className={cn("size-1.5 rounded-full bg-current", active && "animate-pulse")} />
      {meta.label}
    </Badge>
  );
}
