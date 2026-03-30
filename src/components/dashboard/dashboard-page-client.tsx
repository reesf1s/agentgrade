"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, ShieldAlert, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SeverityBadge } from "@/components/ui/score-badge";
import { formatDate, scoreColor } from "@/lib/utils";
import type { DashboardData } from "@/lib/dashboard-data";

function pct(v: number) { return `${Math.round(v * 100)}%`; }

export function DashboardPageClient({ data }: { data: DashboardData }) {
  const avgScore        = data.stats.avg_score ?? 0;
  const reviewed        = data.stats.conversations_scored ?? 0;
  const hallucinationRate = data.stats.hallucination_rate ?? 0;
  const escalationRate  = data.stats.escalation_rate ?? 0;

  const reviewNow = data.conversations.filter(
    (c) => (c.quality_scores?.overall_score ?? 1) < 0.65
  );
  const safeCount = data.conversations.filter(
    (c) => (c.quality_scores?.overall_score ?? 0) >= 0.8
  ).length;
  const criticalPattern    = data.patterns[0];
  const recentConversation = data.conversations[0];

  const trendDelta =
    data.trend_data.length >= 2
      ? data.trend_data[data.trend_data.length - 1]!.overall - data.trend_data[0]!.overall
      : 0;

  const topActions = [
    criticalPattern && {
      title:  criticalPattern.title,
      detail: `${criticalPattern.affected_conversation_ids.length} conversations affected`,
      cta:    "View issue",
      href:   "/patterns",
    },
    reviewNow[0] && {
      title:  reviewNow[0].customer_identifier || "Conversation needs review",
      detail: reviewNow[0].quality_scores?.summary || "Needs review",
      cta:    "Open",
      href:   `/conversations/${reviewNow[0].id}`,
    },
    recentConversation && {
      title:  "Review latest movement",
      detail: recentConversation.customer_identifier || formatDate(recentConversation.created_at),
      cta:    "Open report",
      href:   "/reports",
    },
  ].filter(Boolean) as Array<{ title: string; detail: string; cta: string; href: string }>;

  const metrics = [
    {
      label: "Quality score",
      value: pct(avgScore),
      sub:   trendDelta > 0.02 ? "↑ improving" : trendDelta < -0.02 ? "↓ declining" : "→ steady",
      color: scoreColor(avgScore),
    },
    {
      label: "Scored",
      value: reviewed.toString(),
      sub:   "conversations",
      color: "text-[var(--text-primary)]",
    },
    {
      label: "Hallucination",
      value: pct(hallucinationRate),
      sub:   hallucinationRate > 0.1 ? "Above threshold" : "Within range",
      color: hallucinationRate > 0.1 ? "text-score-critical" : hallucinationRate > 0.05 ? "text-score-warning" : "text-score-good",
    },
    {
      label: "Escalation rate",
      value: pct(escalationRate),
      sub:   escalationRate > 0.12 ? "Above threshold" : "Within range",
      color: escalationRate > 0.12 ? "text-score-critical" : escalationRate > 0.06 ? "text-score-warning" : "text-score-good",
    },
  ];

  return (
    <div className="space-y-5 pb-8">

      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Overview</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Quality summary for this week</p>
        </div>
        <Link
          href="/conversations"
          className="glass-button glass-button-primary inline-flex items-center gap-1.5 text-sm"
        >
          Review queue
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label} className="metric-card">
            <p className="metric-label">{m.label}</p>
            <p className={`metric-value ${m.color}`}>{m.value}</p>
            <p className="metric-sub">{m.sub}</p>
          </div>
        ))}
      </div>

      {/* Actions + pattern + safe */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">

        {/* Needs action */}
        <div className="glass-static p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              Needs action
              {reviewNow.length > 0 && (
                <span className="ml-2 rounded-md border border-[var(--border-subtle)] bg-[var(--surface)] px-1.5 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
                  {reviewNow.length}
                </span>
              )}
            </p>
            <Link href="/conversations" className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              View all →
            </Link>
          </div>

          {topActions.length === 0 ? (
            <p className="py-4 text-sm text-[var(--text-muted)]">Nothing urgent right now.</p>
          ) : (
            <div className="divide-y divide-[var(--divider)]">
              {topActions.map((item) => (
                <Link key={`${item.title}-${item.href}`} href={item.href}>
                  <div className="flex items-center justify-between gap-4 py-2.5 hover:bg-[var(--table-row-hover)] -mx-1 px-1 rounded transition-colors">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--text-primary)]">{item.title}</p>
                      <p className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">{item.detail}</p>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-[var(--btn-primary-bg)] hover:underline">
                      {item.cta} →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar: issue + safe + next move */}
        <div className="space-y-3">
          <div className="glass-static p-4">
            <div className="mb-2 flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              <p className="text-xs font-semibold text-[var(--text-primary)]">Top issue</p>
            </div>
            {criticalPattern ? (
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-[var(--text-primary)] leading-snug">{criticalPattern.title}</p>
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={criticalPattern.severity} />
                  <span className="text-xs text-[var(--text-muted)]">
                    {criticalPattern.affected_conversation_ids.length} convs
                  </span>
                </div>
                <Link href="/patterns" className="text-xs font-medium text-[var(--btn-primary-bg)] hover:underline">
                  Review fix →
                </Link>
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)]">No issues this week.</p>
            )}
          </div>

          <div className="glass-static p-4">
            <div className="mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              <p className="text-xs font-semibold text-[var(--text-primary)]">Healthy</p>
            </div>
            <p className="text-sm text-[var(--text-secondary)]">
              {safeCount > 0 ? `${safeCount} conversations look good.` : "Nothing scoring well yet."}
            </p>
          </div>

          {criticalPattern?.recommendation && (
            <div className="glass-static p-4">
              <p className="mb-1 text-xs font-semibold text-[var(--text-primary)]">Recommended next step</p>
              <p className="text-sm text-[var(--text-secondary)] leading-snug">{criticalPattern.recommendation}</p>
            </div>
          )}
        </div>
      </div>

      {/* Trend chart */}
      <div className="glass-static p-4">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Quality trend</p>
            {trendDelta > 0.02 ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium score-good">
                <TrendingUp className="h-3.5 w-3.5" /> Improving
              </span>
            ) : trendDelta < -0.02 ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium score-critical">
                <TrendingDown className="h-3.5 w-3.5" /> Declining
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--text-muted)]">
                <Minus className="h-3.5 w-3.5" /> Steady
              </span>
            )}
          </div>
          <span className="operator-chip">30 days</span>
        </div>

        {data.trend_data.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--text-muted)]">No trend data yet.</p>
        ) : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.trend_data} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                <CartesianGrid stroke="var(--divider)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                  tickFormatter={(v) => v.slice(5)}
                  axisLine={{ stroke: "var(--divider)" }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0.3, 1]}
                  tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                  tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
                  axisLine={false}
                  tickLine={false}
                  width={38}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--panel)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "6px",
                    fontSize: 12,
                    boxShadow: "var(--glass-shadow)",
                  }}
                  formatter={(v) => [`${Math.round(Number(v) * 100)}%`, "Quality"]}
                />
                <Line
                  type="monotone"
                  dataKey="overall"
                  stroke="var(--btn-primary-bg)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-[var(--divider)] pt-3 text-xs text-[var(--text-muted)]">
          <span>Escalations <strong className="text-[var(--text-secondary)]">{pct(escalationRate)}</strong></span>
          <span>Risky replies <strong className="text-[var(--text-secondary)]">{pct(hallucinationRate)}</strong></span>
          {recentConversation && (
            <span>
              Latest: <strong className="text-[var(--text-secondary)]">
                {recentConversation.customer_identifier || formatDate(recentConversation.created_at)}
              </strong>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
