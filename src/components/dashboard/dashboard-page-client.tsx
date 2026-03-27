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

  return (
    <div className="max-w-6xl pb-10">
      <div className="mb-10 flex items-end justify-between gap-6">
        <div>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
            Dashboard
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
            Monitor conversation quality, hallucinations, escalations, and recurring failures across your support agents.
          </p>
        </div>
        <div className="glass-static hidden min-w-[280px] rounded-[1.25rem] p-5 lg:block">
          <p className="text-xs font-medium text-[var(--text-muted)]">
            Monitoring status
          </p>
          <div className="mt-3 flex items-center gap-3">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <p className="text-sm text-[var(--text-primary)]">Connected agents are being monitored in real time</p>
          </div>
        </div>
      </div>

      <div className="mb-8 grid gap-4 xl:grid-cols-4 md:grid-cols-2">
        <StatCard
          label="Overall Quality"
          value={`${(avgScore * 100).toFixed(0)}%`}
          subtitle="Avg across all conversations"
          scoreColor={scoreColor(avgScore)}
        />
        <StatCard
          label="Conversations Scored"
          value={data.stats.conversations_scored ?? 0}
          subtitle="Last 30 days"
        />
        <StatCard
          label="Hallucination Rate"
          value={`${(hallucinationRate * 100).toFixed(1)}%`}
          subtitle="Conversations with fabrications"
          scoreColor={
            hallucinationRate > 0.1
              ? "score-critical"
              : hallucinationRate > 0.05
                ? "score-warning"
                : "score-good"
          }
        />
        <StatCard
          label="Escalation Rate"
          value={`${(escalationRate * 100).toFixed(1)}%`}
          subtitle="Requested human agent"
          scoreColor={
            escalationRate > 0.15
              ? "score-critical"
              : escalationRate > 0.08
                ? "score-warning"
                : "score-good"
          }
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
        <div>
          <GlassCard className="glass-highlight rounded-[1.25rem] p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--text-muted)]">
                  Trajectory
                </p>
                <h2 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">
                  Quality Trend
                </h2>
              </div>
              <div className="rounded-full border border-white/50 bg-white/45 px-3 py-1 text-xs text-[var(--text-secondary)]">
                30 day horizon
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
                    <CartesianGrid stroke="rgba(0,0,0,0.04)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                      tickFormatter={(value) => value.slice(5)}
                      axisLine={{ stroke: "rgba(0,0,0,0.06)" }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0.3, 1]}
                      tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                      tickFormatter={(value: number) => `${(value * 100).toFixed(0)}%`}
                      axisLine={{ stroke: "rgba(0,0,0,0.06)" }}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--panel)",
                        backdropFilter: "blur(10px)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "14px",
                        fontSize: 12,
                        boxShadow: "var(--glass-shadow)",
                      }}
                      formatter={(value) => [`${(Number(value) * 100).toFixed(0)}%`]}
                    />
                    <Line type="monotone" dataKey="overall" stroke="#0f172a" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </GlassCard>
        </div>

        <div className="space-y-4">
          <GlassCard className="glass-highlight rounded-[1.25rem] p-5">
            <div className="mb-4 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[var(--text-secondary)]" />
              <h2 className="text-sm font-medium text-[var(--text-primary)]">Active Alerts</h2>
            </div>
            {data.alerts.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">No active alerts.</p>
            ) : (
              <div className="space-y-3">
                {data.alerts.map((alert) => (
                  <div key={alert.id} className="rounded-[1rem] bg-[var(--surface)] p-3">
                    <p className="mb-1 text-sm font-medium text-[var(--text-primary)]">{alert.title}</p>
                    <p className="text-xs text-[var(--text-muted)]">{alert.description}</p>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          <GlassCard className="glass-highlight rounded-[1.25rem] p-5">
            <div className="mb-4 flex items-center gap-2">
              <Brain className="h-4 w-4 text-[var(--text-secondary)]" />
              <h2 className="text-sm font-medium text-[var(--text-primary)]">Top Failure Patterns</h2>
            </div>
            {data.patterns.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">Score conversations to detect recurring quality failures.</p>
            ) : (
              <div className="space-y-3">
                {data.patterns.slice(0, 3).map((pattern) => (
                  <Link key={pattern.id} href="/patterns" className="block rounded-[1rem] bg-[var(--surface)] p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-medium text-[var(--text-primary)]">{pattern.title}</p>
                      <SeverityBadge severity={pattern.severity} />
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]">{pattern.description}</p>
                  </Link>
                ))}
              </div>
            )}
          </GlassCard>
        </div>
      </div>

      <GlassCard className="glass-highlight mt-6 rounded-[1.25rem] p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-[var(--text-secondary)]" />
            <h2 className="text-sm font-medium text-[var(--text-primary)]">Recent Conversations</h2>
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
