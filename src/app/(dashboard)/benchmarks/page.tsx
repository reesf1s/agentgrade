"use client";
import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { scoreColor, formatScore } from "@/lib/utils";
import { BarChart3, Lock } from "lucide-react";
import Link from "next/link";

interface TrendStats {
  avg_score: number | null;
  total_scored: number;
}

const DIMENSIONS = [
  { key: "overall", label: "Overall Quality" },
  { key: "accuracy", label: "Accuracy" },
  { key: "hallucination", label: "Hallucination" },
  { key: "resolution", label: "Resolution" },
  { key: "tone", label: "Tone" },
  { key: "sentiment", label: "Sentiment" },
];

export default function BenchmarksPage() {
  const [stats, setStats] = useState<TrendStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reports/trends?days=30")
      .then((r) => r.json())
      .then((d) => setStats(d.stats || null))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const hasData = stats && stats.total_scored > 0;

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Benchmarks</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          How your agent compares to similar companies
        </p>
      </div>

      {loading ? (
        <GlassCard className="p-12 text-center">
          <p className="text-sm text-[var(--text-muted)]">Loading...</p>
        </GlassCard>
      ) : !hasData ? (
        <GlassCard className="p-12 text-center">
          <BarChart3 className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-4" />
          <h3 className="text-sm font-medium text-[var(--text-primary)] mb-2">No data to benchmark yet</h3>
          <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto mb-4">
            Score at least 10 conversations to see how your agent compares against industry benchmarks.
          </p>
          <Link
            href="/settings"
            className="text-sm text-[var(--text-primary)] underline hover:no-underline"
          >
            Connect your agent to get started →
          </Link>
        </GlassCard>
      ) : (
        <>
          <GlassCard className="p-6 mb-6">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-4 h-4 text-[var(--text-secondary)]" />
              <h2 className="text-sm font-medium text-[var(--text-primary)]">Your Scores (Last 30 Days)</h2>
            </div>
            <p className="text-xs text-[var(--text-muted)] mb-6">
              Based on {stats.total_scored} scored conversations
            </p>
            <div className="space-y-5">
              {DIMENSIONS.map(({ key, label }) => {
                const score = key === "overall" ? (stats.avg_score ?? 0) : null;
                if (score === null) return null;
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-[var(--text-primary)]">{label}</span>
                      <span className={`text-sm font-mono font-semibold ${scoreColor(score)}`}>
                        {formatScore(score)}%
                      </span>
                    </div>
                    <div className="relative h-3 rounded-full bg-[rgba(0,0,0,0.04)]">
                      <div
                        className={`h-full rounded-full transition-all ${
                          score >= 0.7 ? "bg-score-good" : score >= 0.4 ? "bg-score-warning" : "bg-score-critical"
                        }`}
                        style={{ width: `${score * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>

          <GlassCard className="p-8 text-center">
            <Lock className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-3" />
            <h3 className="text-sm font-medium text-[var(--text-primary)] mb-2">Industry comparison coming soon</h3>
            <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
              Industry benchmark comparisons become available once enough customers in your segment have joined.
              Currently showing your own quality scores.
            </p>
          </GlassCard>
        </>
      )}
    </div>
  );
}
