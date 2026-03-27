"use client";
import { useEffect, useState, useCallback } from "react";
import { GlassCard, StatCard } from "@/components/ui/glass-card";
import { ScoreBadge, SeverityBadge } from "@/components/ui/score-badge";
import { SkeletonStat, Skeleton } from "@/components/ui/skeleton";
import { scoreColor } from "@/lib/utils";
import { Brain, BookOpen, AlertTriangle, ChevronLeft, ChevronRight, Download } from "lucide-react";
import Link from "next/link";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import type { WeeklyReportSummary, PromptImprovement, KnowledgeGap } from "@/lib/db/types";

interface ReportData {
  week_start: string;
  week_end: string;
  summary: WeeklyReportSummary;
  trend_data: Array<{ date: string; overall: number; accuracy?: number; hallucination?: number }>;
}

// Pretty-print a week like "Mar 17 – Mar 23, 2026"
function formatWeekRange(start: string, end: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const endOpts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  return `${new Date(start).toLocaleDateString("en-GB", opts)} – ${new Date(end).toLocaleDateString("en-GB", endOpts)}`;
}

export default function ReportsPage() {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  // weekOffset: 0 = current week, -1 = last week, etc.
  const [weekOff, setWeekOff] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (weekOff !== 0) {
      // Compute the Monday of the target week
      const d = new Date();
      d.setDate(d.getDate() + weekOff * 7 - d.getDay() + 1); // Monday
      params.set("week_start", d.toISOString().slice(0, 10));
    }
    fetch(`/api/reports?${params}`)
      .then((r) => r.json())
      .then(setReport)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [weekOff]);

  useEffect(() => { load(); }, [load]);

  const summary = report?.summary;
  const trendData = report?.trend_data ?? [];

  return (
    <div className="max-w-6xl">
      {/* Header with week navigator */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Weekly Report</h1>
          {report && !loading && (
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              {formatWeekRange(report.week_start, report.week_end)}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Week navigation */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]">
            <button
              onClick={() => setWeekOff((w) => w - 1)}
              className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-[var(--text-secondary)] px-2 min-w-[90px] text-center">
              {weekOff === 0 ? "This week" : weekOff === -1 ? "Last week" : `${Math.abs(weekOff)} weeks ago`}
            </span>
            <button
              onClick={() => setWeekOff((w) => Math.min(0, w + 1))}
              disabled={weekOff >= 0}
              className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-all disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Export PDF */}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.05)] transition-all"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {loading ? (
          <>
            <SkeletonStat /><SkeletonStat /><SkeletonStat /><SkeletonStat />
          </>
        ) : (
          <>
            <StatCard
              label="Conversations Scored"
              value={summary?.total_scored ?? 0}
              subtitle={`${summary?.total_conversations ?? 0} total this week`}
            />
            <StatCard
              label="Avg Quality"
              value={`${((summary?.avg_overall_score ?? 0) * 100).toFixed(0)}%`}
              subtitle={
                summary?.score_trend !== undefined
                  ? `${summary.score_trend > 0 ? "+" : ""}${(summary.score_trend * 100).toFixed(1)}% vs last week`
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
          </>
        )}
      </div>

      {/* Trend chart */}
      <GlassCard className="p-6 mb-6">
        <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4">Quality Trend</h2>
        {loading ? (
          <Skeleton className="h-56 w-full" />
        ) : trendData.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-sm text-[var(--text-muted)]">
            No trend data for this week.
          </div>
        ) : (
          <div className="h-56">
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
                <Legend
                  wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)", paddingTop: 8 }}
                />
                <Line type="monotone" dataKey="overall"      stroke="rgba(255,255,255,0.7)" strokeWidth={2}   dot={false} name="Overall" />
                <Line type="monotone" dataKey="accuracy"     stroke="#10B981"               strokeWidth={1.5} dot={false} name="Accuracy"     opacity={0.8} />
                <Line type="monotone" dataKey="hallucination" stroke="#EF4444"              strokeWidth={1.5} dot={false} name="Hallucination" opacity={0.8} />
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
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ) : !summary?.prompt_improvements?.length ? (
            <p className="text-sm text-[var(--text-muted)]">None detected this week.</p>
          ) : (
            <div className="space-y-3">
              {summary.prompt_improvements.slice(0, 4).map((imp: PromptImprovement, i: number) => (
                <div key={i} className="p-3 rounded-xl bg-[rgba(255,255,255,0.02)]">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{imp.issue}</p>
                    <SeverityBadge severity={imp.priority === "high" ? "high" : "medium"} />
                  </div>
                  <p className="text-xs text-[var(--text-muted)] font-mono italic line-clamp-2">
                    {imp.recommended_prompt_change}
                  </p>
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
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ) : !summary?.knowledge_gaps?.length ? (
            <p className="text-sm text-[var(--text-muted)]">No gaps detected this week.</p>
          ) : (
            <div className="space-y-3">
              {summary.knowledge_gaps.slice(0, 4).map((gap: KnowledgeGap, i: number) => (
                <div key={i} className="p-3 rounded-xl bg-[rgba(255,255,255,0.02)]">
                  <p className="text-sm font-medium text-[var(--text-primary)] capitalize">{gap.topic}</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">{gap.description}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Affects {gap.affected_conversations} conversation{gap.affected_conversations !== 1 ? "s" : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>

      {/* Worst conversations */}
      <GlassCard className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 text-[var(--text-secondary)]" />
          <h2 className="text-sm font-medium text-[var(--text-primary)]">Worst Conversations This Week</h2>
        </div>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        ) : !summary?.top_failures?.length ? (
          <p className="text-sm text-[var(--text-muted)]">No scored conversations this week.</p>
        ) : (
          <div className="space-y-2">
            {summary.top_failures.map((f, i) => (
              <Link
                key={i}
                href={`/conversations/${f.conversation_id}`}
                className="flex items-center justify-between p-3 rounded-xl bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.04)] transition-colors"
              >
                <div>
                  <p className="text-sm text-[var(--text-primary)]">{f.summary}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5 font-mono">{f.conversation_id.slice(0, 16)}…</p>
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
