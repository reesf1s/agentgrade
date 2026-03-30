"use client";

import Link from "next/link";
import { ArrowRight, TrendingDown, TrendingUp, Minus, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SeverityBadge, ScoreBadge } from "@/components/ui/score-badge";
import type { ReportData } from "@/lib/dashboard-data";

function scoreAccent(score: number) {
  if (score >= 0.75) return "#10B981";
  if (score >= 0.55) return "#F59E0B";
  return "#EF4444";
}

export function ReportsPageClient({ report }: { report: ReportData }) {
  const summary = report.summary;
  const trendData = report.trend_data || [];
  const trendDelta = summary?.score_trend ?? 0;

  const trendTone =
    trendDelta > 0.02
      ? { label: "Improved this week", Icon: TrendingUp,   color: "#10B981" }
      : trendDelta < -0.02
      ? { label: "Slipped this week",  Icon: TrendingDown, color: "#EF4444" }
      : { label: "Steady this week",   Icon: Minus,        color: "rgba(255,255,255,0.40)" };

  const avgScore   = summary?.avg_overall_score ?? 0;
  const scored     = summary?.total_scored ?? 0;
  const risky      = summary?.hallucination_count ?? 0;
  const escalated  = summary?.escalation_count ?? 0;

  const metrics = [
    {
      label:      "Avg quality",
      value:      `${Math.round(avgScore * 100)}%`,
      sub:        avgScore >= 0.75 ? "Healthy" : avgScore >= 0.55 ? "Needs attention" : "Critical",
      valueColor: scoreAccent(avgScore),
      subColor:   scoreAccent(avgScore),
    },
    {
      label:      "Scored",
      value:      scored.toString(),
      sub:        "conversations",
      valueColor: "rgba(255,255,255,0.90)",
      subColor:   "rgba(255,255,255,0.30)",
    },
    {
      label:      "Risky replies",
      value:      risky.toString(),
      sub:        risky === 0 ? "None this week" : "need verification",
      valueColor: risky === 0 ? "#10B981" : "#F59E0B",
      subColor:   risky === 0 ? "#10B981" : "#F59E0B",
    },
    {
      label:      "Escalations",
      value:      escalated.toString(),
      sub:        escalated === 0 ? "None this week" : "escalated",
      valueColor: escalated === 0 ? "#10B981" : "#EF4444",
      subColor:   escalated === 0 ? "#10B981" : "#EF4444",
    },
  ];

  return (
    <div className="space-y-5 pb-8">

      {/* Page header */}
      <div className="page-header">
        <div>
          <p className="page-eyebrow mb-1">Weekly report</p>
          <h1 className="page-title">This week</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {report.week_start} → {report.week_end}
          </p>
        </div>
      </div>

      {/* Trend banner */}
      <div
        className="glass-static flex items-center gap-3 px-5 py-3"
      >
        <trendTone.Icon className="h-4 w-4 shrink-0" style={{ color: trendTone.color }} />
        <p className="text-sm font-medium" style={{ color: trendTone.color }}>{trendTone.label}</p>
        {trendDelta !== 0 && (
          <span className="ml-auto text-xs font-semibold tabular-nums font-mono" style={{ color: trendTone.color }}>
            {trendDelta > 0 ? "+" : ""}{Math.round(trendDelta * 100)}%
          </span>
        )}
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label} className="metric-card">
            <p className="metric-label">{m.label}</p>
            <p className="metric-value" style={{ color: m.valueColor }}>{m.value}</p>
            <p className="metric-sub" style={{ color: m.subColor }}>{m.sub}</p>
          </div>
        ))}
      </div>

      {/* Two-column: biggest risk + best opportunity */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Biggest risk */}
        <div className="glass-static p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-4 w-4 text-[#F59E0B]" />
            <p className="text-sm font-semibold text-[var(--text-primary)]">Biggest risk this week</p>
          </div>
          {report.patterns[0] ? (
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <SeverityBadge severity={report.patterns[0].severity} />
                <span className="text-sm font-semibold text-[var(--text-primary)]">{report.patterns[0].title}</span>
              </div>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{report.patterns[0].description}</p>
              {report.patterns[0].affected_conversation_ids?.length > 0 && (
                <p className="mt-3 text-xs text-[var(--text-muted)]">
                  {report.patterns[0].affected_conversation_ids.length} conversations affected
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#10B981]" />
              <p className="text-sm text-[var(--text-secondary)]">No critical risks detected this week.</p>
            </div>
          )}
        </div>

        {/* Best opportunity */}
        <div className="glass-static p-5">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="h-4 w-4 text-[var(--text-muted)]" />
            <p className="text-sm font-semibold text-[var(--text-primary)]">Best improvement opportunity</p>
          </div>
          {report.organization_recommendations[0] ? (
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
                {report.organization_recommendations[0].recommended_change}
              </p>
              {report.organization_recommendations[0].expected_impact && (
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  {report.organization_recommendations[0].expected_impact}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">No clear org-wide fix this week.</p>
          )}
        </div>
      </div>

      {/* Trend chart — minimal, white data line, no grid */}
      <div className="glass-static p-5">
        <div className="flex items-center justify-between gap-4 mb-4">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Quality trend</p>
          <div className="flex items-center gap-4 text-[10px] text-[var(--text-muted)]">
            <span className="flex items-center gap-1.5"><span className="inline-block h-1.5 w-3 rounded-sm bg-[rgba(255,255,255,0.50)]" />Overall</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-1.5 w-3 rounded-sm bg-[#10B981]" />Accuracy</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-1.5 w-3 rounded-sm bg-[#F59E0B]" />Hallucination</span>
          </div>
        </div>

        {trendData.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] py-8 text-center">No trend data yet.</p>
        ) : (
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradOverall" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(255,255,255,0.15)" stopOpacity={1} />
                    <stop offset="100%" stopColor="rgba(255,255,255,0)" stopOpacity={1} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "rgba(255,255,255,0.25)" }}
                  tickFormatter={(value) => value.slice(5)}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0.3, 1]}
                  tick={{ fontSize: 11, fill: "rgba(255,255,255,0.25)" }}
                  tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "#13131A",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "10px",
                    fontSize: 12,
                    boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                  }}
                  formatter={(value) => [`${Math.round(Number(value) * 100)}%`]}
                />
                <Area type="monotone" dataKey="overall" stroke="rgba(255,255,255,0.50)" strokeWidth={1.5} fill="url(#gradOverall)" dot={false} />
                <Area type="monotone" dataKey="accuracy" stroke="#10B981" strokeWidth={1} fill="transparent" dot={false} opacity={0.6} />
                <Area type="monotone" dataKey="hallucination" stroke="#F59E0B" strokeWidth={1} fill="transparent" dot={false} opacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Conversations to review */}
      {summary?.top_failures?.length ? (
        <div className="glass-static overflow-hidden">
          <div className="border-b border-[var(--divider)] px-5 py-3">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Conversations worth reviewing</p>
          </div>
          <div className="divide-y divide-[var(--divider)]">
            {summary.top_failures.map((item) => (
              <Link
                key={item.conversation_id}
                href={`/conversations/${item.conversation_id}`}
                className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-[var(--table-row-hover)] transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)] font-mono">{item.conversation_id.slice(0, 8)}</p>
                  {item.summary && (
                    <p className="mt-0.5 text-xs text-[var(--text-secondary)] line-clamp-2 leading-relaxed">{item.summary}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {item.score !== undefined && <ScoreBadge score={item.score} size="sm" />}
                  <ArrowRight className="h-4 w-4 text-[var(--text-muted)]" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

    </div>
  );
}
