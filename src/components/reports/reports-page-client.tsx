"use client";

import Link from "next/link";
import { AlertTriangle, BookOpen, Brain } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { GlassCard, StatCard } from "@/components/ui/glass-card";
import { ScoreBadge, SeverityBadge } from "@/components/ui/score-badge";
import { scoreColor } from "@/lib/utils";
import type { ReportData } from "@/lib/dashboard-data";
import type { KnowledgeGap, PromptImprovement } from "@/lib/db/types";

export function ReportsPageClient({ report }: { report: ReportData }) {
  const summary = report.summary;
  const trendData = report.trend_data || [];

  return (
    <div className="max-w-6xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Weekly Report</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Week of {report.week_start} - {report.week_end}
          </p>
        </div>
        <button className="glass-button text-sm">Export PDF</button>
      </div>

      <div className="mb-8 grid grid-cols-4 gap-4">
        <StatCard
          label="Conversations Scored"
          value={summary?.total_scored ?? 0}
          subtitle={`${summary?.total_conversations ?? 0} total`}
        />
        <StatCard
          label="Avg Quality"
          value={`${((summary?.avg_overall_score ?? 0) * 100).toFixed(0)}%`}
          subtitle={
            summary?.score_trend !== undefined
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

      <GlassCard className="mb-6 p-6">
        <h2 className="mb-4 text-sm font-medium text-[var(--text-primary)]">Quality Trend</h2>
        {trendData.length === 0 ? (
          <div className="flex h-56 items-center justify-center text-sm text-[var(--text-muted)]">
            No trend data yet.
          </div>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid stroke="rgba(0,0,0,0.04)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickFormatter={(value) => value.slice(5)} axisLine={{ stroke: "rgba(0,0,0,0.06)" }} tickLine={false} />
                <YAxis domain={[0.3, 1]} tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickFormatter={(value: number) => `${(value * 100).toFixed(0)}%`} axisLine={{ stroke: "rgba(0,0,0,0.06)" }} tickLine={false} />
                <Tooltip contentStyle={{ background: "rgba(255,255,255,0.9)", backdropFilter: "blur(12px)", border: "1px solid rgba(0,0,0,0.06)", borderRadius: "12px", fontSize: 12 }} formatter={(value) => [`${(Number(value) * 100).toFixed(0)}%`]} />
                <Line type="monotone" dataKey="overall" stroke="#111827" strokeWidth={2} dot={false} name="Overall" />
                <Line type="monotone" dataKey="accuracy" stroke="#10B981" strokeWidth={1.5} dot={false} name="Accuracy" opacity={0.5} />
                <Line type="monotone" dataKey="hallucination" stroke="#EF4444" strokeWidth={1.5} dot={false} name="Hallucination" opacity={0.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </GlassCard>

      <div className="mb-6 grid grid-cols-2 gap-6">
        <GlassCard className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <Brain className="h-4 w-4 text-[var(--text-secondary)]" />
            <h2 className="text-sm font-medium text-[var(--text-primary)]">Top Prompt Improvements</h2>
          </div>
          {!summary?.prompt_improvements?.length ? (
            <p className="text-sm text-[var(--text-muted)]">None detected this week.</p>
          ) : (
            <div className="space-y-3">
              {summary.prompt_improvements.map((improvement: PromptImprovement, index: number) => (
                <div key={index} className="rounded-xl bg-[rgba(0,0,0,0.02)] p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{improvement.issue}</p>
                    <SeverityBadge severity={improvement.priority === "high" ? "high" : "medium"} />
                  </div>
                  <p className="text-xs italic text-[var(--text-muted)]">{improvement.recommended_prompt_change}</p>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[var(--text-secondary)]" />
            <h2 className="text-sm font-medium text-[var(--text-primary)]">Knowledge Base Gaps</h2>
          </div>
          {!summary?.knowledge_gaps?.length ? (
            <p className="text-sm text-[var(--text-muted)]">No gaps detected this week.</p>
          ) : (
            <div className="space-y-3">
              {summary.knowledge_gaps.map((gap: KnowledgeGap, index: number) => (
                <div key={index} className="rounded-xl bg-[rgba(0,0,0,0.02)] p-3">
                  <p className="text-sm font-medium capitalize text-[var(--text-primary)]">{gap.topic}</p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">{gap.description}</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Affects {gap.affected_conversations} conversations
                  </p>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>

      <GlassCard className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-[var(--text-secondary)]" />
          <h2 className="text-sm font-medium text-[var(--text-primary)]">Worst Conversations This Week</h2>
        </div>
        {!summary?.top_failures?.length ? (
          <p className="text-sm text-[var(--text-muted)]">No scored conversations this week.</p>
        ) : (
          <div className="space-y-2">
            {summary.top_failures.map((failure, index) => (
              <Link
                key={index}
                href={`/conversations/${failure.conversation_id}`}
                className="flex items-center justify-between rounded-xl bg-[rgba(0,0,0,0.02)] p-3 transition-colors hover:bg-[rgba(0,0,0,0.04)]"
              >
                <div>
                  <p className="text-sm text-[var(--text-primary)]">{failure.summary}</p>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">{failure.conversation_id}</p>
                </div>
                <ScoreBadge score={failure.score} />
              </Link>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
