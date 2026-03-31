"use client";

import Link from "next/link";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ScoreBadge, SeverityBadge } from "@/components/ui/score-badge";
import { GlassCard } from "@/components/ui/glass-card";
import { scoreAccent, pct } from "@/lib/utils";
import type { DashboardData } from "@/lib/dashboard-data";

function trendState(delta: number) {
  if (delta > 0.02) return { label: "Improving", Icon: TrendingUp, color: "#0F7B3D" };
  if (delta < -0.02) return { label: "Declining", Icon: TrendingDown, color: "#C4342C" };
  return { label: "Steady", Icon: Minus, color: "#787774" };
}

export function DashboardPageClient({ data }: { data: DashboardData }) {
  const avgScore = data.stats.avg_score ?? 0;
  const reviewed = data.stats.conversations_scored ?? 0;
  const hallucinationRate = data.stats.hallucination_rate ?? 0;
  const escalationRate = data.stats.escalation_rate ?? 0;

  const lowScoreConversations = data.conversations.filter(
    (conversation) => (conversation.quality_scores?.overall_score ?? 1) < 0.65
  );
  const safeConversations = data.conversations.filter(
    (conversation) => (conversation.quality_scores?.overall_score ?? 0) >= 0.82
  );
  const primaryPattern = data.patterns[0];

  const trendDelta =
    data.trend_data.length >= 2
      ? data.trend_data[data.trend_data.length - 1]!.overall - data.trend_data[0]!.overall
      : 0;
  const trend = trendState(trendDelta);
  const TrendIcon = trend.Icon;

  const nextMove = primaryPattern?.recommendation
    ? primaryPattern.recommendation
    : lowScoreConversations.length > 0
      ? "Review the lowest-scoring conversations first."
      : "Quality is steady. Keep the weekly review loop running.";

  if (reviewed === 0) {
    return (
      <div className="space-y-6 pb-8 animate-fade-in">
        <div className="page-header">
          <div>
            <h1 className="page-title">Overview</h1>
            <p className="page-subtitle mt-2">
              Your agent&apos;s performance at a glance
            </p>
          </div>
        </div>

        <div
          className="rounded-[6px] border border-[#E9E9E7] bg-white p-8 text-center"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
        >
          <div className="mx-auto max-w-sm">
            <div
              className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full"
              style={{ background: "#F7F7F5", border: "1px solid #E9E9E7" }}
            >
              <TrendingUp className="h-5 w-5" style={{ color: "#ACABA8" }} />
            </div>
            <h2 className="text-base font-semibold" style={{ color: "#37352F" }}>
              Waiting for scored conversations
            </h2>
            <p className="mt-2 text-sm leading-6" style={{ color: "#787774" }}>
              {data.conversations.length > 0
                ? "Conversations are arriving, but they have not produced usable scores yet."
                : "No recent conversations have landed in this workspace yet."}
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <Link href="/conversations" className="glass-button glass-button-primary text-sm">
                Open conversations
              </Link>
              <Link href="/settings" className="glass-button text-sm">
                Check setup
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8 animate-fade-in">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Overview</h1>
          <p className="page-subtitle mt-2">Your agent&apos;s performance at a glance</p>
        </div>
      </div>

      {/* Four metric cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Overall quality */}
        <div
          className="rounded-[6px] border border-[#E9E9E7] bg-white p-5"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
        >
          <p className="metric-label">Overall quality</p>
          <p
            className="metric-value mt-2"
            style={{ color: scoreAccent(avgScore), fontSize: "30px" }}
          >
            {pct(avgScore)}
          </p>
          <p className="metric-sub mt-1 flex items-center gap-1">
            <TrendIcon className="h-3.5 w-3.5" style={{ color: trend.color }} />
            <span style={{ color: trend.color }}>{trend.label}</span>
          </p>
        </div>

        {/* Conversations scored */}
        <div
          className="rounded-[6px] border border-[#E9E9E7] bg-white p-5"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
        >
          <p className="metric-label">Conversations scored</p>
          <p className="metric-value mt-2" style={{ fontSize: "30px", color: "#37352F" }}>
            {reviewed.toLocaleString()}
          </p>
          <p className="metric-sub mt-1">Total analyzed</p>
        </div>

        {/* Hallucination rate */}
        <div
          className="rounded-[6px] border border-[#E9E9E7] bg-white p-5"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
        >
          <p className="metric-label">Hallucination rate</p>
          <p
            className="metric-value mt-2"
            style={{
              fontSize: "30px",
              color: hallucinationRate > 0.1 ? "#C4342C" : hallucinationRate > 0.05 ? "#C47A00" : "#0F7B3D",
            }}
          >
            {pct(hallucinationRate)}
          </p>
          <p className="metric-sub mt-1">
            {hallucinationRate > 0.1 ? "Needs attention" : hallucinationRate > 0.05 ? "Monitor closely" : "Within target"}
          </p>
        </div>

        {/* Escalation rate */}
        <div
          className="rounded-[6px] border border-[#E9E9E7] bg-white p-5"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
        >
          <p className="metric-label">Escalation rate</p>
          <p
            className="metric-value mt-2"
            style={{
              fontSize: "30px",
              color: escalationRate > 0.15 ? "#C4342C" : escalationRate > 0.08 ? "#C47A00" : "#37352F",
            }}
          >
            {pct(escalationRate)}
          </p>
          <p className="metric-sub mt-1">
            {escalationRate > 0.15 ? "High escalation" : escalationRate > 0.08 ? "Elevated" : "Normal range"}
          </p>
        </div>
      </div>

      {/* Two-column section: top issues + trend chart */}
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        {/* Top issues */}
        <div
          className="rounded-[6px] border border-[#E9E9E7] bg-white"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
        >
          <div className="flex items-center justify-between border-b border-[#E9E9E7] px-5 py-4">
            <h2 className="text-sm font-semibold" style={{ color: "#37352F" }}>
              Top issues
            </h2>
            <Link
              href="/patterns"
              className="text-xs font-medium"
              style={{ color: "#2383E2" }}
            >
              See all →
            </Link>
          </div>

          {data.patterns.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm" style={{ color: "#787774" }}>
                No issues detected — quality looks good
              </p>
            </div>
          ) : (
            <div>
              {data.patterns.slice(0, 5).map((pattern, idx) => (
                <Link
                  key={pattern.id}
                  href="/patterns"
                  className="flex items-start gap-4 px-5 py-3 transition-colors"
                  style={{
                    borderBottom: idx < Math.min(data.patterns.length, 5) - 1 ? "1px solid #F1F1EF" : "none",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "#F7F7F5"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = ""; }}
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-sm font-medium leading-snug transition-colors"
                      style={{ color: "#37352F" }}
                    >
                      {pattern.title}
                    </p>
                    <p
                      className="mt-0.5 text-xs leading-relaxed line-clamp-1"
                      style={{ color: "#787774" }}
                    >
                      {pattern.description}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 pt-0.5">
                    <SeverityBadge severity={pattern.severity} />
                    <span className="text-xs tabular-nums" style={{ color: "#ACABA8" }}>
                      {pattern.affected_conversation_ids.length}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Quality trend chart */}
        <div
          className="rounded-[6px] border border-[#E9E9E7] bg-white p-5"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
        >
          <div className="flex items-center gap-2">
            <TrendIcon className="h-4 w-4" style={{ color: trend.color }} />
            <h2 className="text-sm font-semibold" style={{ color: "#37352F" }}>
              Quality trend
            </h2>
            <span className="ml-auto text-xs" style={{ color: trend.color }}>
              {trend.label}
            </span>
          </div>

          {data.trend_data.length === 0 ? (
            <p className="mt-8 text-center text-sm" style={{ color: "#ACABA8" }}>
              Trend data will appear once more conversations are scored.
            </p>
          ) : (
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={data.trend_data}
                  margin={{ left: -10, right: 8, top: 4, bottom: 0 }}
                >
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
                    width={38}
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
                    formatter={(value) => [`${Math.round(Number(value) * 100)}%`, "Quality"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="overall"
                    stroke="#2383E2"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: "#2383E2", stroke: "#FFFFFF", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Low-score conversations (secondary) */}
      {lowScoreConversations.length > 0 && (
        <div
          className="rounded-[6px] border border-[#E9E9E7] bg-white"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
        >
          <div className="flex items-center justify-between border-b border-[#E9E9E7] px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold" style={{ color: "#37352F" }}>
                Needs attention
              </h2>
              <p className="mt-0.5 text-xs" style={{ color: "#787774" }}>
                Conversations scoring below 65%
              </p>
            </div>
            <span
              className="rounded-[4px] px-2 py-0.5 text-xs font-medium"
              style={{ background: "#F7F7F5", color: "#787774", border: "1px solid #E9E9E7" }}
            >
              {lowScoreConversations.length}
            </span>
          </div>
          <div className="compact-list">
            {lowScoreConversations.slice(0, 4).map((conversation) => (
              <Link
                key={conversation.id}
                href={`/conversations/${conversation.id}`}
                className="compact-list-item flex items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium" style={{ color: "#37352F" }}>
                    {conversation.customer_identifier || `Conversation #${conversation.id.slice(0, 6)}`}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed" style={{ color: "#787774" }}>
                    {conversation.quality_scores?.summary || "Needs review"}
                  </p>
                </div>
                <ScoreBadge score={conversation.quality_scores?.overall_score || 0} size="sm" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
