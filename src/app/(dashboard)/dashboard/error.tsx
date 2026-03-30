"use client";

import { useEffect } from "react";
import { GlassButton } from "@/components/ui/glass-button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard render error:", error);
  }, [error]);

  return (
    <div className="space-y-4 pb-10">
      <section className="glass-static rounded-[1.25rem] p-6">
        <p className="page-eyebrow">Dashboard</p>
        <h1 className="mt-2 page-title">Dashboard unavailable</h1>
        <p className="mt-3 text-sm text-[var(--text-secondary)]">Try again.</p>
        <GlassButton className="mt-4" onClick={reset}>
          Retry
        </GlassButton>
      </section>
    </div>
  );
}
