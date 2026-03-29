"use client";

import Link from "next/link";
import {
  AlertTriangle,
  BookOpen,
  Brain,
  Siren,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
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
  const trendDelta = summary?.score_trend ?? 0;
  const trendTone =
    trendDelta > 0.02
      ? {
          title: "Quality improved this week",
          description: `Average quality moved up by ${(trendDelta * 100).toFixed(1)} points versus the previous week.`,
          icon: TrendingUp,
        }
      : trendDelta < -0.02
        ? {
            title: "Quality slipped this week",
            description: `Average quality fell by ${Math.abs(trendDelta * 100).toFixed(1)} points versus the previous week.`,
            icon: TrendingDown,
          }
        : {
            title: "Quality stayed steady",
            description: "No material movement versus the previous week.",
            icon: TrendingUp,
          };
  const notableIconClass = trendDelta < -0.02 ? "text-score-critical" : "text-score-good";
  const NotableIcon = trendTone.icon;
  const recommendedInterventions = report.patterns.slice(0, 3).map((pattern) => ({
    id: pattern.id,
    title: pattern.title,
    intervention:
      pattern.recommendation ||
      pattern.prompt_fix ||
      pattern.knowledge_base_suggestion ||
      "Review the pattern and decide on a prompt, policy, or workflow change.",
    severity: pattern.severity,
    href: pattern.affected_conversation_ids[0]
      ? `/conversations/${pattern.affected_conversation_ids[0]}`
      : "/patterns",
  }));

  return (
    <div className="space-y-6 pb-10">
      <GlassCard className="rounded-[1.35rem] p-6 md:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="enterprise-kicker">Reports</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.06em] text-[var(--text-primary)]">
              Weekly quality review for the workspace.
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
              {report.week_start} to {report.week_end}. Use this report to explain what changed, where trust is drifting, and what the team should fix next.
            </p>
          </div>
          <button className="glass-button glass-button-primary">Export PDF</button>
        </div>
      </GlassCard>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Scored"
          value={summary?.total_scored ?? 0}
          subtitle={`${summary?.total_conversations ?? 0} conversations in range`}
        />
        <StatCard
          label="Average quality"
          value={`${Math.round((summary?.avg_overall_score ?? 0) * 100)}%`}
          subtitle={
            summary?.score_trend !== undefined
              ? `${summary.score_trend > 0 ? "+" : ""}${(summary.score_trend * 100).toFixed(1)} points vs prior week`
              : "Comparing with last week"
          }
          scoreColor={scoreColor(summary?.avg_overall_score ?? 0)}
        />
        <StatCard
          label="Evidence review"
          value={summary?.hallucination_count ?? 0}
          subtitle="Conversations that still need fact checks"
          scoreColor={(summary?.hallucination_count ?? 0) > 5 ? "score-critical" : "score-warning"}
        />
        <StatCard
          label="Escalations"
          value={summary?.escalation_count ?? 0}
          subtitle="Conversations that needed a human"
          scoreColor={(summary?.escalation_count ?? 0) > 10 ? "score-warning" : "score-good"}
        />
      </div>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.9fr)]">
        <GlassCard className="rounded-[1.25rem] p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="enterprise-section-title">Trend</p>
              <h2 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">Weekly quality trend</h2>
            </div>
            {summary?.avg_overall_score !== undefined ? (
              <ScoreBadge score={summary.avg_overall_score} size="sm" />
            ) : null}
          </div>

          {trendData.length === 0 ? (
            <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-soft)] text-sm text-[var(--text-muted)]">
              No trend data yet.
            </div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
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
                    tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
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
                  />
                  <Line type="monotone" dataKey="overall" stroke="var(--text-primary)" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="accuracy" stroke="#10B981" strokeWidth={1.5} dot={false} opacity={0.55} />
                  <Line type="monotone" dataKey="hallucination" stroke="#F97316" strokeWidth={1.5} dot={false} opacity={0.55} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </GlassCard>

        <div className="space-y-4">
          <GlassCard className="rounded-[1.25rem] p-5">
            <div className="mb-4 flex items-center gap-2">
              <NotableIcon className={`h-4 w-4 ${notableIconClass}`} />
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">This week in one line</h2>
            </div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">{trendTone.title}</p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{trendTone.description}</p>
          </GlassCard>

          <GlassCard className="rounded-[1.25rem] p-5">
            <div className="mb-4 flex items-center gap-2">
              <Brain className="h-4 w-4 text-[var(--text-secondary)]" />
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Recommended next moves</h2>
            </div>
            {recommendedInterventions.length === 0 ? (
              <p className="text-sm leading-6 text-[var(--text-secondary)]">No intervention is standing out yet.</p>
            ) : (
              <div className="space-y-3">
                {recommendedInterventions.map((intervention) => (
                  <Link
                    key={intervention.id}
                    href={intervention.href}
                    className="block rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-4"
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{intervention.title}</p>
                      <SeverityBadge severity={intervention.severity} />
                    </div>
                    <p className="text-sm leading-6 text-[var(--text-secondary)]">{intervention.intervention}</p>
                  </Link>
                ))}
              </div>
            )}
          </GlassCard>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <GlassCard className="rounded-[1.25rem] p-5">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-[var(--text-secondary)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Recurring issues</h2>
          </div>
          {report.patterns.length === 0 ? (
            <p className="text-sm leading-6 text-[var(--text-secondary)]">No repeated issue was detected this week.</p>
          ) : (
            <div className="space-y-3">
              {report.patterns.map((pattern) => (
                <Link
                  key={pattern.id}
                  href={pattern.affected_conversation_ids[0] ? `/conversations/${pattern.affected_conversation_ids[0]}` : "/patterns"}
                  className="block rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-4"
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{pattern.title}</p>
                    <SeverityBadge severity={pattern.severity} />
                  </div>
                  <p className="text-sm leading-6 text-[var(--text-secondary)]">{pattern.description}</p>
                </Link>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard className="rounded-[1.25rem] p-5">
          <div className="mb-4 flex items-center gap-2">
            <Brain className="h-4 w-4 text-[var(--text-secondary)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Org-wide improvements</h2>
          </div>
          {report.organization_recommendations.length === 0 ? (
            <p className="text-sm leading-6 text-[var(--text-secondary)]">No org-wide change is being recommended yet.</p>
          ) : (
            <div className="space-y-3">
              {report.organization_recommendations.map((recommendation) => (
                <div key={recommendation.id} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{recommendation.title}</p>
                    <SeverityBadge
                      severity={
                        recommendation.priority === "high"
                          ? "high"
                          : recommendation.priority === "medium"
                            ? "medium"
                            : "low"
                      }
                    />
                  </div>
                  <p className="text-sm leading-6 text-[var(--text-secondary)]">{recommendation.rationale}</p>
                  <p className="mt-3 text-sm font-medium text-[var(--text-primary)]">{recommendation.recommended_change}</p>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <GlassCard className="rounded-[1.25rem] p-5">
          <div className="mb-4 flex items-center gap-2">
            <Brain className="h-4 w-4 text-[var(--text-secondary)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Prompt improvements</h2>
          </div>
          {!summary?.prompt_improvements?.length ? (
            <p className="text-sm leading-6 text-[var(--text-secondary)]">No prompt improvement surfaced this week.</p>
          ) : (
            <div className="space-y-3">
              {summary.prompt_improvements.map((improvement: PromptImprovement, index: number) => (
                <div key={`${improvement.issue}-${index}`} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-4">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{improvement.issue}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{improvement.recommended_prompt_change}</p>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard className="rounded-[1.25rem] p-5">
          <div className="mb-4 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[var(--text-secondary)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Knowledge gaps</h2>
          </div>
          {!summary?.knowledge_gaps?.length ? (
            <p className="text-sm leading-6 text-[var(--text-secondary)]">No knowledge gap surfaced this week.</p>
          ) : (
            <div className="space-y-3">
              {summary.knowledge_gaps.map((gap: KnowledgeGap, index: number) => (
                <div key={`${gap.topic}-${index}`} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-4">
                  <p className="text-sm font-semibold capitalize text-[var(--text-primary)]">{gap.topic}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{gap.description}</p>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard className="rounded-[1.25rem] p-5">
          <div className="mb-4 flex items-center gap-2">
            <Siren className="h-4 w-4 text-[var(--text-secondary)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Alerts fired</h2>
          </div>
          {report.alerts.length === 0 ? (
            <p className="text-sm leading-6 text-[var(--text-secondary)]">No alerts fired in this window.</p>
          ) : (
            <div className="space-y-3">
              {report.alerts.map((alert) => (
                <div key={alert.id} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-4">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{alert.title}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{alert.description || "Threshold crossed."}</p>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </section>
    </div>
  );
}
