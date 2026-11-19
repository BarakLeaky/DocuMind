"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-reads server data every few seconds while documents are still being processed, then stops. */
export function AutoRefresh({ active, everyMs = 5000 }: { active: boolean; everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, everyMs);
    return () => clearInterval(id);
  }, [active, everyMs, router]);
  return null;
}
