"use client";

import Link from "next/link";
import { ArrowRight, Minus, TrendingDown, TrendingUp } from "lucide-react";
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
  if (delta > 0.02) return { label: "Improving", Icon: TrendingUp, color: "#10B981" };
  if (delta < -0.02) return { label: "Declining", Icon: TrendingDown, color: "#EF4444" };
  return { label: "Steady", Icon: Minus, color: "#6B7280" };
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
      <div className="space-y-6 pb-8">
        <div className="page-header">
          <div>
            <p className="page-eyebrow mb-2">Weekly control tower</p>
            <h1 className="page-title">Overview</h1>
            <p className="page-subtitle mt-2">
              The workspace is live, but there are no usable scores yet.
            </p>
          </div>
        </div>

        <GlassCard elevated className="p-6 sm:p-7">
          <div className="assessment-hero">
            <div>
              <p className="page-eyebrow">Status</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-fg">
                Waiting for scored conversations
              </h2>
              <p className="mt-3 text-sm leading-6 text-fg-secondary">
                {data.conversations.length > 0
                  ? "Conversations are arriving, but they have not produced usable scores yet."
                  : "No recent conversations have landed in this workspace yet."}
              </p>
            </div>
            <div className="assessment-score-card rounded-[20px] border border-white/70 bg-white/60 p-5">
              <p className="page-eyebrow">Next step</p>
              <p className="mt-3 text-base font-semibold text-fg">
                Review incoming conversations first.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/conversations" className="glass-button glass-button-primary text-sm">
                  Open queue
                </Link>
                <Link href="/settings" className="glass-button text-sm">
                  Check setup
                </Link>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="page-header">
        <div>
          <p className="page-eyebrow mb-2">Weekly control tower</p>
          <h1 className="page-title">Overview</h1>
          <p className="page-subtitle mt-2">
            See what changed, what repeats, and what to fix next.
          </p>
        </div>
        <Link
          href="/reports"
          className="glass-button glass-button-primary inline-flex items-center gap-1.5 text-sm"
        >
          Open report
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <section className="assessment-hero">
        <GlassCard elevated className="p-6 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="space-y-4">
              <div className="token-row">
                <span className="token-pill">This week</span>
                <span className="token-pill">
                  {reviewed} reviewed
                </span>
                <span className="token-pill" style={{ color: trend.color }}>
                  <TrendIcon className="h-3.5 w-3.5" />
                  {trend.label}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-fg-secondary">Overall quality</p>
                <div className="mt-3 flex flex-wrap items-center gap-5">
                  <div
                    className="score-ring"
                    style={
                      {
                        "--ring-pct": `${Math.round(avgScore * 100)}%`,
                        "--ring-color": scoreAccent(avgScore),
                      } as React.CSSProperties
                    }
                  >
                    <div className="score-ring-label">
                      <span style={{ color: scoreAccent(avgScore) }}>{pct(avgScore)}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="assessment-title" style={{ color: scoreAccent(avgScore) }}>
                      {pct(avgScore)}
                    </p>
                    <p className="assessment-summary max-w-md">
                      {trendDelta > 0.02
                        ? "Quality is improving across recent reviews."
                        : trendDelta < -0.02
                          ? "Quality slipped this week and needs attention."
                          : "Quality is broadly stable this week."}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="assessment-score-card rounded-xl border border-edge bg-surface-secondary p-5">
              <p className="page-eyebrow">Next move</p>
              <p className="mt-2 text-base font-semibold tracking-[-0.02em] text-fg">
                {primaryPattern ? primaryPattern.title : "Keep the review queue moving"}
              </p>
              <p className="mt-2 text-sm leading-6 text-fg-secondary">
                {nextMove}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="value-block">
                  <span className="value-key">Needs review</span>
                  <span className="value-text">{lowScoreConversations.length}</span>
                </div>
                <div className="value-block">
                  <span className="value-key">Hallucination</span>
                  <span className="value-text">{pct(hallucinationRate)}</span>
                </div>
                <div className="value-block">
                  <span className="value-key">Escalation</span>
                  <span className="value-text">{pct(escalationRate)}</span>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <div className="space-y-5">
            <div>
              <p className="page-eyebrow">Top issue</p>
              {primaryPattern ? (
                <>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={primaryPattern.severity} />
                    <span className="text-sm font-medium text-fg-secondary">
                      {primaryPattern.affected_conversation_ids.length} affected
                    </span>
                  </div>
                  <p className="mt-3 text-lg font-semibold tracking-[-0.03em] text-fg">
                    {primaryPattern.title}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-fg-secondary">
                    {primaryPattern.description}
                  </p>
                  <Link
                    href="/patterns"
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-light"
                  >
                    Review issue
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </>
              ) : (
                <>
                  <p className="mt-3 text-lg font-semibold tracking-[-0.03em] text-fg">
                    No repeated issue
                  </p>
                  <p className="mt-2 text-sm leading-6 text-fg-secondary">
                    Nothing is clustering into a serious workspace-wide problem.
                  </p>
                </>
              )}
            </div>

            <div className="light-divider pt-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="value-block">
                  <span className="value-key">Safe to ignore</span>
                  <span className="value-text">
                    {safeConversations.length > 0 ? `${safeConversations.length} healthy` : "Nothing notable"}
                  </span>
                  <span className="value-muted">
                    {safeConversations.length > 0
                      ? "Strong conversations are not shaping the workspace trend."
                      : "No low-priority area needs time right now."}
                  </span>
                </div>
                <div className="value-block">
                  <span className="value-key">Review queue</span>
                  <span className="value-text">
                    {lowScoreConversations.length > 0 ? `${lowScoreConversations.length} worth opening` : "Queue is calm"}
                  </span>
                  <span className="value-muted">
                    {lowScoreConversations.length > 0
                      ? "Start with the lowest-scoring conversations."
                      : "Use the queue for spot checks rather than firefighting."}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <GlassCard className="p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="page-eyebrow">Needs action</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-fg">
                Review these first
              </h2>
            </div>
            <Link href="/conversations" className="text-sm font-semibold text-brand hover:text-brand-light">
              Open queue
            </Link>
          </div>

          <div className="mt-5 compact-list">
            {lowScoreConversations.length === 0 ? (
              <div className="empty-inline py-10">No urgent conversations right now.</div>
            ) : (
              lowScoreConversations.slice(0, 4).map((conversation) => (
                <Link
                  key={conversation.id}
                  href={`/conversations/${conversation.id}`}
                  className="compact-list-item flex items-start justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-fg">
                      {conversation.customer_identifier || `Conversation #${conversation.id.slice(0, 6)}`}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-fg-secondary">
                      {conversation.quality_scores?.summary || "Needs review"}
                    </p>
                  </div>
                  <ScoreBadge score={conversation.quality_scores?.overall_score || 0} size="sm" />
                </Link>
              ))
            )}
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <p className="page-eyebrow">Trend</p>
          <div className="mt-2 flex items-center gap-2">
            <TrendIcon className="h-4 w-4" style={{ color: trend.color }} />
            <h2 className="text-xl font-semibold tracking-[-0.03em] text-fg">
              {trend.label}
            </h2>
          </div>

          {data.trend_data.length === 0 ? (
            <p className="empty-inline mt-8">Trend data will appear once more conversations are scored.</p>
          ) : (
            <div className="mt-5 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.trend_data} margin={{ left: -10, right: 8, top: 4, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "rgba(255,255,255,0.3)" }}
                    tickFormatter={(value) => value.slice(5)}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0.3, 1]}
                    tick={{ fontSize: 11, fill: "rgba(255,255,255,0.3)" }}
                    tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
                    axisLine={false}
                    tickLine={false}
                    width={38}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(14,14,20,0.95)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "10px",
                      boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                      fontSize: 12,
                      color: "rgba(255,255,255,0.85)",
                    }}
                    formatter={(value) => [`${Math.round(Number(value) * 100)}%`, "Quality"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="overall"
                    stroke="#5E6AD2"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: "#7178E0", stroke: "rgba(255,255,255,0.2)", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
