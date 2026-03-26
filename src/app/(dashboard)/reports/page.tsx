"use client";
import { useEffect, useState } from "react";
import { GlassCard, StatCard } from "@/components/ui/glass-card";
import { ScoreBadge, SeverityBadge } from "@/components/ui/score-badge";
import { scoreColor } from "@/lib/utils";
import { Brain, BookOpen, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { WeeklyReportSummary, PromptImprovement, KnowledgeGap } from "@/lib/db/types";

interface ReportData {
  week_start: string;
  week_end: string;
  summary: WeeklyReportSummary;
  trend_data: Array<{ date: string; overall: number; accuracy?: number; hallucination?: number }>;
}

export default function ReportsPage() {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reports")
      .then((r) => r.json())
      .then(setReport)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-6xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Weekly Report</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Loading...</p>
        </div>
      </div>
    );
  }

  const summary = report?.summary;
  const trendData = report?.trend_data || [];

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Weekly Report</h1>
          {report && (
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Week of {report.week_start} – {report.week_end}
            </p>
          )}
        </div>
        <button className="glass-button text-sm">Export PDF</button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Conversations Scored"
          value={summary?.total_scored ?? 0}
          subtitle={`${summary?.total_conversations ?? 0} total`}
        />
        <StatCard
          label="Avg Quality"
          value={`${((summary?.avg_overall_score ?? 0) * 100).toFixed(0)}%`}
          subtitle={
            summary && summary.score_trend !== undefined
              ? summary.score_trend > 0
                ? `+${(summary.score_trend * 100).toFixed(1)}% from last week`
                : `${(summary.score_trend * 100).toFixed(1)}% from last week`
              : "vs last week"
          }
          scoreColor={scoreColor(summary?.avg_overall_score ?? 0)}
        />
        <StatCard
          label="Hallucinations"
          value={summary?.hallucination_count ?? 0}
          subtitle="Conversations with fabrications"
          scoreColor={(summary?.hallucination_count ?? 0) > 5 ? "score-critical" : "score-warning"}
        />
        <StatCard
          label="Escalations"
          value={summary?.escalation_count ?? 0}
          subtitle="Requested human agent"
          scoreColor={(summary?.escalation_count ?? 0) > 10 ? "score-warning" : "score-good"}
        />
      </div>

      {/* Trend Chart */}
      <GlassCard className="p-6 mb-6">
        <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4">Quality Trend</h2>
        {trendData.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-sm text-[var(--text-muted)]">
            No trend data yet.
          </div>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid stroke="rgba(0,0,0,0.04)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickFormatter={(v) => v.slice(5)} axisLine={{ stroke: "rgba(0,0,0,0.06)" }} tickLine={false} />
                <YAxis domain={[0.3, 1]} tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} axisLine={{ stroke: "rgba(0,0,0,0.06)" }} tickLine={false} />
                <Tooltip contentStyle={{ background: "rgba(255,255,255,0.9)", backdropFilter: "blur(12px)", border: "1px solid rgba(0,0,0,0.06)", borderRadius: "12px", fontSize: 12 }} formatter={(value) => [`${(Number(value) * 100).toFixed(0)}%`]} />
                <Line type="monotone" dataKey="overall" stroke="#111827" strokeWidth={2} dot={false} name="Overall" />
                <Line type="monotone" dataKey="accuracy" stroke="#10B981" strokeWidth={1.5} dot={false} name="Accuracy" opacity={0.5} />
                <Line type="monotone" dataKey="hallucination" stroke="#EF4444" strokeWidth={1.5} dot={false} name="Hallucination" opacity={0.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </GlassCard>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Top Prompt Improvements */}
        <GlassCard className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-4 h-4 text-[var(--text-secondary)]" />
            <h2 className="text-sm font-medium text-[var(--text-primary)]">Top Prompt Improvements</h2>
          </div>
          {!summary?.prompt_improvements?.length ? (
            <p className="text-sm text-[var(--text-muted)]">None detected this week.</p>
          ) : (
            <div className="space-y-3">
              {summary.prompt_improvements.map((imp: PromptImprovement, i: number) => (
                <div key={i} className="p-3 rounded-xl bg-[rgba(0,0,0,0.02)]">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{imp.issue}</p>
                    <SeverityBadge severity={imp.priority === "high" ? "high" : "medium"} />
                  </div>
                  <p className="text-xs text-[var(--text-muted)] italic">{imp.recommended_prompt_change}</p>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        {/* Knowledge Gaps */}
        <GlassCard className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-4 h-4 text-[var(--text-secondary)]" />
            <h2 className="text-sm font-medium text-[var(--text-primary)]">Knowledge Base Gaps</h2>
          </div>
          {!summary?.knowledge_gaps?.length ? (
            <p className="text-sm text-[var(--text-muted)]">No gaps detected this week.</p>
          ) : (
            <div className="space-y-3">
              {summary.knowledge_gaps.map((gap: KnowledgeGap, i: number) => (
                <div key={i} className="p-3 rounded-xl bg-[rgba(0,0,0,0.02)]">
                  <p className="text-sm font-medium text-[var(--text-primary)] capitalize">{gap.topic}</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">{gap.description}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Affects {gap.affected_conversations} conversations
                  </p>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>

      {/* Worst Conversations */}
      <GlassCard className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 text-[var(--text-secondary)]" />
          <h2 className="text-sm font-medium text-[var(--text-primary)]">Worst Conversations This Week</h2>
        </div>
        {!summary?.top_failures?.length ? (
          <p className="text-sm text-[var(--text-muted)]">No scored conversations this week.</p>
        ) : (
          <div className="space-y-2">
            {summary.top_failures.map((f, i) => (
              <Link
                key={i}
                href={`/conversations/${f.conversation_id}`}
                className="flex items-center justify-between p-3 rounded-xl bg-[rgba(0,0,0,0.02)] hover:bg-[rgba(0,0,0,0.04)] transition-colors"
              >
                <div>
                  <p className="text-sm text-[var(--text-primary)]">{f.summary}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">{f.conversation_id}</p>
                </div>
                <ScoreBadge score={f.score} />
              </Link>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
