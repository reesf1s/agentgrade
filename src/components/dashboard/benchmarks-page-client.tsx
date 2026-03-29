"use client";

import Link from "next/link";
import { BarChart3, Lock } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { ScoreBadge } from "@/components/ui/score-badge";
import { formatScore, scoreColor } from "@/lib/utils";
import type { BenchmarkStats } from "@/lib/dashboard-data";

export function BenchmarksPageClient({ stats }: { stats: BenchmarkStats }) {
  const hasData = stats.total_scored > 0;
  const score = stats.avg_score ?? 0;

  return (
    <div className="space-y-6 pb-10">
      <GlassCard className="rounded-[1.35rem] p-6 md:p-7">
        <p className="enterprise-kicker">Benchmarks</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.06em] text-[var(--text-primary)]">
          Compare quality over time, then compare to the market.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
          Benchmarks start with your own scored conversations. Market comparisons will expand as segment coverage grows.
        </p>
      </GlassCard>

      {!hasData ? (
        <GlassCard className="rounded-[1.25rem] p-12 text-center">
          <BarChart3 className="mx-auto mb-4 h-10 w-10 text-[var(--text-muted)]" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">No benchmark data yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--text-secondary)]">
            Score at least 10 conversations to unlock your own baseline and start tracking benchmark readiness.
          </p>
          <Link href="/settings" className="glass-button glass-button-primary mt-6 inline-flex items-center gap-2">
            Connect a source
          </Link>
        </GlassCard>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
          <GlassCard className="rounded-[1.25rem] p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="enterprise-section-title">Your baseline</p>
                <h2 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">Last 30 days</h2>
              </div>
              <ScoreBadge score={score} size="sm" />
            </div>
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-[var(--text-primary)]">Overall quality</span>
                <span className={`text-sm font-mono font-semibold ${scoreColor(score)}`}>
                  {formatScore(score)}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-[var(--surface)]">
                <div
                  className={`h-full rounded-full ${
                    score >= 0.7 ? "bg-score-good" : score >= 0.4 ? "bg-score-warning" : "bg-score-critical"
                  }`}
                  style={{ width: `${score * 100}%` }}
                />
              </div>
              <p className="mt-3 text-sm text-[var(--text-secondary)]">
                Based on {stats.total_scored} scored conversations in this workspace.
              </p>
            </div>
          </GlassCard>

          <GlassCard className="rounded-[1.25rem] p-6">
            <Lock className="mb-3 h-8 w-8 text-[var(--text-muted)]" />
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Industry comparison coming next</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              Once enough opted-in workspaces exist in the same segment, this page will show how your quality compares by industry and company stage.
            </p>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
