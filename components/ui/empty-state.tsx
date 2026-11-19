import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** An empty screen is an invitation to act: say what belongs here and offer the next step. */
export function EmptyState({
  icon: Icon, title, children, action, className,
}: { icon: LucideIcon; title: string; children?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-3 rounded-xl border border-dashed border-line px-6 py-12 text-center", className)}>
      <span className="grid size-11 place-items-center rounded-xl bg-brand/10 text-brand ring-1 ring-brand/30">
        <Icon className="size-5" />
      </span>
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {children && <p className="max-w-md text-sm leading-relaxed text-dim">{children}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
