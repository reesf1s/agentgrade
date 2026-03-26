"use client";
import { GlassCard, StatCard } from "@/components/ui/glass-card";
import { ScoreBadge, SeverityBadge } from "@/components/ui/score-badge";
import { scoreColor } from "@/lib/utils";
import { SEED_WEEKLY_SUMMARY, generateTrendData } from "@/lib/db/seed-data";
import { Brain, BookOpen, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const trendData = generateTrendData(30);
const report = SEED_WEEKLY_SUMMARY;

export default function ReportsPage() {
  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Weekly Report</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Week of Mar 17 – Mar 23, 2026</p>
        </div>
        <button className="glass-button text-sm">Export PDF</button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Conversations Scored" value={report.total_scored} subtitle={`${report.total_conversations} total`} />
        <StatCard
          label="Avg Quality"
          value={`${(report.avg_overall_score * 100).toFixed(0)}%`}
          subtitle={
            report.score_trend > 0
              ? `+${(report.score_trend * 100).toFixed(1)}% from last week`
              : `${(report.score_trend * 100).toFixed(1)}% from last week`
          }
          scoreColor={scoreColor(report.avg_overall_score)}
        />
        <StatCard
          label="Hallucinations"
          value={report.hallucination_count}
          subtitle="Conversations with fabrications"
          scoreColor={report.hallucination_count > 5 ? "score-critical" : "score-warning"}
        />
        <StatCard
          label="Escalations"
          value={report.escalation_count}
          subtitle="Requested human agent"
          scoreColor={report.escalation_count > 10 ? "score-warning" : "score-good"}
        />
      </div>

      {/* Trend Chart */}
      <GlassCard className="p-6 mb-6">
        <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4">Quality Trend</h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid stroke="rgba(0,0,0,0.04)" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickFormatter={(v) => v.slice(5)} axisLine={{ stroke: "rgba(0,0,0,0.06)" }} tickLine={false} />
              <YAxis domain={[0.3, 1]} tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} axisLine={{ stroke: "rgba(0,0,0,0.06)" }} tickLine={false} />
              <Tooltip contentStyle={{ background: "rgba(255,255,255,0.9)", backdropFilter: "blur(12px)", border: "1px solid rgba(0,0,0,0.06)",  borderRadius: "12px", fontSize: 12 }} formatter={(value) => [`${(Number(value) * 100).toFixed(0)}%`]} />
              <Line type="monotone" dataKey="overall" stroke="#111827" strokeWidth={2} dot={false} name="Overall" />
              <Line type="monotone" dataKey="accuracy" stroke="#10B981" strokeWidth={1.5} dot={false} name="Accuracy" opacity={0.5} />
              <Line type="monotone" dataKey="hallucination" stroke="#EF4444" strokeWidth={1.5} dot={false} name="Hallucination" opacity={0.5} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Top Prompt Improvements */}
        <GlassCard className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-4 h-4 text-[var(--text-secondary)]" />
            <h2 className="text-sm font-medium text-[var(--text-primary)]">Top Prompt Improvements</h2>
          </div>
          <div className="space-y-3">
            {report.prompt_improvements.map((imp, i) => (
              <div key={i} className="p-3 rounded-xl bg-[rgba(0,0,0,0.02)]">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{imp.issue}</p>
                  <SeverityBadge severity={imp.priority === "high" ? "high" : "medium"} />
                </div>
                <p className="text-xs text-[var(--text-muted)] italic">{imp.recommended_prompt_change}</p>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Knowledge Gaps */}
        <GlassCard className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-4 h-4 text-[var(--text-secondary)]" />
            <h2 className="text-sm font-medium text-[var(--text-primary)]">Knowledge Base Gaps</h2>
          </div>
          <div className="space-y-3">
            {report.knowledge_gaps.map((gap, i) => (
              <div key={i} className="p-3 rounded-xl bg-[rgba(0,0,0,0.02)]">
                <p className="text-sm font-medium text-[var(--text-primary)] capitalize">{gap.topic}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-1">{gap.description}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Affects {gap.affected_conversations} conversations
                </p>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Worst Conversations */}
      <GlassCard className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 text-[var(--text-secondary)]" />
          <h2 className="text-sm font-medium text-[var(--text-primary)]">Worst Conversations This Week</h2>
        </div>
        <div className="space-y-2">
          {report.top_failures.map((f, i) => (
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
      </GlassCard>
    </div>
  );
}
