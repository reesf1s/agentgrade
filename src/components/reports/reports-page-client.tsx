"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { GlassCard, StatCard } from "@/components/ui/glass-card";
import { ScoreBadge, SeverityBadge } from "@/components/ui/score-badge";
import { scoreColor } from "@/lib/utils";
import type { ReportData } from "@/lib/dashboard-data";

export function ReportsPageClient({ report }: { report: ReportData }) {
  const summary = report.summary;
  const trendData = report.trend_data || [];
  const trendDelta = summary?.score_trend ?? 0;
  const trendTone =
    trendDelta > 0.02
      ? {
          title: "Quality improved this week",
          description: `Average quality moved up by ${(trendDelta * 100).toFixed(1)} points compared with the prior week.`,
          icon: TrendingUp,
          tone: "text-score-good",
        }
      : trendDelta < -0.02
        ? {
            title: "Quality slipped this week",
            description: `Average quality fell by ${Math.abs(trendDelta * 100).toFixed(1)} points compared with the prior week.`,
            icon: TrendingDown,
            tone: "text-score-critical",
          }
        : {
            title: "Quality stayed steady",
            description: "No material movement versus the prior week.",
            icon: TrendingUp,
            tone: "text-[var(--text-secondary)]",
          };

  const TrendIcon = trendTone.icon;

  return (
    <div className="space-y-6 pb-10">
      <section className="glass-static rounded-[1.5rem] p-5 sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="page-eyebrow">Reports</p>
            <h1 className="mt-2 page-title">Weekly quality summary.</h1>
            <p className="mt-3 page-subtitle">
              {report.week_start} to {report.week_end}. Scan what changed, what matters, and what to do next.
            </p>
          </div>
          <button className="glass-button glass-button-primary">Export PDF</button>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Scored"
          value={summary?.total_scored ?? 0}
          subtitle={`${summary?.total_conversations ?? 0} total conversations`}
        />
        <StatCard
          label="Average quality"
          value={`${Math.round((summary?.avg_overall_score ?? 0) * 100)}%`}
          subtitle={`${summary?.score_trend > 0 ? "+" : ""}${(summary?.score_trend * 100).toFixed(1)} points vs prior week`}
          scoreColor={scoreColor(summary?.avg_overall_score ?? 0)}
        />
        <StatCard
          label="Risky replies"
          value={summary?.hallucination_count ?? 0}
          subtitle="Recent usable reviews with weak hallucination prevention"
          scoreColor={(summary?.hallucination_count ?? 0) > 5 ? "score-critical" : "score-warning"}
        />
        <StatCard
          label="Escalations"
          value={summary?.escalation_count ?? 0}
          subtitle="Needed a human handoff"
          scoreColor={(summary?.escalation_count ?? 0) > 10 ? "score-warning" : "score-good"}
        />
      </div>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)]">
        <GlassCard className="rounded-[1.4rem] p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="section-label">Trend</p>
              <h2 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">Weekly quality trend</h2>
            </div>
            {summary?.avg_overall_score !== undefined ? (
              <ScoreBadge score={summary.avg_overall_score} size="sm" />
            ) : null}
          </div>

          {trendData.length === 0 ? (
            <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-soft)] text-sm text-[var(--text-muted)]">
              No trend data yet.
            </div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid stroke="var(--divider)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                    tickFormatter={(value) => value.slice(5)}
                    axisLine={{ stroke: "var(--divider)" }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0.3, 1]}
                    tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                    tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
                    axisLine={{ stroke: "var(--divider)" }}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--panel)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "16px",
                      fontSize: 12,
                      boxShadow: "var(--glass-shadow)",
                    }}
                  />
                  <Line type="monotone" dataKey="overall" stroke="var(--text-primary)" strokeWidth={2.4} dot={false} />
                  <Line type="monotone" dataKey="accuracy" stroke="#10b981" strokeWidth={1.4} dot={false} opacity={0.45} />
                  <Line type="monotone" dataKey="hallucination" stroke="#f59e0b" strokeWidth={1.4} dot={false} opacity={0.45} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </GlassCard>

        <div className="space-y-4">
          <GlassCard className="rounded-[1.4rem] p-5">
            <div className="mb-3 flex items-center gap-2">
              <TrendIcon className={`h-4 w-4 ${trendTone.tone}`} />
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">This week</h2>
            </div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">{trendTone.title}</p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{trendTone.description}</p>
          </GlassCard>

          <GlassCard className="rounded-[1.4rem] p-5">
            <div className="mb-3 flex items-center gap-2">
              <Brain className="h-4 w-4 text-[var(--text-secondary)]" />
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Next moves</h2>
            </div>
            {report.organization_recommendations.length === 0 ? (
              <p className="text-sm leading-6 text-[var(--text-secondary)]">
                No org-wide change stands out this week.
              </p>
            ) : (
              <div className="stack-list">
                {report.organization_recommendations.slice(0, 3).map((recommendation) => (
                  <div key={recommendation.id} className="metric-card px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{recommendation.title}</p>
                      <SeverityBadge severity={recommendation.priority === "high" ? "high" : recommendation.priority === "medium" ? "medium" : "low"} />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{recommendation.recommended_change}</p>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <GlassCard className="rounded-[1.4rem] p-5">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-[var(--text-secondary)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Recurring issues</h2>
          </div>
          {report.patterns.length === 0 ? (
            <p className="text-sm leading-6 text-[var(--text-secondary)]">No repeated issue stands out this week.</p>
          ) : (
            <div className="stack-list">
              {report.patterns.map((pattern) => (
                <Link
                  key={pattern.id}
                  href={pattern.affected_conversation_ids[0] ? `/conversations/${pattern.affected_conversation_ids[0]}` : "/patterns"}
                  className="stack-row"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{pattern.title}</p>
                    <SeverityBadge severity={pattern.severity} />
                  </div>
                  <p className="text-sm leading-6 text-[var(--text-secondary)]">{pattern.description}</p>
                </Link>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard className="rounded-[1.4rem] p-5">
          <div className="mb-4 flex items-center gap-2">
            <Brain className="h-4 w-4 text-[var(--text-secondary)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Lowest-scoring conversations</h2>
          </div>
          {summary?.top_failures?.length ? (
            <div className="stack-list">
              {summary.top_failures.map((item) => (
                <Link key={item.conversation_id} href={`/conversations/${item.conversation_id}`} className="stack-row">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{item.conversation_id.slice(0, 8)}</p>
                      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{item.summary}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <ScoreBadge score={item.score} size="sm" />
                      <ArrowRight className="h-4 w-4 text-[var(--text-muted)]" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-6 text-[var(--text-secondary)]">No low-quality conversations in this window.</p>
          )}
        </GlassCard>
      </section>
    </div>
  );
}
