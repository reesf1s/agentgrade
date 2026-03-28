"use client";

import Link from "next/link";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, Brain, MessageSquare } from "lucide-react";
import { GlassCard, StatCard } from "@/components/ui/glass-card";
import { ScoreBadge, SeverityBadge } from "@/components/ui/score-badge";
import { formatDate, scoreColor } from "@/lib/utils";
import type { DashboardData } from "@/lib/dashboard-data";

export function DashboardPageClient({ data }: { data: DashboardData }) {
  const avgScore = data.stats.avg_score ?? 0;
  const hallucinationRate = data.stats.hallucination_rate ?? 0;
  const escalationRate = data.stats.escalation_rate ?? 0;
  const trustState =
    avgScore >= 0.8 ? "Stable" : avgScore >= 0.65 ? "Watching" : "Needs intervention";
  const priorityPattern = data.patterns[0];
  const priorityAlert = data.alerts[0];

  return (
    <div className="max-w-6xl pb-10">
      <div className="mb-8 rounded-[1.65rem] border border-[var(--border-subtle)] bg-[var(--panel)] p-6 shadow-sm">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="enterprise-kicker">Overview</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[var(--text-primary)]">
              Know whether your AI is actually helping
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
              See where quality is holding, where trust is slipping, and what to improve next without combing through every transcript.
            </p>
          </div>
          <div className="grid gap-3 md:min-w-[34rem] sm:grid-cols-3">
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">Quality state</p>
              <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{trustState}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">Reviewed recently</p>
              <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{data.stats.conversations_scored ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">System status</p>
              <p className="mt-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">Live</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Average quality"
          value={`${(avgScore * 100).toFixed(0)}%`}
          subtitle="Across recently scored conversations"
          scoreColor={scoreColor(avgScore)}
        />
        <StatCard
          label="Scored conversations"
          value={data.stats.conversations_scored ?? 0}
          subtitle="Rolling 30 day window"
        />
        <StatCard
          label="Grounding risk"
          value={`${(hallucinationRate * 100).toFixed(1)}%`}
          subtitle="Conversations that need evidence review"
          scoreColor={
            hallucinationRate > 0.1
              ? "score-critical"
              : hallucinationRate > 0.05
                ? "score-warning"
                : "score-good"
          }
        />
        <StatCard
          label="Escalation rate"
          value={`${(escalationRate * 100).toFixed(1)}%`}
          subtitle="Conversations that needed a human"
          scoreColor={
            escalationRate > 0.15
              ? "score-critical"
              : escalationRate > 0.08
                ? "score-warning"
                : "score-good"
          }
        />
      </div>

      <div className="mb-6 grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
        <GlassCard className="rounded-[1.25rem] p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="enterprise-kicker">Trend</p>
              <h2 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">
                Quality over the last 30 days
              </h2>
            </div>
            <div className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-3 py-1 text-xs text-[var(--text-secondary)]">
              Rolling workspace view
            </div>
          </div>
          {data.trend_data.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-[var(--text-muted)]">
              No data yet. Ingest some conversations to see trends.
            </div>
          ) : (
            <div className="h-64">
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
                    tickFormatter={(value: number) => `${(value * 100).toFixed(0)}%`}
                    axisLine={{ stroke: "var(--divider)" }}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--panel)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "14px",
                      fontSize: 12,
                      boxShadow: "var(--glass-shadow)",
                    }}
                    formatter={(value) => [`${(Number(value) * 100).toFixed(0)}%`]}
                  />
                  <Line type="monotone" dataKey="overall" stroke="var(--text-primary)" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </GlassCard>

        <div className="space-y-4">
          <GlassCard className="rounded-[1.25rem] p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="enterprise-section-title">Priority</p>
                <h2 className="mt-2 text-sm font-semibold text-[var(--text-primary)]">Next thing to review</h2>
              </div>
              <Link href={priorityPattern ? "/patterns" : "/conversations"} className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                Open →
              </Link>
            </div>
            {priorityPattern ? (
              <div className="rounded-[1rem] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{priorityPattern.title}</p>
                  <SeverityBadge severity={priorityPattern.severity} />
                </div>
                <p className="text-xs leading-5 text-[var(--text-secondary)]">{priorityPattern.description}</p>
              </div>
            ) : priorityAlert ? (
              <div className="rounded-[1rem] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-4">
                <p className="text-sm font-medium text-[var(--text-primary)]">{priorityAlert.title}</p>
                <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{priorityAlert.description}</p>
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)]">No urgent issue is standing out yet.</p>
            )}
          </GlassCard>

          <GlassCard className="rounded-[1.25rem] p-5">
            <div className="mb-4 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[var(--text-secondary)]" />
              <h2 className="text-sm font-medium text-[var(--text-primary)]">Alerts that need action</h2>
            </div>
            {data.alerts.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">No active alerts.</p>
            ) : (
              <div className="space-y-3">
                {data.alerts.map((alert) => (
                  <div key={alert.id} className="rounded-[0.95rem] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-3.5">
                    <p className="mb-1 text-sm font-medium text-[var(--text-primary)]">{alert.title}</p>
                    <p className="text-xs leading-5 text-[var(--text-muted)]">{alert.description}</p>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          <GlassCard className="rounded-[1.25rem] p-5">
            <div className="mb-4 flex items-center gap-2">
              <Brain className="h-4 w-4 text-[var(--text-secondary)]" />
              <h2 className="text-sm font-medium text-[var(--text-primary)]">Recurring issues</h2>
            </div>
            {data.patterns.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">Score conversations to surface repeated issues automatically.</p>
            ) : (
              <div className="space-y-3">
                {data.patterns.slice(0, 3).map((pattern) => (
                  <Link key={pattern.id} href="/patterns" className="block rounded-[0.95rem] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-3.5">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-medium text-[var(--text-primary)]">{pattern.title}</p>
                      <SeverityBadge severity={pattern.severity} />
                    </div>
                    <p className="text-xs leading-5 text-[var(--text-secondary)]">{pattern.description}</p>
                  </Link>
                ))}
              </div>
            )}
          </GlassCard>
        </div>
      </div>

      <GlassCard className="mt-6 rounded-[1.25rem] p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-[var(--text-secondary)]" />
            <h2 className="text-sm font-medium text-[var(--text-primary)]">Recent conversations</h2>
          </div>
          <Link href="/conversations" className="text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">
            View all →
          </Link>
        </div>
        {data.conversations.length === 0 ? (
          <div className="py-12 text-center text-sm text-[var(--text-muted)]">
            No conversations yet.{" "}
            <Link href="/settings" className="underline hover:text-[var(--text-primary)]">
              Connect your agent
            </Link>{" "}
            to start ingesting data.
          </div>
        ) : (
          <table className="glass-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Platform</th>
                <th>Score</th>
                <th>Escalated</th>
                <th>Issues</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {data.conversations.slice(0, 10).map((conversation) => (
                <tr key={conversation.id}>
                  <td>
                    <Link href={`/conversations/${conversation.id}`} className="text-[var(--text-primary)] hover:underline">
                      {conversation.customer_identifier || "Unknown"}
                    </Link>
                  </td>
                  <td className="capitalize text-[var(--text-secondary)]">{conversation.platform}</td>
                  <td>
                    {conversation.quality_scores ? (
                      <ScoreBadge score={conversation.quality_scores.overall_score} />
                    ) : (
                      <span className="text-xs text-[var(--text-muted)]">Scoring...</span>
                    )}
                  </td>
                  <td>
                    {conversation.was_escalated ? (
                      <span className="text-xs font-medium score-critical">Yes</span>
                    ) : (
                      <span className="text-xs text-[var(--text-muted)]">No</span>
                    )}
                  </td>
                  <td className="text-xs text-[var(--text-secondary)]">
                    {conversation.quality_scores?.flags && conversation.quality_scores.flags.length > 0
                      ? conversation.quality_scores.flags.slice(0, 2).join(", ")
                      : "None"}
                  </td>
                  <td className="text-xs text-[var(--text-secondary)]">{formatDate(conversation.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </GlassCard>
    </div>
  );
}
