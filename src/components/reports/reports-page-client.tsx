"use client";

import Link from "next/link";
import { ArrowRight, Brain, TrendingDown, TrendingUp } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SeverityBadge } from "@/components/ui/score-badge";
import type { ReportData } from "@/lib/dashboard-data";

export function ReportsPageClient({ report }: { report: ReportData }) {
  const summary = report.summary;
  const trendData = report.trend_data || [];
  const trendDelta = summary?.score_trend ?? 0;
  const trendTone =
    trendDelta > 0.02
      ? {
          title: "Quality improved this week",
          icon: TrendingUp,
          tone: "text-score-good",
        }
      : trendDelta < -0.02
        ? {
            title: "Quality slipped this week",
            icon: TrendingDown,
            tone: "text-score-critical",
          }
        : {
            title: "Quality stayed steady",
            icon: TrendingUp,
            tone: "text-[var(--text-secondary)]",
          };

  const TrendIcon = trendTone.icon;

  return (
    <div className="space-y-6 pb-10">
      <section className="glass-static rounded-[1.5rem] p-5 sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="page-eyebrow">Reports</p>
            <h1 className="mt-2 page-title">This week’s quality memo.</h1>
            <p className="mt-3 text-sm text-[var(--text-secondary)]">
              {report.week_start} to {report.week_end}
            </p>
          </div>
          <button className="glass-button glass-button-primary">Export PDF</button>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="text-[var(--text-primary)]">Scored: {summary?.total_scored ?? 0}</span>
        <span className="text-[var(--text-primary)]">Avg: {Math.round((summary?.avg_overall_score ?? 0) * 100)}%</span>
        <span className="text-[var(--text-primary)]">Risky: {summary?.hallucination_count ?? 0}</span>
        <span className="text-[var(--text-primary)]">Escalations: {summary?.escalation_count ?? 0}</span>
      </div>

      <section className="space-y-5">
        <div className="space-y-2 border-b border-[var(--divider)] pb-4 text-sm">
          <p className="font-semibold text-[var(--text-primary)]">What changed this week</p>
          <div className="flex items-center gap-2">
            <TrendIcon className={`h-4 w-4 ${trendTone.tone}`} />
            <span className="text-[var(--text-primary)]">{trendTone.title}</span>
          </div>
          <p className="text-[var(--text-secondary)]">
            {summary?.hallucination_count ? `${summary.hallucination_count} risky replies remain.` : "No issue."}
          </p>
        </div>

        <div className="space-y-2 border-b border-[var(--divider)] pb-4 text-sm">
          <p className="font-semibold text-[var(--text-primary)]">Biggest risk</p>
          {report.patterns[0] ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[var(--text-primary)]">{report.patterns[0].title}</span>
                <SeverityBadge severity={report.patterns[0].severity} />
              </div>
              <p className="text-[var(--text-secondary)]">{report.patterns[0].description}</p>
            </>
          ) : (
            <p className="text-[var(--text-secondary)]">None this week.</p>
          )}
        </div>

        <div className="space-y-2 border-b border-[var(--divider)] pb-4 text-sm">
          <p className="font-semibold text-[var(--text-primary)]">Best improvement opportunity</p>
          <p className="text-[var(--text-secondary)]">
            {report.organization_recommendations[0]?.recommended_change || "No clear org-wide fix."}
          </p>
        </div>

        <div className="space-y-3">
          <div className="mb-2 flex items-center gap-2">
            <Brain className="h-4 w-4 text-[var(--text-secondary)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Conversations worth reviewing</h2>
          </div>
          {summary?.top_failures?.length ? (
            <div className="stack-list">
              {summary.top_failures.map((item) => (
                <Link key={item.conversation_id} href={`/conversations/${item.conversation_id}`} className="stack-row">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{item.conversation_id.slice(0, 8)}</p>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">{item.summary}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-[var(--text-muted)]" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">Nothing worth reviewing right now.</p>
          )}
        </div>
      </section>

      <section className="border-t border-[var(--divider)] pt-4">
        <div className="mb-3 flex items-center justify-between gap-4">
          <p className="text-sm font-medium text-[var(--text-primary)]">Trend</p>
          <span className="operator-chip">30 days</span>
        </div>

        {trendData.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No trend yet.</p>
        ) : (
          <div className="h-64">
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
                    borderRadius: "16px",
                    fontSize: 12,
                    boxShadow: "var(--glass-shadow)",
                  }}
                />
                <Line type="monotone" dataKey="overall" stroke="var(--text-primary)" strokeWidth={2.4} dot={false} />
                <Line type="monotone" dataKey="accuracy" stroke="#10b981" strokeWidth={1.4} dot={false} opacity={0.45} />
                <Line type="monotone" dataKey="hallucination" stroke="#f59e0b" strokeWidth={1.4} dot={false} opacity={0.45} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  );
}
