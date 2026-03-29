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
            <h1 className="mt-2 page-title">See what matters, then decide what to fix.</h1>
            <p className="mt-3 page-subtitle">
              AgentGrade should tell you what needs attention now, what changed recently, and what is safe to ignore.
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
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="metric-card px-4 py-4">
            <p className="section-label">Quality</p>
            <p className={`mt-2 text-3xl font-semibold tracking-[-0.06em] ${scoreColor(avgScore)}`}>
              {percentage(avgScore)}
            </p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Average score in the current view</p>
          </div>
          <div className="metric-card px-4 py-4">
            <p className="section-label">Needs review now</p>
            <p className="mt-2 text-3xl font-semibold tracking-[-0.06em] text-[var(--text-primary)]">{reviewNow.length}</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Conversations below the healthy range</p>
          </div>
          <div className="metric-card px-4 py-4">
            <p className="section-label">Reviewed</p>
            <p className="mt-2 text-3xl font-semibold tracking-[-0.06em] text-[var(--text-primary)]">{reviewed}</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Conversations shaping the workspace trend</p>
          </div>
          <div className="metric-card px-4 py-4">
            <p className="section-label">Escalations</p>
            <p className="mt-2 text-3xl font-semibold tracking-[-0.06em] text-[var(--text-primary)]">{percentage(escalationRate)}</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Needed a human handoff</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)]">
        <GlassCard className="rounded-[1.4rem] p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="section-label">Needs review now</p>
              <h2 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">Top conversations to look at next</h2>
            </div>
            <Link href="/conversations" className="text-sm font-medium text-[var(--text-primary)]">
              View all
            </Link>
          </div>

          {reviewNow.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-soft)] p-5">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Nothing urgent is surfacing right now.</p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                The current queue looks calm. Use the issue list to spot repeated patterns rather than one-off firefighting.
              </p>
            </div>
          ) : (
            <div className="stack-list">
              {reviewNow.slice(0, 4).map((conversation) => (
                <Link key={conversation.id} href={`/conversations/${conversation.id}`} className="stack-row">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                        {conversation.customer_identifier || "Unknown conversation"}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                        {conversation.quality_scores?.summary || "This conversation needs a closer review before similar responses scale."}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="operator-chip capitalize">{conversation.platform}</span>
                        <span className="operator-chip">{formatDate(conversation.created_at)}</span>
                      </div>
                    </div>
                    {conversation.quality_scores ? (
                      <ScoreBadge score={conversation.quality_scores.overall_score} size="sm" />
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </GlassCard>

        <div className="space-y-4">
          <GlassCard className="rounded-[1.4rem] p-5">
            <div className="mb-3 flex items-center gap-2">
              {trendDelta < -0.02 ? (
                <TrendingDown className="h-4 w-4 text-score-critical" />
              ) : (
                <TrendingUp className="h-4 w-4 text-score-good" />
              )}
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Recently changed</h2>
            </div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              {trendDelta < -0.02
                ? "Quality has slipped recently."
                : trendDelta > 0.02
                  ? "Quality is moving in the right direction."
                  : "Quality is broadly steady."}
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              {trendDelta < -0.02
                ? "Use the review queue and issues page together to find what changed before this becomes a recurring problem."
                : trendDelta > 0.02
                  ? "The current changes look positive. Focus on making the strongest answer patterns repeatable."
                  : "No dramatic movement is showing up yet. Look for repeated issues rather than isolated conversations."}
            </p>
          </GlassCard>

          <GlassCard className="rounded-[1.4rem] p-5">
            <div className="mb-3 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-[var(--text-secondary)]" />
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Key issue</h2>
            </div>
            {criticalPattern ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{criticalPattern.title}</p>
                  <SeverityBadge severity={criticalPattern.severity} />
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{criticalPattern.description}</p>
                <Link href="/patterns" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                  Open issue
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-[var(--text-primary)]">Quiet issues</p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                  Nothing repeated strongly enough to count as a real operating issue right now.
                </p>
              </>
            )}
          </GlassCard>

          <GlassCard className="rounded-[1.4rem] p-5">
            <div className="mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[var(--text-secondary)]" />
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Safe to ignore</h2>
            </div>
            <p className="text-sm leading-6 text-[var(--text-secondary)]">
              Low-evidence reviews and failed scoring states are kept out of the workspace rollups, so this page only reflects conversations the platform considers usable.
            </p>
          </GlassCard>
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
