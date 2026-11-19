import { ArrowDownRight, ArrowUpRight, CheckCircle2, Files, Layers, Timer } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Stats } from "@/lib/types";
import { cn } from "@/lib/utils";

function Delta({ value }: { value: number }) {
  const Icon = value >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", value >= 0 ? "text-ok" : "text-danger")}>
      <Icon className="size-3.5" />
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

export function KpiCards({ stats }: { stats: Stats }) {
  const t = stats.medianTimeToSearchableSec;
  const items = [
    { label: "Documents", value: stats.totalDocuments.toLocaleString(), icon: Files, delta: null as number | null },
    { label: "Ready this week", value: stats.processedThisWeek.toLocaleString(), icon: CheckCircle2, delta: stats.processedDelta },
    { label: "Median time to searchable", value: t == null ? "—" : t < 60 ? `${t}s` : `${Math.floor(t / 60)}m ${t % 60}s`, icon: Timer, delta: null },
    { label: "Searchable passages", value: stats.searchablePassages.toLocaleString(), icon: Layers, delta: null },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map(({ label, value, icon: Icon, delta }) => (
        <Card key={label} className="p-4">
          <div className="flex items-center justify-between text-dim">
            <span className="text-xs uppercase tracking-wide">{label}</span>
            <Icon className="size-4 text-brand" />
          </div>
          <div className="mt-3 flex items-end justify-between">
            <span className="text-2xl font-semibold tracking-tight">{value}</span>
            {delta != null && <Delta value={delta} />}
          </div>
        </Card>
      ))}
    </div>
  );
}
