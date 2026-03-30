"use client";

import Link from "next/link";
import { ArrowRight, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SeverityBadge } from "@/components/ui/score-badge";
import { scoreAccent, pct } from "@/lib/utils";
import type { DashboardData } from "@/lib/dashboard-data";

export function DashboardPageClient({ data }: { data: DashboardData }) {
  const avgScore        = data.stats.avg_score ?? 0;
  const reviewed        = data.stats.conversations_scored ?? 0;
  const hallucinationRate = data.stats.hallucination_rate ?? 0;
  const escalationRate  = data.stats.escalation_rate ?? 0;

  const lowScoreCount = data.conversations.filter(
    (c) => (c.quality_scores?.overall_score ?? 1) < 0.65
  ).length;
  const safeCount = data.conversations.filter(
    (c) => (c.quality_scores?.overall_score ?? 0) >= 0.8
  ).length;
  const criticalPattern    = data.patterns[0];

  const trendDelta =
    data.trend_data.length >= 2
      ? data.trend_data[data.trend_data.length - 1]!.overall - data.trend_data[0]!.overall
      : 0;

  const metrics = [
    {
      label: "Quality score",
      value: pct(avgScore),
      sub:   trendDelta > 0.02 ? "Improving" : trendDelta < -0.02 ? "Declining" : "Steady",
      color: scoreAccent(avgScore),
    },
    {
      label: "Scored",
      value: reviewed.toString(),
      sub:   "conversations",
      color: undefined,
    },
    {
      label: "Hallucination",
      value: pct(hallucinationRate),
      sub:   hallucinationRate > 0.1 ? "Above threshold" : "Within range",
      color: hallucinationRate > 0.1 ? "#EF4444" : hallucinationRate > 0.05 ? "#F59E0B" : "#10B981",
    },
    {
      label: "Escalation rate",
      value: pct(escalationRate),
      sub:   escalationRate > 0.12 ? "Above threshold" : "Within range",
      color: escalationRate > 0.12 ? "#EF4444" : escalationRate > 0.06 ? "#F59E0B" : "#10B981",
    },
  ];

  return (
    <div className="space-y-5 pb-8">

      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Overview</h1>
          <p className="mt-1 text-sm text-fg-secondary">Quality summary across all conversations</p>
        </div>
        <Link
          href="/reports"
          className="glass-button glass-button-primary inline-flex items-center gap-1.5 text-sm"
        >
          This week&apos;s report
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Hero score */}
      <div className="glass-static relative p-6 flex items-center gap-6">
        <div className="relative">
          <div
            className="score-ring"
            style={{
              '--ring-pct': `${Math.round(avgScore * 100)}%`,
              '--ring-color': scoreAccent(avgScore),
            } as React.CSSProperties}
          >
            <div className="score-ring-label">
              <span className="text-lg font-bold" style={{ color: scoreAccent(avgScore) }}>{pct(avgScore)}</span>
            </div>
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-fg">Overall quality</p>
          <p className="mt-1 text-sm text-fg-secondary">
            {trendDelta > 0.02 ? 'Improving this week' : trendDelta < -0.02 ? 'Declining this week' : 'Holding steady'}
          </p>
          <div className="mt-2 flex items-center gap-3">
            {trendDelta > 0.02 ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-score-good">
                <TrendingUp className="h-3 w-3" /> +{Math.round(trendDelta * 100)}%
              </span>
            ) : trendDelta < -0.02 ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-score-critical">
                <TrendingDown className="h-3 w-3" /> {Math.round(trendDelta * 100)}%
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-fg-muted">
                <Minus className="h-3 w-3" /> Steady
              </span>
            )}
            <span className="text-xs text-fg-muted">{reviewed} scored</span>
          </div>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label} className="metric-card">
            <p className="metric-label">{m.label}</p>
            <p className="metric-value" style={m.color ? { color: m.color } : undefined}>{m.value}</p>
            <p className="metric-sub">{m.sub}</p>
          </div>
        ))}
      </div>

      {/* Two-column: Top issue + Stats */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">

        {/* Needs attention */}
        <div className="glass-static relative p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-fg">
              Needs attention
              {lowScoreCount > 0 && (
                <span className="ml-2 rounded-full bg-red-soft px-2 py-0.5 text-xs font-semibold text-score-critical">{lowScoreCount}</span>
              )}
            </p>
            <Link href="/conversations" className="text-xs font-medium text-fg-muted hover:text-fg-secondary transition-colors">
              View all →
            </Link>
          </div>

          {lowScoreCount === 0 ? (
            <p className="py-6 text-center text-sm text-fg-muted">All conversations looking healthy.</p>
          ) : (
            <div className="divide-y divide-edge">
              {data.conversations
                .filter((c) => (c.quality_scores?.overall_score ?? 1) < 0.65)
                .slice(0, 4)
                .map((c) => (
                  <Link key={c.id} href={`/conversations/${c.id}`}>
                    <div className="flex items-center justify-between gap-4 py-3 hover:bg-surface-hover -mx-2 px-2 rounded-lg transition-colors">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-fg">
                          {c.customer_identifier || `Conversation #${c.id.slice(0, 6)}`}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-fg-secondary">
                          {c.quality_scores?.summary || "Needs review"}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-mono font-bold tabular-nums" style={{ color: scoreAccent(c.quality_scores?.overall_score ?? 0) }}>
                        {pct(c.quality_scores?.overall_score ?? 0)}
                      </span>
                    </div>
                  </Link>
                ))}
            </div>
          )}
        </div>

        {/* Sidebar cards */}
        <div className="space-y-3">
          <div className="glass-static relative p-4">
            <p className="mb-2 section-label">Top pattern</p>
            {criticalPattern ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-fg leading-snug">{criticalPattern.title}</p>
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={criticalPattern.severity} />
                  <span className="text-xs text-fg-muted">
                    {criticalPattern.affected_conversation_ids.length} affected
                  </span>
                </div>
                <Link href="/patterns" className="text-xs font-medium text-brand-light hover:text-brand transition-colors">
                  View details →
                </Link>
              </div>
            ) : (
              <p className="text-xs text-fg-muted">No patterns detected.</p>
            )}
          </div>

          <div className="glass-static relative p-4">
            <p className="mb-2 section-label">Healthy</p>
            <p className="text-sm text-fg-secondary">
              {safeCount > 0 ? `${safeCount} conversations scoring well.` : "No high-scoring conversations yet."}
            </p>
          </div>

          {criticalPattern?.recommendation && (
            <div className="glass-static relative p-4">
              <p className="mb-1 section-label">Suggested fix</p>
              <p className="text-sm text-fg-secondary leading-snug">{criticalPattern.recommendation}</p>
            </div>
          )}
        </div>
      </div>

      {/* Trend chart */}
      <div className="glass-static relative p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold text-fg">Quality trend</p>
            {trendDelta > 0.02 ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-score-good">
                <TrendingUp className="h-3 w-3" /> Improving
              </span>
            ) : trendDelta < -0.02 ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-score-critical">
                <TrendingDown className="h-3 w-3" /> Declining
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-fg-muted">
                <Minus className="h-3 w-3" /> Steady
              </span>
            )}
          </div>
          <span className="text-[11px] font-medium text-fg-muted border border-edge rounded-md px-2 py-0.5">30d</span>
        </div>

        {data.trend_data.length === 0 ? (
          <p className="py-8 text-center text-sm text-fg-muted">No trend data yet.</p>
        ) : (
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.trend_data} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "rgba(255,255,255,0.35)" }}
                  tickFormatter={(v) => v.slice(5)}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0.3, 1]}
                  tick={{ fontSize: 11, fill: "rgba(255,255,255,0.35)" }}
                  tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
                  axisLine={false}
                  tickLine={false}
                  width={38}
                />
                <Tooltip
                  contentStyle={{
                    background: "#111118",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "8px",
                    fontSize: 12,
                    boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                  }}
                  formatter={(v) => [`${Math.round(Number(v) * 100)}%`, "Quality"]}
                />
                <Line
                  type="monotone"
                  dataKey="overall"
                  stroke="#6366F1"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "#818CF8", stroke: "#6366F1", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-edge pt-3 text-xs text-fg-muted">
          <span>Escalations <strong className="text-fg-secondary">{pct(escalationRate)}</strong></span>
          <span>Hallucinations <strong className="text-fg-secondary">{pct(hallucinationRate)}</strong></span>
        </div>
      </div>
    </div>
  );
}
