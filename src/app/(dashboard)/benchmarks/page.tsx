"use client";
import { GlassCard } from "@/components/ui/glass-card";
import { scoreColor, formatScore } from "@/lib/utils";
import { BarChart3, Lock } from "lucide-react";

const benchmarkData = [
  { dimension: "Overall Quality", yourScore: 0.71, p25: 0.55, p50: 0.68, p75: 0.82, percentile: 58 },
  { dimension: "Accuracy", yourScore: 0.73, p25: 0.60, p50: 0.72, p75: 0.85, percentile: 52 },
  { dimension: "Hallucination", yourScore: 0.76, p25: 0.50, p50: 0.70, p75: 0.88, percentile: 62 },
  { dimension: "Resolution", yourScore: 0.68, p25: 0.52, p50: 0.65, p75: 0.80, percentile: 55 },
  { dimension: "Tone", yourScore: 0.85, p25: 0.65, p50: 0.78, p75: 0.90, percentile: 72 },
  { dimension: "Sentiment", yourScore: 0.59, p25: 0.45, p50: 0.62, p75: 0.78, percentile: 45 },
];

export default function BenchmarksPage() {
  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Benchmarks</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          How your agent compares to similar companies
        </p>
      </div>

      <GlassCard className="p-6 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 className="w-4 h-4 text-[var(--text-secondary)]" />
          <h2 className="text-sm font-medium text-[var(--text-primary)]">Industry Comparison</h2>
        </div>
        <p className="text-xs text-[var(--text-muted)] mb-6">
          Based on anonymised data from SaaS companies with 50-500 employees
        </p>

        <div className="space-y-6">
          {benchmarkData.map((b) => (
            <div key={b.dimension}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-[var(--text-primary)]">{b.dimension}</span>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-mono font-semibold ${scoreColor(b.yourScore)}`}>
                    {formatScore(b.yourScore)}%
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {b.percentile}th percentile
                  </span>
                </div>
              </div>
              {/* Benchmark bar */}
              <div className="relative h-3 rounded-full bg-[rgba(0,0,0,0.04)]">
                {/* P25-P75 range */}
                <div
                  className="absolute top-0 h-full rounded-full bg-[rgba(0,0,0,0.06)]"
                  style={{
                    left: `${b.p25 * 100}%`,
                    width: `${(b.p75 - b.p25) * 100}%`,
                  }}
                />
                {/* Median marker */}
                <div
                  className="absolute top-0 h-full w-0.5 bg-[rgba(0,0,0,0.15)]"
                  style={{ left: `${b.p50 * 100}%` }}
                />
                {/* Your score marker */}
                <div
                  className={`absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-white shadow-md ${
                    b.yourScore >= 0.7
                      ? "bg-score-good"
                      : b.yourScore >= 0.4
                      ? "bg-score-warning"
                      : "bg-score-critical"
                  }`}
                  style={{ left: `calc(${b.yourScore * 100}% - 7px)` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-[var(--text-muted)]">25th: {formatScore(b.p25)}%</span>
                <span className="text-[10px] text-[var(--text-muted)]">Median: {formatScore(b.p50)}%</span>
                <span className="text-[10px] text-[var(--text-muted)]">75th: {formatScore(b.p75)}%</span>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="p-8 text-center">
        <Lock className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-3" />
        <h3 className="text-sm font-medium text-[var(--text-primary)] mb-2">Industry-specific benchmarks</h3>
        <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
          Detailed industry benchmarks become available with 10+ customers in your industry segment.
          Currently showing aggregate SaaS benchmarks.
        </p>
      </GlassCard>
    </div>
  );
}
