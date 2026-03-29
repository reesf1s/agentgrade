"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ShieldAlert,
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
import { GlassCard } from "@/components/ui/glass-card";
import { ScoreBadge, SeverityBadge } from "@/components/ui/score-badge";
import { formatDate, scoreColor } from "@/lib/utils";
import type { DashboardData } from "@/lib/dashboard-data";

function percentage(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function DashboardPageClient({ data }: { data: DashboardData }) {
  const avgScore = data.stats.avg_score ?? 0;
  const reviewed = data.stats.conversations_scored ?? 0;
  const riskyReplies = data.stats.hallucination_rate ?? 0;
  const escalationRate = data.stats.escalation_rate ?? 0;
  const reviewNow = data.conversations.filter(
    (conversation) => (conversation.quality_scores?.overall_score ?? 1) < 0.65
  );
  const safeCount = data.conversations.filter(
    (conversation) => (conversation.quality_scores?.overall_score ?? 0) >= 0.8
  ).length;
  const criticalPattern = data.patterns[0];
  const recentConversation = data.conversations[0];
  const trendDelta =
    data.trend_data.length >= 2
      ? data.trend_data[data.trend_data.length - 1]!.overall - data.trend_data[0]!.overall
      : 0;

  return (
    <div className="space-y-6 pb-10">
      <section className="glass-static rounded-[1.5rem] p-5 sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="page-eyebrow">Overview</p>
            <h1 className="mt-2 page-title">Run this week’s quality review.</h1>
            <p className="mt-3 page-subtitle">
              See what needs attention, what changed this week, and what the team can safely leave alone.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/conversations" className="glass-button glass-button-primary inline-flex items-center gap-2">
              Open review queue
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/patterns" className="glass-button inline-flex items-center gap-2">
              Open issues
            </Link>
            <Link href="/reports" className="glass-button inline-flex items-center gap-2">
              Check reports
            </Link>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="font-medium text-[var(--text-primary)]">Needs attention: {reviewNow.length}</span>
          <span className={`font-medium ${scoreColor(avgScore)}`}>Quality: {percentage(avgScore)}</span>
          <span className="text-[var(--text-primary)]">Quiet: {safeCount}</span>
          <span className="text-[var(--text-primary)]">Reviewed: {reviewed}</span>
        </div>
      </section>

      <section className="space-y-6">
        <div>
          <div className="mb-3 flex items-center justify-between gap-4">
            <p className="text-sm font-medium text-[var(--text-primary)]">Needs attention this week</p>
            <Link href="/conversations" className="text-sm font-medium text-[var(--text-primary)]">
              Resolve queue
            </Link>
          </div>

          {reviewNow.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">Nothing urgent this week.</p>
          ) : (
            <div className="stack-list">
              {reviewNow.slice(0, 4).map((conversation) => (
                <Link key={conversation.id} href={`/conversations/${conversation.id}`} className="stack-row">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                        {conversation.customer_identifier || "Unknown conversation"}
                      </p>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">
                        {conversation.quality_scores?.summary || "Needs review"}
                      </p>
                    </div>
                    {conversation.quality_scores ? <ScoreBadge score={conversation.quality_scores.overall_score} size="sm" /> : null}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="border-b border-[var(--divider)] pb-3">
            <div className="mb-2 flex items-center gap-2">
              {trendDelta < -0.02 ? (
                <TrendingDown className="h-4 w-4 text-score-critical" />
              ) : (
                <TrendingUp className="h-4 w-4 text-score-good" />
              )}
              <p className="text-sm font-medium text-[var(--text-primary)]">Changed this week</p>
            </div>
            <p className="text-sm text-[var(--text-primary)]">
              {trendDelta < -0.02 ? "Quality: down" : trendDelta > 0.02 ? "Quality: up" : "Quality: steady"}
            </p>
          </div>

          <div className="border-b border-[var(--divider)] pb-3">
            <div className="mb-2 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-[var(--text-secondary)]" />
              <p className="text-sm font-medium text-[var(--text-primary)]">Repeated issue this week</p>
            </div>
            {criticalPattern ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-[var(--text-primary)]">{criticalPattern.title}</span>
                <SeverityBadge severity={criticalPattern.severity} />
                <span className="text-[var(--text-secondary)]">
                  {criticalPattern.recommendation || "Open issue"}
                </span>
              </div>
            ) : (
              <p className="text-sm text-[var(--text-secondary)]">No major issue.</p>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[var(--text-secondary)]" />
              <p className="text-sm font-medium text-[var(--text-primary)]">Quiet this week</p>
            </div>
            <p className="text-sm text-[var(--text-secondary)]">Low-evidence and failed scores stay out of rollups.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)]">
        <GlassCard className="rounded-[1.4rem] p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="section-label">Trend</p>
              <h2 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">Quality trend</h2>
            </div>
            <span className="operator-chip">Last 30 days</span>
          </div>

          {data.trend_data.length === 0 ? (
            <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-soft)] text-sm text-[var(--text-muted)]">
              Ingest conversations to start seeing quality movement.
            </div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.trend_data}>
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
                    formatter={(value) => [`${Math.round(Number(value) * 100)}%`, "Quality"]}
                  />
                  <Line type="monotone" dataKey="overall" stroke="var(--text-primary)" strokeWidth={2.4} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </GlassCard>

        <GlassCard className="rounded-[1.4rem] p-5">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-[var(--text-secondary)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Workspace health</h2>
          </div>
          <div className="grid gap-3">
            <div className="metric-card px-4 py-4">
              <p className="section-label">Escalations</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">{percentage(escalationRate)}</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Needed a human handoff</p>
            </div>
            <div className="metric-card px-4 py-4">
              <p className="section-label">Risky replies</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">{percentage(riskyReplies)}</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Recent usable reviews with weak hallucination prevention</p>
            </div>
            <div className="metric-card px-4 py-4">
              <p className="section-label">Most recent review</p>
              {recentConversation ? (
                <>
                  <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
                    {recentConversation.customer_identifier || "Unknown conversation"}
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">{formatDate(recentConversation.created_at)}</p>
                  <Link href={`/conversations/${recentConversation.id}`} className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                    Open review
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </>
              ) : (
                <p className="mt-2 text-sm text-[var(--text-secondary)]">No recent review available.</p>
              )}
            </div>
          </div>
        </GlassCard>
      </section>
    </div>
  );
}
