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
    <div className="max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Quality overview for the last 30 days</p>
      </div>

      <div className="mb-8 grid grid-cols-4 gap-4">
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

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <GlassCard className="p-6">
            <h2 className="mb-4 text-sm font-medium text-[var(--text-primary)]">Quality Trend (30 days)</h2>
            {data.trend_data.length === 0 ? (
              <div className="flex h-64 items-center justify-center text-sm text-[var(--text-muted)]">
                No data yet. Ingest some conversations to see trends.
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.trend_data}>
                    <CartesianGrid stroke="rgba(0,0,0,0.04)" strokeDasharray="3 3" />
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
                        background: "rgba(255,255,255,0.9)",
                        backdropFilter: "blur(12px)",
                        border: "1px solid rgba(0,0,0,0.06)",
                        borderRadius: "12px",
                        fontSize: 12,
                      }}
                      formatter={(value) => [`${(Number(value) * 100).toFixed(0)}%`]}
                    />
                    <Line type="monotone" dataKey="overall" stroke="#111827" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </GlassCard>
        </div>

        <div className="space-y-4">
          <GlassCard className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[var(--text-secondary)]" />
              <h2 className="text-sm font-medium text-[var(--text-primary)]">Active Alerts</h2>
            </div>
            {data.alerts.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">No active alerts.</p>
            ) : (
              <div className="space-y-3">
                {data.alerts.map((alert) => (
                  <div key={alert.id} className="rounded-xl bg-[rgba(0,0,0,0.02)] p-3">
                    <p className="mb-1 text-sm font-medium text-[var(--text-primary)]">{alert.title}</p>
                    <p className="text-xs text-[var(--text-muted)]">{alert.description}</p>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          <GlassCard className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <Brain className="h-4 w-4 text-[var(--text-secondary)]" />
              <h2 className="text-sm font-medium text-[var(--text-primary)]">Top Prompt Fix</h2>
            </div>
            {data.conversations.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">Score some conversations to see recommendations.</p>
            ) : (
              <div className="rounded-xl bg-[rgba(0,0,0,0.02)] p-3">
                <p className="mb-2 text-sm text-[var(--text-primary)]">
                  Ingest conversations to generate prompt improvement recommendations.
                </p>
                <SeverityBadge severity="medium" />
              </div>
            )}
          </GlassCard>
        </div>
      </div>

      <GlassCard className="mt-6 p-6">
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
