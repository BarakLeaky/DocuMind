import { cn } from "@/lib/utils";

/** Circular progress. `value` is 0..1. */
export function Ring({ value, size = 72, stroke = 6, tone = "brand", children, label }: { value: number; size?: number; stroke?: number; tone?: "brand" | "warn" | "danger"; children?: React.ReactNode; label: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, Math.max(0, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-line" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          className={cn("transition-[stroke-dashoffset] duration-700", tone === "brand" ? "stroke-brand" : tone === "warn" ? "stroke-warn" : "stroke-danger")}
          style={{ filter: "drop-shadow(0 0 4px rgba(45,212,191,0.55))" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
