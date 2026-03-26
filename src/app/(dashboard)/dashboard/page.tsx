"use client";
import { useEffect, useState } from "react";
import { StatCard, GlassCard } from "@/components/ui/glass-card";
import { ScoreBadge, SeverityBadge } from "@/components/ui/score-badge";
import { scoreColor, formatDate } from "@/lib/utils";
import { AlertTriangle, Brain, MessageSquare } from "lucide-react";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { Alert } from "@/lib/db/types";

interface DashboardStats {
  avg_score: number;
  conversations_scored: number;
  hallucination_rate: number;
  escalation_rate: number;
}

interface ConversationRow {
  id: string;
  customer_identifier?: string;
  platform: string;
  was_escalated: boolean;
  created_at: string;
  quality_scores?: {
    overall_score: number;
    flags?: string[];
  } | null;
}

interface TrendPoint {
  date: string;
  overall: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((data) => {
        setStats(data.stats);
        setConversations(data.conversations || []);
        setAlerts(data.alerts || []);
        setTrendData(data.trend_data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-6xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Dashboard</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Loading...</p>
        </div>
      </div>
    );
  }

  const avgScore = stats?.avg_score ?? 0;
  const hallucinationRate = stats?.hallucination_rate ?? 0;
  const escalationRate = stats?.escalation_rate ?? 0;

  return (
    <div className="max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Dashboard</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Quality overview for the last 30 days</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Overall Quality"
          value={`${(avgScore * 100).toFixed(0)}%`}
          subtitle="Avg across all conversations"
          scoreColor={scoreColor(avgScore)}
        />
        <StatCard
          label="Conversations Scored"
          value={stats?.conversations_scored ?? 0}
          subtitle="Last 30 days"
        />
        <StatCard
          label="Hallucination Rate"
          value={`${(hallucinationRate * 100).toFixed(1)}%`}
          subtitle="Conversations with fabrications"
          scoreColor={hallucinationRate > 0.1 ? "score-critical" : hallucinationRate > 0.05 ? "score-warning" : "score-good"}
        />
        <StatCard
          label="Escalation Rate"
          value={`${(escalationRate * 100).toFixed(1)}%`}
          subtitle="Requested human agent"
          scoreColor={escalationRate > 0.15 ? "score-critical" : escalationRate > 0.08 ? "score-warning" : "score-good"}
        />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Trend Chart */}
        <div className="col-span-2">
          <GlassCard className="p-6">
            <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4">Quality Trend (30 days)</h2>
            {trendData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-sm text-[var(--text-muted)]">
                No data yet — ingest some conversations to see trends.
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid stroke="rgba(0,0,0,0.04)" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                      tickFormatter={(v) => v.slice(5)}
                      axisLine={{ stroke: "rgba(0,0,0,0.06)" }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0.3, 1]}
                      tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                      tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
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
                    <Line type="monotone" dataKey="overall" stroke="#111827" strokeWidth={2} dot={false} name="Overall" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </GlassCard>
        </div>

        {/* Alerts */}
        <div className="col-span-1 space-y-4">
          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-[var(--text-secondary)]" />
              <h2 className="text-sm font-medium text-[var(--text-primary)]">Active Alerts</h2>
            </div>
            {alerts.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">No active alerts.</p>
            ) : (
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <div key={alert.id} className="p-3 rounded-xl bg-[rgba(0,0,0,0.02)]">
                    <p className="text-sm font-medium text-[var(--text-primary)] mb-1">{alert.title}</p>
                    <p className="text-xs text-[var(--text-muted)]">{alert.description}</p>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="w-4 h-4 text-[var(--text-secondary)]" />
              <h2 className="text-sm font-medium text-[var(--text-primary)]">Top Prompt Fix</h2>
            </div>
            {conversations.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">Score some conversations to see recommendations.</p>
            ) : (
              <div className="p-3 rounded-xl bg-[rgba(0,0,0,0.02)]">
                <p className="text-sm text-[var(--text-primary)] mb-2">
                  Ingest conversations to generate prompt improvement recommendations.
                </p>
                <div className="mt-2">
                  <SeverityBadge severity="medium" />
                </div>
              </div>
            )}
          </GlassCard>
        </div>
      </div>

      {/* Recent Conversations */}
      <GlassCard className="p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[var(--text-secondary)]" />
            <h2 className="text-sm font-medium text-[var(--text-primary)]">Recent Conversations</h2>
          </div>
          <Link href="/conversations" className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
            View all →
          </Link>
        </div>
        {conversations.length === 0 ? (
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
              {conversations.slice(0, 10).map((conv) => (
                <tr key={conv.id}>
                  <td>
                    <Link href={`/conversations/${conv.id}`} className="text-[var(--text-primary)] hover:underline">
                      {conv.customer_identifier || "Unknown"}
                    </Link>
                  </td>
                  <td className="capitalize text-[var(--text-secondary)]">{conv.platform}</td>
                  <td>
                    {conv.quality_scores ? (
                      <ScoreBadge score={conv.quality_scores.overall_score} />
                    ) : (
                      <span className="text-xs text-[var(--text-muted)]">Scoring...</span>
                    )}
                  </td>
                  <td>
                    {conv.was_escalated ? (
                      <span className="text-xs score-critical font-medium">Yes</span>
                    ) : (
                      <span className="text-xs text-[var(--text-muted)]">No</span>
                    )}
                  </td>
                  <td>
                    <span className="text-xs text-[var(--text-secondary)]">
                      {conv.quality_scores?.flags && conv.quality_scores.flags.length > 0
                        ? conv.quality_scores.flags.slice(0, 2).join(", ")
                        : "None"}
                    </span>
                  </td>
                  <td className="text-[var(--text-muted)] text-xs">{formatDate(conv.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </GlassCard>
    </div>
  );
}
