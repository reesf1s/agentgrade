"use client";

import Link from "next/link";
import { ArrowRight, Minus, TrendingDown, TrendingUp } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ScoreBadge, SeverityBadge } from "@/components/ui/score-badge";
import { GlassCard } from "@/components/ui/glass-card";
import { scoreAccent } from "@/lib/utils";
import type { ReportData } from "@/lib/dashboard-data";

function trendState(delta: number) {
  if (delta > 0.02) return { label: "Quality improved", Icon: TrendingUp, color: "#0F7B3D" };
  if (delta < -0.02) return { label: "Quality slipped", Icon: TrendingDown, color: "#C4342C" };
  return { label: "Quality steady", Icon: Minus, color: "#787774" };
}

export function ReportsPageClient({ report }: { report: ReportData }) {
  const summary = report.summary;
  const trendData = report.trend_data || [];
  const delta = summary?.score_trend ?? 0;
  const trend = trendState(delta);
  const TrendIcon = trend.Icon;

  const avgScore = summary?.avg_overall_score ?? 0;
  const riskyReplies = summary?.hallucination_count ?? 0;
  const scored = summary?.total_scored ?? 0;
  const primaryPattern = report.patterns[0];
  const primaryRecommendation = report.organization_recommendations[0];

  if (scored === 0) {
    return (
      <div className="space-y-6 pb-8 animate-fade-in">
        <div className="page-header">
          <div>
            <h1 className="page-title">This week</h1>
            <p className="page-subtitle mt-2">
              {report.week_start} to {report.week_end}
            </p>
          </div>
        </div>

        <div
          className="rounded-[6px] border border-[#E9E9E7] bg-white p-8"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
        >
          <div className="assessment-hero">
            <div>
              <p className="page-eyebrow">Report status</p>
              <h2
                className="mt-3 text-2xl font-semibold tracking-[-0.04em]"
                style={{ color: "#37352F" }}
              >
                Not enough scored data yet
              </h2>
              <p className="mt-3 text-sm leading-6" style={{ color: "#787774" }}>
                Reports will become useful once the workspace has usable scores for this period.
              </p>
            </div>
            <div
              className="assessment-score-card rounded-[6px] border border-[#E9E9E7] p-5"
              style={{ background: "#F7F7F5" }}
            >
              <p className="page-eyebrow">Next step</p>
              <p className="mt-3 text-base font-semibold" style={{ color: "#37352F" }}>
                Review new conversations and let scoring complete.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/conversations" className="glass-button glass-button-primary text-sm">
                  Open conversations
                </Link>
                <Link href="/dashboard" className="glass-button text-sm">
                  Back to overview
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">This week</h1>
          <p className="page-subtitle mt-2">
            {report.week_start} to {report.week_end}
          </p>
        </div>
      </div>

      {/* Assessment hero */}
      <section className="assessment-hero">
        <div
          className="rounded-[6px] border border-[#E9E9E7] bg-white p-6 sm:p-7"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
        >
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-2xl">
              <div className="token-row">
                <span
                  className="token-pill"
                  style={{
                    background: "#F1F1EF",
                    border: "1px solid #E9E9E7",
                    color: "#787774",
                  }}
                >
                  {scored} scored
                </span>
                <span
                  className="token-pill inline-flex items-center gap-1"
                  style={{
                    background: "#F1F1EF",
                    border: "1px solid #E9E9E7",
                    color: trend.color,
                  }}
                >
                  <TrendIcon className="h-3.5 w-3.5" />
                  {trend.label}
                </span>
              </div>
              <p className="mt-5 text-sm font-medium" style={{ color: "#787774" }}>
                At a glance
              </p>
              <p
                className="mt-3 assessment-title"
                style={{ color: scoreAccent(avgScore) }}
              >
                {Math.round(avgScore * 100)}%
              </p>
              <p
                className="mt-4 text-xl leading-8 tracking-[-0.02em]"
                style={{ color: "#37352F" }}
              >
                {delta > 0.02
                  ? "Quality improved, but review the remaining risky reply."
                  : delta < -0.02
                    ? "Quality slipped. Review the top issue first."
                    : "Quality is steady. Keep the weekly loop running."}
              </p>
            </div>

            <div
              className="assessment-score-card rounded-[6px] border border-[#E9E9E7] p-5"
              style={{ background: "#F7F7F5" }}
            >
              <p className="page-eyebrow">This week</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div className="value-block">
                  <span className="value-key">Scored</span>
                  <span className="value-text">{scored}</span>
                </div>
                <div className="value-block">
                  <span className="value-key">Risky</span>
                  <span className="value-text">{riskyReplies}</span>
                </div>
                <div className="value-block">
                  <span className="value-key">Trend</span>
                  <span className="value-text">{trend.label.replace("Quality ", "")}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          className="rounded-[6px] border border-[#E9E9E7] bg-white p-6"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
        >
          <div className="space-y-5">
            <div>
              <p className="page-eyebrow">Biggest risk</p>
              {primaryPattern ? (
                <>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={primaryPattern.severity} />
                    <span className="text-sm" style={{ color: "#787774" }}>
                      {primaryPattern.affected_conversation_ids.length} affected
                    </span>
                  </div>
                  <p
                    className="mt-3 text-lg font-semibold tracking-[-0.03em]"
                    style={{ color: "#37352F" }}
                  >
                    {primaryPattern.title}
                  </p>
                  <p className="mt-2 text-sm leading-6" style={{ color: "#787774" }}>
                    {primaryPattern.description}
                  </p>
                </>
              ) : (
                <>
                  <p
                    className="mt-3 text-lg font-semibold tracking-[-0.03em]"
                    style={{ color: "#37352F" }}
                  >
                    No repeated issue
                  </p>
                  <p className="mt-2 text-sm leading-6" style={{ color: "#787774" }}>
                    Nothing is clustering into a major org-wide problem.
                  </p>
                </>
              )}
            </div>

            <div className="pt-5" style={{ borderTop: "1px solid #F1F1EF" }}>
              <p className="page-eyebrow">Best opportunity</p>
              <p
                className="mt-3 text-base font-semibold tracking-[-0.02em]"
                style={{ color: "#37352F" }}
              >
                {primaryRecommendation?.recommended_change || "No clear org-wide fix yet."}
              </p>
              {primaryRecommendation?.expected_impact ? (
                <p className="mt-2 text-sm leading-6" style={{ color: "#787774" }}>
                  {primaryRecommendation.expected_impact}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        {/* Trend chart */}
        <div
          className="rounded-[6px] border border-[#E9E9E7] bg-white p-6"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="page-eyebrow">Quality trend</p>
              <h2
                className="mt-2 text-xl font-semibold tracking-[-0.03em]"
                style={{ color: "#37352F" }}
              >
                Movement over time
              </h2>
            </div>
            <span className="operator-chip">30d</span>
          </div>

          {trendData.length === 0 ? (
            <p className="mt-8 text-center text-sm" style={{ color: "#ACABA8" }}>
              Trend data will appear once more conversations are scored.
            </p>
          ) : (
            <div className="mt-5 h-60">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 4, right: 6, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="reportOverall" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2383E2" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#2383E2" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#F1F1EF" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "#ACABA8" }}
                    tickFormatter={(value) => value.slice(5)}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0.3, 1]}
                    tick={{ fontSize: 11, fill: "#ACABA8" }}
                    tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#FFFFFF",
                      border: "1px solid #E9E9E7",
                      borderRadius: "6px",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                      fontSize: 12,
                      color: "#37352F",
                    }}
                    formatter={(value) => [`${Math.round(Number(value) * 100)}%`]}
                  />
                  <Area
                    type="monotone"
                    dataKey="overall"
                    stroke="#2383E2"
                    strokeWidth={2}
                    fill="url(#reportOverall)"
                    dot={false}
                    activeDot={{ r: 4, fill: "#2383E2", stroke: "#FFFFFF", strokeWidth: 2 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="accuracy"
                    stroke="#0F7B3D"
                    strokeWidth={1.8}
                    fill="transparent"
                    dot={false}
                    opacity={0.7}
                  />
                  <Area
                    type="monotone"
                    dataKey="hallucination"
                    stroke="#C47A00"
                    strokeWidth={1.8}
                    fill="transparent"
                    dot={false}
                    opacity={0.7}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Worth reviewing */}
        <div
          className="rounded-[6px] border border-[#E9E9E7] bg-white p-6"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
        >
          <p className="page-eyebrow">Worth reviewing</p>
          <div className="mt-4 compact-list">
            {summary?.top_failures?.length ? (
              summary.top_failures.slice(0, 4).map((item) => (
                <Link
                  key={item.conversation_id}
                  href={`/conversations/${item.conversation_id}`}
                  className="compact-list-item flex items-start justify-between gap-4 hover:bg-[#F7F7F5] transition-colors rounded-[4px]"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold" style={{ color: "#37352F" }}>
                      Conversation #{item.conversation_id.slice(0, 6)}
                    </p>
                    {item.summary ? (
                      <p className="mt-1 text-sm leading-6" style={{ color: "#787774" }}>
                        {item.summary}
                      </p>
                    ) : null}
                  </div>
                  {item.score !== undefined ? <ScoreBadge score={item.score} size="sm" /> : null}
                </Link>
              ))
            ) : (
              <p className="py-10 text-center text-sm" style={{ color: "#ACABA8" }}>
                No priority conversations this week.
              </p>
            )}
          </div>
          <Link
            href="/conversations"
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold"
            style={{ color: "#2383E2" }}
          >
            Open conversations
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
