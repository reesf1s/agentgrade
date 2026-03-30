"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, ShieldAlert } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SeverityBadge } from "@/components/ui/score-badge";
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

  const topActions = [
    criticalPattern
      ? {
          title: criticalPattern.title,
          detail: `${criticalPattern.affected_conversation_ids.length} examples this week`,
          action: "Review issue",
          href: "/patterns",
        }
      : null,
    reviewNow[0]
      ? {
          title: reviewNow[0].customer_identifier || "Conversation needs review",
          detail: reviewNow[0].quality_scores?.summary || "Needs review",
          action: "Open",
          href: `/conversations/${reviewNow[0].id}`,
        }
      : null,
    recentConversation
      ? {
          title: "Review recent movement",
          detail: recentConversation.customer_identifier || formatDate(recentConversation.created_at),
          action: "Open report",
          href: "/reports",
        }
      : null,
  ].filter(Boolean) as Array<{ title: string; detail: string; action: string; href: string }>;

  const stats = [
    { label: "Quality", value: percentage(avgScore), color: scoreColor(avgScore) },
    { label: "Scored", value: reviewed.toString(), color: "text-[var(--text-primary)]" },
    {
      label: "Hallucination",
      value: percentage(riskyReplies),
      color: riskyReplies > 0.1 ? "score-critical" : riskyReplies > 0.05 ? "score-warning" : "text-[var(--text-primary)]",
    },
    {
      label: "Escalation",
      value: percentage(escalationRate),
      color: escalationRate > 0.12 ? "score-critical" : escalationRate > 0.06 ? "score-warning" : "text-[var(--text-primary)]",
    },
  ];

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <section className="glass-static rounded-[1.25rem] p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="page-eyebrow">Overview</p>
            <h1 className="mt-1.5 page-title">What needs attention.</h1>
          </div>
          <Link
            href="/conversations"
            className="glass-button glass-button-primary inline-flex shrink-0 items-center gap-1.5 self-start"
          >
            Review queue
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Stat cards */}
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="metric-card px-3.5 py-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--text-muted)]">
                {stat.label}
              </p>
              <p className={`mt-1 text-2xl font-semibold tracking-tight ${stat.color}`}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Action items */}
      <section className="space-y-5">
        <div>
          <div className="mb-2.5 flex items-center justify-between gap-4">
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              Needs action now
              {reviewNow.length > 0 && (
                <span className="ml-2 text-xs font-normal text-[var(--text-muted)]">
                  {reviewNow.length}
                </span>
              )}
            </p>
            <Link href="/conversations" className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              Resolve queue →
            </Link>
          </div>

          {topActions.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">Nothing urgent this week.</p>
          ) : (
            <div className="stack-list">
              {topActions.map((item) => (
                <Link key={`${item.title}-${item.href}`} href={item.href} className="stack-row group">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{item.title}</p>
                      <p className="mt-0.5 text-xs text-[var(--text-secondary)] line-clamp-1">{item.detail}</p>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">
                      {item.action} →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Secondary info row */}
        <div className="grid gap-4 border-t border-[var(--divider)] pt-4 sm:grid-cols-3">
          <div>
            <div className="mb-1.5 flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              <p className="text-xs font-semibold text-[var(--text-primary)]">Biggest issue</p>
            </div>
            {criticalPattern ? (
              <div className="space-y-1 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-[var(--text-primary)]">{criticalPattern.title}</span>
                  <SeverityBadge severity={criticalPattern.severity} />
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  {criticalPattern.affected_conversation_ids.length} conversations
                </p>
                <Link href="/patterns" className="text-xs font-medium text-[var(--text-primary)] underline-offset-4 hover:underline">
                  Review fix path →
                </Link>
              </div>
            ) : (
              <p className="text-xs text-[var(--text-secondary)]">None this week.</p>
            )}
          </div>

          <div>
            <div className="mb-1.5 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              <p className="text-xs font-semibold text-[var(--text-primary)]">Safe to ignore</p>
            </div>
            <p className="text-sm text-[var(--text-secondary)]">
              {safeCount ? `${safeCount} healthy.` : "Nothing notable."}
            </p>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold text-[var(--text-primary)]">Next move</p>
            <p className="text-sm text-[var(--text-secondary)]">
              {criticalPattern?.recommendation || "Review the top issue first."}
            </p>
          </div>
        </div>
      </section>

      {/* Trend chart */}
      <section className="space-y-3 border-t border-[var(--divider)] pt-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Quality trend</p>
          <span className="operator-chip">30 days</span>
        </div>

        {data.trend_data.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No trend yet.</p>
        ) : (
          <div className="h-52">
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
                    borderRadius: "12px",
                    fontSize: 12,
                    boxShadow: "var(--glass-shadow)",
                  }}
                  formatter={(value) => [`${Math.round(Number(value) * 100)}%`, "Quality"]}
                />
                <Line type="monotone" dataKey="overall" stroke="var(--text-primary)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[var(--text-secondary)]">
          <span className="font-medium text-[var(--text-primary)]">
            {trendDelta < -0.02 ? "Trending down" : trendDelta > 0.02 ? "Trending up" : "Steady"}
          </span>
          <span>Escalations {percentage(escalationRate)}</span>
          <span>Risky replies {percentage(riskyReplies)}</span>
          {recentConversation && (
            <span>
              Latest:{" "}
              {recentConversation.customer_identifier || formatDate(recentConversation.created_at)}
            </span>
          )}
        </div>
      </section>
    </div>
  );
}
