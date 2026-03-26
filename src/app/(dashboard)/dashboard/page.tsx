"use client";
import { StatCard, GlassCard } from "@/components/ui/glass-card";
import { ScoreBadge, SeverityBadge } from "@/components/ui/score-badge";
import { scoreColor, formatDate } from "@/lib/utils";
import { SEED_CONVERSATIONS, SEED_ALERTS, generateTrendData } from "@/lib/db/seed-data";
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

const trendData = generateTrendData(30);
const avgScore = SEED_CONVERSATIONS.reduce((s, c) => s + c.quality_score.overall_score, 0) / SEED_CONVERSATIONS.length;
const hallucinationRate = SEED_CONVERSATIONS.filter(c => c.quality_score.hallucination_score !== undefined && c.quality_score.hallucination_score < 0.5).length / SEED_CONVERSATIONS.length;
const escalationRate = SEED_CONVERSATIONS.filter(c => c.was_escalated).length / SEED_CONVERSATIONS.length;

export default function DashboardPage() {
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
          value={SEED_CONVERSATIONS.length}
          subtitle="This week"
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
                  <Line type="monotone" dataKey="accuracy" stroke="#10B981" strokeWidth={1.5} dot={false} name="Accuracy" opacity={0.6} />
                  <Line type="monotone" dataKey="hallucination" stroke="#EF4444" strokeWidth={1.5} dot={false} name="Hallucination" opacity={0.6} />
                  <Line type="monotone" dataKey="resolution" stroke="#F59E0B" strokeWidth={1.5} dot={false} name="Resolution" opacity={0.6} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </div>

        {/* Alerts */}
        <div className="col-span-1 space-y-4">
          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-[var(--text-secondary)]" />
              <h2 className="text-sm font-medium text-[var(--text-primary)]">Active Alerts</h2>
            </div>
            <div className="space-y-3">
              {SEED_ALERTS.map((alert) => (
                <div key={alert.id} className="p-3 rounded-xl bg-[rgba(0,0,0,0.02)]">
                  <p className="text-sm font-medium text-[var(--text-primary)] mb-1">{alert.title}</p>
                  <p className="text-xs text-[var(--text-muted)]">{alert.description}</p>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="w-4 h-4 text-[var(--text-secondary)]" />
              <h2 className="text-sm font-medium text-[var(--text-primary)]">Top Prompt Fix</h2>
            </div>
            <div className="p-3 rounded-xl bg-[rgba(0,0,0,0.02)]">
              <p className="text-sm text-[var(--text-primary)] mb-2">
                Agent fabricating non-existent integrations
              </p>
              <p className="text-xs text-[var(--text-muted)] italic leading-relaxed">
                &quot;Add an explicit integration list to system prompt: Our integrations are: Slack, Google Workspace, Jira, GitHub, Zapier.&quot;
              </p>
              <div className="mt-2">
                <SeverityBadge severity="critical" />
              </div>
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Recent Flagged Conversations */}
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
            {SEED_CONVERSATIONS.map((conv) => (
              <tr key={conv.id}>
                <td>
                  <Link href={`/conversations/${conv.id}`} className="text-[var(--text-primary)] hover:underline">
                    {conv.customer_identifier}
                  </Link>
                </td>
                <td className="capitalize text-[var(--text-secondary)]">{conv.platform}</td>
                <td><ScoreBadge score={conv.quality_score.overall_score} /></td>
                <td>
                  {conv.was_escalated ? (
                    <span className="text-xs score-critical font-medium">Yes</span>
                  ) : (
                    <span className="text-xs text-[var(--text-muted)]">No</span>
                  )}
                </td>
                <td>
                  <span className="text-xs text-[var(--text-secondary)]">
                    {conv.quality_score.flags.length > 0
                      ? conv.quality_score.flags.slice(0, 2).join(", ")
                      : "None"}
                  </span>
                </td>
                <td className="text-[var(--text-muted)] text-xs">{formatDate(conv.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
}
