import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STATUS_META, type ProcessingState } from "@/lib/constants";

const BAR: Record<string, string> = { ok: "bg-ok", warn: "bg-warn", danger: "bg-danger", info: "bg-brand", neutral: "bg-dim" };

export function PipelineCard({ items }: { items: { state: ProcessingState; count: number }[] }) {
  const sum = items.reduce((s, i) => s + i.count, 0);
  const total = sum || 1;
  const ready = items.find((i) => i.state === "ready")?.count ?? 0;
  const pct = Math.round((ready / total) * 100);
  const r = 44;
  const c = 2 * Math.PI * r;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Processing pipeline</CardTitle>
        <span className="text-xs text-dim">{sum.toLocaleString()} documents</span>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {sum === 0 ? (
          <p className="py-10 text-center text-sm text-dim">Documents appear here as they move from upload to searchable.</p>
        ) : (
        <div className="flex items-center gap-5">
          <div className="relative size-28 shrink-0">
            <svg viewBox="0 0 100 100" className="size-full -rotate-90" role="img" aria-label={`${pct}% of documents ready`}>
              <circle cx="50" cy="50" r={r} fill="none" stroke="#15302e" strokeWidth="8" />
              <circle
                cx="50" cy="50" r={r} fill="none" stroke="#2dd4bf" strokeWidth="8" strokeLinecap="round"
                strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
                style={{ filter: "drop-shadow(0 0 6px rgba(45,212,191,.6))" }}
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center text-center">
              <div>
                <div className="text-xl font-semibold">{pct}%</div>
                <div className="text-[10px] uppercase tracking-wide text-dim">searchable</div>
              </div>
            </div>
          </div>
          <ul className="flex-1 space-y-2.5">
            {items.map(({ state, count }) => (
              <li key={state}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-dim">{STATUS_META[state].label}</span>
                  <span className="tabular-nums">{count.toLocaleString()}</span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-line">
                  <div className={`h-full rounded-full ${BAR[STATUS_META[state].tone]}`} style={{ width: `${Math.max(2, (count / total) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
        )}
      </CardContent>
    </Card>
  );
}
