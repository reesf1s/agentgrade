"use client";
import { useEffect, useState, useCallback } from "react";
import { StatCard, GlassCard } from "@/components/ui/glass-card";
import { ScoreBadge, SeverityBadge } from "@/components/ui/score-badge";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { scoreColor, formatDate } from "@/lib/utils";
import { AlertTriangle, Brain, MessageSquare, X, RefreshCw } from "lucide-react";
import Link from "next/link";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
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

interface TopPattern {
  id: string;
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  affected_conversation_ids: string[];
  prompt_fix?: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [patterns, setPatterns] = useState<TopPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissing, setDismissing] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    // Fetch dashboard data and patterns in parallel
    Promise.all([
      fetch("/api/dashboard").then((r) => r.json()),
      fetch("/api/patterns?limit=3").then((r) => r.json()).catch(() => ({ patterns: [] })),
    ])
      .then(([dash, pat]) => {
        setStats(dash.stats);
        setConversations(dash.conversations || []);
        setAlerts(dash.alerts || []);
        setTrendData(dash.trend_data || []);
        setPatterns((pat.patterns || []).slice(0, 3));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Dismiss an alert (acknowledge via API)
  async function dismissAlert(alertId: string) {
    setDismissing(alertId);
    try {
      await fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: alertId }),
      });
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch (err) {
      console.error("Failed to dismiss alert:", err);
    } finally {
      setDismissing(null);
    }
  }

  if (loading) return <DashboardSkeleton />;

  const avgScore = stats?.avg_score ?? 0;
  const hallucinationRate = stats?.hallucination_rate ?? 0;
  const escalationRate = stats?.escalation_rate ?? 0;

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Dashboard</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Quality overview for the last 30 days</p>
        </div>
        <button
          onClick={load}
          className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-all"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
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
        {/* Quality trend chart */}
        <div className="col-span-2">
          <GlassCard className="p-6">
            <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4">Quality Trend (30 days)</h2>
            {trendData.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center gap-3 text-sm text-[var(--text-muted)]">
                <MessageSquare className="w-8 h-8 opacity-30" />
                <p>No data yet — ingest some conversations to see trends.</p>
                <Link href="/settings" className="text-xs underline text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                  Connect your agent →
                </Link>
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                      tickFormatter={(v) => v.slice(5)}
                      axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0.3, 1]}
                      tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                      tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                      axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(10,10,15,0.9)",
                        backdropFilter: "blur(12px)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: "12px",
                        fontSize: 12,
                        color: "rgba(255,255,255,0.9)",
                      }}
                      formatter={(value) => [`${(Number(value) * 100).toFixed(0)}%`]}
                    />
                    <Line
                      type="monotone"
                      dataKey="overall"
                      stroke="rgba(255,255,255,0.7)"
                      strokeWidth={2}
                      dot={false}
                      name="Overall"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </GlassCard>
        </div>

        {/* Right column: alerts + top prompt fix */}
        <div className="space-y-4">
          {/* Active alerts */}
          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-[var(--text-secondary)]" />
              <h2 className="text-sm font-medium text-[var(--text-primary)]">Active Alerts</h2>
              {alerts.length > 0 && (
                <span className="ml-auto text-xs font-mono font-semibold score-critical">
                  {alerts.length}
                </span>
              )}
            </div>
            {alerts.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">No active alerts. All thresholds are met.</p>
            ) : (
              <div className="space-y-2">
                {alerts.slice(0, 4).map((alert) => (
                  <div
                    key={alert.id}
                    className="p-3 rounded-xl bg-[rgba(239,68,68,0.06)] border border-[rgba(239,68,68,0.1)] relative group"
                  >
                    <button
                      onClick={() => dismissAlert(alert.id)}
                      disabled={dismissing === alert.id}
                      className="absolute top-2 right-2 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <p className="text-xs font-medium text-[var(--text-primary)] mb-0.5 pr-6">
                      {alert.title}
                    </p>
                    {alert.description && (
                      <p className="text-xs text-[var(--text-muted)]">{alert.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          {/* Top failure pattern / prompt fix */}
          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="w-4 h-4 text-[var(--text-secondary)]" />
              <h2 className="text-sm font-medium text-[var(--text-primary)]">Top Prompt Fix</h2>
            </div>
            {patterns.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">
                Score some conversations to see prompt recommendations.
              </p>
            ) : (
              <div className="space-y-3">
                {patterns.slice(0, 1).map((p) => (
                  <div key={p.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <SeverityBadge severity={p.severity} />
                      <span className="text-xs text-[var(--text-muted)]">
                        {p.affected_conversation_ids.length} affected
                      </span>
                    </div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{p.title}</p>
                    {p.prompt_fix && (
                      <p className="text-xs font-mono text-[var(--text-secondary)] leading-relaxed p-2 rounded-lg bg-[rgba(255,255,255,0.03)] line-clamp-3">
                        {p.prompt_fix}
                      </p>
                    )}
                    <Link href="/patterns" className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                      View all patterns →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>
      </div>

      {/* Recent Conversations */}
      <GlassCard className="mt-6 overflow-hidden">
        <div className="flex items-center justify-between p-6 pb-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[var(--text-secondary)]" />
            <h2 className="text-sm font-medium text-[var(--text-primary)]">Recent Conversations</h2>
          </div>
          <Link
            href="/conversations"
            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            View all →
          </Link>
        </div>

        {conversations.length === 0 ? (
          <div className="px-6 pb-12 text-center">
            <MessageSquare className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-3 opacity-40" />
            <p className="text-sm text-[var(--text-muted)] mb-2">No conversations yet.</p>
            <Link href="/settings" className="text-xs text-[var(--text-secondary)] underline hover:text-[var(--text-primary)]">
              Connect your agent to start ingesting data
            </Link>
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
                    <Link
                      href={`/conversations/${conv.id}`}
                      className="text-[var(--text-primary)] hover:underline"
                    >
                      {conv.customer_identifier || "Unknown"}
                    </Link>
                  </td>
                  <td className="capitalize text-[var(--text-secondary)]">{conv.platform}</td>
                  <td>
                    {conv.quality_scores ? (
                      <ScoreBadge score={conv.quality_scores.overall_score} />
                    ) : (
                      <span className="text-xs text-[var(--text-muted)]">Scoring…</span>
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
                        : "—"}
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
