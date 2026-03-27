"use client";

import Link from "next/link";
import { BarChart3, Lock } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { formatScore, scoreColor } from "@/lib/utils";
import type { BenchmarkStats } from "@/lib/dashboard-data";

export function BenchmarksPageClient({ stats }: { stats: BenchmarkStats }) {
  const hasData = stats.total_scored > 0;
  const score = stats.avg_score ?? 0;

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Benchmarks</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          How your agent compares to similar companies
        </p>
      </div>

      {!hasData ? (
        <GlassCard className="p-12 text-center">
          <BarChart3 className="mx-auto mb-4 h-10 w-10 text-[var(--text-muted)]" />
          <h3 className="mb-2 text-sm font-medium text-[var(--text-primary)]">No data to benchmark yet</h3>
          <p className="mx-auto mb-4 max-w-sm text-xs text-[var(--text-muted)]">
            Score at least 10 conversations to see how your agent compares against industry benchmarks.
          </p>
          <Link href="/settings" className="text-sm text-[var(--text-primary)] underline hover:no-underline">
            Connect your agent to get started →
          </Link>
        </GlassCard>
      ) : (
        <>
          <GlassCard className="mb-6 p-6">
            <div className="mb-1 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[var(--text-secondary)]" />
              <h2 className="text-sm font-medium text-[var(--text-primary)]">Your Scores (Last 30 Days)</h2>
            </div>
            <p className="mb-6 text-xs text-[var(--text-muted)]">
              Based on {stats.total_scored} scored conversations
            </p>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-[var(--text-primary)]">Overall Quality</span>
                <span className={`text-sm font-mono font-semibold ${scoreColor(score)}`}>
                  {formatScore(score)}%
                </span>
              </div>
              <div className="relative h-3 rounded-full bg-[rgba(0,0,0,0.04)]">
                <div
                  className={`h-full rounded-full ${
                    score >= 0.7 ? "bg-score-good" : score >= 0.4 ? "bg-score-warning" : "bg-score-critical"
                  }`}
                  style={{ width: `${score * 100}%` }}
                />
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-8 text-center">
            <Lock className="mx-auto mb-3 h-8 w-8 text-[var(--text-muted)]" />
            <h3 className="mb-2 text-sm font-medium text-[var(--text-primary)]">Industry comparison coming soon</h3>
            <p className="mx-auto max-w-md text-xs text-[var(--text-muted)]">
              Industry benchmark comparisons become available once enough customers in your segment have joined.
              Currently showing your own quality scores.
            </p>
          </GlassCard>
        </>
      )}
    </div>
  );
}
