"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  ShieldAlert,
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
import { GlassCard } from "@/components/ui/glass-card";
import { ScoreBadge, SeverityBadge } from "@/components/ui/score-badge";
import { formatDate, scoreColor } from "@/lib/utils";
import type { DashboardData } from "@/lib/dashboard-data";

function percentage(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function DashboardPageClient({ data }: { data: DashboardData }) {
  const avgScore = data.stats.avg_score ?? 0;
  const reviewed = data.stats.conversations_scored ?? 0;
  const groundingRate = data.stats.hallucination_rate ?? 0;
  const escalationRate = data.stats.escalation_rate ?? 0;
  const attentionCount = data.conversations.filter(
    (conversation) => (conversation.quality_scores?.overall_score ?? 1) < 0.65
  ).length;
  const trustState =
    avgScore >= 0.8 ? "Stable" : avgScore >= 0.68 ? "Watching" : "Needs intervention";
  const primaryPattern = data.patterns[0];
  const primaryAlert = data.alerts[0];
  const recentConversation = data.conversations[0];

  return (
    <div className="space-y-6 pb-10">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.9fr)]">
        <GlassCard className="rounded-[1.35rem] p-6 md:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="enterprise-kicker">Overview</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.06em] text-[var(--text-primary)] md:text-[2.5rem]">
                Know which conversations need attention and what to improve next.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
                AgentGrade gives you a clean review loop: watch quality, inspect what changed, and turn repeated mistakes into focused fixes.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/conversations" className="glass-button glass-button-primary inline-flex items-center gap-2">
                Open review queue
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/settings" className="glass-button inline-flex items-center gap-2">
                Configure workspace
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Quality</p>
              <div className="mt-3 flex items-end gap-2">
                <span className={`text-3xl font-semibold tracking-[-0.05em] ${scoreColor(avgScore)}`}>
                  {percentage(avgScore)}
                </span>
                <span className="mb-1 text-xs text-[var(--text-secondary)]">{trustState}</span>
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Reviewed</p>
              <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[var(--text-primary)]">{reviewed}</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">Scored in the last 30 days</p>
            </div>
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Attention</p>
              <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[var(--text-primary)]">{attentionCount}</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">Conversations worth reviewing next</p>
            </div>
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Status</p>
              <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Tracking live
              </div>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">Fresh scores and trends are flowing</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="rounded-[1.35rem] p-6">
          <div className="flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-[var(--text-secondary)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Today&apos;s focus</h2>
          </div>

          <div className="mt-4 space-y-3">
            {primaryPattern ? (
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{primaryPattern.title}</p>
                  <SeverityBadge severity={primaryPattern.severity} />
                </div>
                <p className="text-sm leading-6 text-[var(--text-secondary)]">{primaryPattern.description}</p>
                <Link href="/patterns" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                  Open issue
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : primaryAlert ? (
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-4">
                <p className="text-sm font-semibold text-[var(--text-primary)]">{primaryAlert.title}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{primaryAlert.description}</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-soft)] p-4">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Nothing urgent is surfacing right now.</p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                  Keep an eye on the review queue and connect more conversations if you want richer insights.
                </p>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--panel-subtle)] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                  Evidence watch
                </p>
                <p className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{percentage(groundingRate)}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                  Of recent conversations still need evidence review.
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--panel-subtle)] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                  Escalations
                </p>
                <p className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{percentage(escalationRate)}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                  Needed a human handoff in the same window.
                </p>
              </div>
            </div>
          </div>
        </GlassCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.9fr)]">
        <GlassCard className="rounded-[1.25rem] p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="enterprise-section-title">Trend</p>
              <h2 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">Quality over time</h2>
            </div>
            <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
              Last 30 days
            </span>
          </div>

          {data.trend_data.length === 0 ? (
            <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-soft)] text-sm text-[var(--text-muted)]">
              Ingest conversations to start seeing quality trends.
            </div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.trend_data}>
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
                    formatter={(value) => [`${Math.round(Number(value) * 100)}%`, "Quality"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="overall"
                    stroke="var(--text-primary)"
                    strokeWidth={2.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </GlassCard>

        <div className="space-y-4">
          <GlassCard className="rounded-[1.25rem] p-5">
            <div className="mb-4 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-[var(--text-secondary)]" />
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Issues worth fixing</h2>
            </div>
            {data.patterns.length === 0 ? (
              <p className="text-sm leading-6 text-[var(--text-secondary)]">
                No repeated issue is standing out yet.
              </p>
            ) : (
              <div className="space-y-3">
                {data.patterns.slice(0, 3).map((pattern) => (
                  <Link
                    key={pattern.id}
                    href="/patterns"
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
              <TrendingUp className="h-4 w-4 text-[var(--text-secondary)]" />
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Most recent review</h2>
            </div>
            {recentConversation ? (
              <Link
                href={`/conversations/${recentConversation.id}`}
                className="block rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                      {recentConversation.customer_identifier || "Unknown"}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">
                      {recentConversation.platform} · {formatDate(recentConversation.created_at)}
                    </p>
                  </div>
                  {recentConversation.quality_scores ? (
                    <ScoreBadge score={recentConversation.quality_scores.overall_score} size="sm" />
                  ) : (
                    <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--panel)] px-2.5 py-1 text-xs text-[var(--text-muted)]">
                      Pending
                    </span>
                  )}
                </div>
              </Link>
            ) : (
              <p className="text-sm leading-6 text-[var(--text-secondary)]">
                No recent conversations yet.
              </p>
            )}
          </GlassCard>
        </div>
      </section>

      <GlassCard className="rounded-[1.25rem] p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="enterprise-section-title">Review queue</p>
            <h2 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">Recent conversations</h2>
          </div>
          <Link href="/conversations" className="text-sm font-medium text-[var(--text-primary)]">
            Open queue
          </Link>
        </div>

        {data.conversations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-soft)] p-10 text-center text-sm text-[var(--text-muted)]">
            Connect an assistant to start reviewing conversations.
          </div>
        ) : (
          <>
            <div className="space-y-3 lg:hidden">
              {data.conversations.slice(0, 6).map((conversation) => (
                <Link
                  key={conversation.id}
                  href={`/conversations/${conversation.id}`}
                  className="block rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                        {conversation.customer_identifier || "Unknown"}
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        {conversation.platform} · {formatDate(conversation.created_at)}
                      </p>
                    </div>
                    {conversation.quality_scores ? (
                      <ScoreBadge score={conversation.quality_scores.overall_score} size="sm" />
                    ) : (
                      <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--panel)] px-2.5 py-1 text-xs text-[var(--text-muted)]">
                        Pending
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="glass-table min-w-[860px]">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Platform</th>
                    <th>Overall</th>
                    <th>Escalated</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.conversations.slice(0, 10).map((conversation) => (
                    <tr key={conversation.id}>
                      <td>
                        <Link href={`/conversations/${conversation.id}`} className="font-medium text-[var(--text-primary)] hover:underline">
                          {conversation.customer_identifier || "Unknown"}
                        </Link>
                      </td>
                      <td className="capitalize text-[var(--text-secondary)]">{conversation.platform}</td>
                      <td>
                        {conversation.quality_scores ? (
                          <ScoreBadge score={conversation.quality_scores.overall_score} />
                        ) : (
                          <span className="text-xs text-[var(--text-muted)]">Pending</span>
                        )}
                      </td>
                      <td>
                        {conversation.was_escalated ? (
                          <span className="inline-flex items-center gap-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Yes
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            No
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-[var(--text-secondary)]">
                        {formatDate(conversation.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </GlassCard>
    </div>
  );
}
