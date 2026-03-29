"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Filter, Search } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { ScoreBadge } from "@/components/ui/score-badge";
import { formatDate } from "@/lib/utils";

interface ConversationRow {
  id: string;
  customer_identifier?: string;
  external_id?: string;
  platform: string;
  was_escalated: boolean;
  created_at: string;
  quality_scores?: {
    overall_score: number;
    accuracy_score?: number;
    hallucination_score?: number;
    resolution_score?: number;
    summary?: string;
    flags?: string[];
    confidence_level?: "high" | "medium" | "low";
  } | null;
  score_status?:
    | "pending"
    | "refreshing"
    | "ready"
    | "waiting_for_completion"
    | "waiting_for_quiet_period";
}

function statusLabel(conversation: ConversationRow) {
  if (conversation.quality_scores) return conversation.quality_scores.confidence_level || "scored";
  if (conversation.score_status === "waiting_for_completion") return "waiting";
  if (conversation.score_status === "waiting_for_quiet_period") return "queued";
  if (conversation.score_status === "refreshing") return "refreshing";
  return "pending";
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [scoreFilter, setScoreFilter] = useState<string>("all");
  const [platform, setPlatform] = useState<string>("all");
  const [escalated, setEscalated] = useState<string>("all");
  const [flag, setFlag] = useState("");

  const fetchConversations = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (scoreFilter !== "all") params.set("score_filter", scoreFilter);
    if (platform !== "all") params.set("platform", platform);
    if (escalated !== "all") params.set("escalated", escalated);
    if (flag) params.set("flag", flag);
    params.set("limit", "50");

    fetch(`/api/conversations?${params}`)
      .then((response) => response.json())
      .then((data) => {
        setConversations(data.conversations || []);
        setTotal(data.total || 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search, scoreFilter, platform, escalated, flag]);

  useEffect(() => {
    const debounce = setTimeout(fetchConversations, 300);
    return () => clearTimeout(debounce);
  }, [fetchConversations]);

  useEffect(() => {
    if (loading) return;

    const shouldPoll = conversations.some(
      (conversation) =>
        conversation.score_status === "pending" || conversation.score_status === "refreshing"
    );

    if (!shouldPoll) return;

    const timer = setTimeout(fetchConversations, 2500);
    return () => clearTimeout(timer);
  }, [conversations, loading, fetchConversations]);

  const stats = useMemo(() => {
    const scored = conversations.filter((conversation) => Boolean(conversation.quality_scores));
    const low = scored.filter((conversation) => (conversation.quality_scores?.overall_score ?? 1) < 0.65);
    const pending = conversations.filter((conversation) => !conversation.quality_scores);

    return {
      scored: scored.length,
      low: low.length,
      pending: pending.length,
    };
  }, [conversations]);

  return (
    <div className="space-y-6 pb-10">
      <GlassCard className="rounded-[1.35rem] p-6 md:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="enterprise-kicker">Review queue</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.06em] text-[var(--text-primary)]">
              Review what happened, not just what the model guessed.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
              Filter the queue fast, open the conversations that need judgment, and keep low-value noise out of the way.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 lg:min-w-[24rem]">
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Visible</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">{total}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Scored</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">{stats.scored}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Pending</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">{stats.pending}</p>
            </div>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="rounded-[1.25rem] p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">Queue controls</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Search by customer, external id, or a known issue.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { id: "all", label: "All" },
                { id: "critical", label: "Needs review" },
                { id: "warning", label: "Watch" },
                { id: "good", label: "Healthy" },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setScoreFilter(item.id)}
                  className={`rounded-full px-3 py-2 text-xs font-semibold transition-all ${
                    scoreFilter === item.id
                      ? "bg-[var(--text-primary)] text-white dark:text-[#111827]"
                      : "border border-[var(--border-subtle)] bg-[var(--surface-soft)] text-[var(--text-secondary)]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,0.45fr))_minmax(0,0.7fr)]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search by customer, external id, or transcript"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="glass-input w-full py-2.5 pl-10 pr-4 text-sm"
              />
            </div>

            <label className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-3">
              <Filter className="h-4 w-4 text-[var(--text-muted)]" />
              <select
                value={platform}
                onChange={(event) => setPlatform(event.target.value)}
                className="w-full bg-transparent py-2.5 text-sm text-[var(--text-primary)] outline-none"
              >
                <option value="all">All platforms</option>
                <option value="intercom">Intercom</option>
                <option value="zendesk">Zendesk</option>
                <option value="voiceflow">Voiceflow</option>
                <option value="custom">Custom</option>
                <option value="csv">CSV / JSON</option>
              </select>
            </label>

            <select
              value={escalated}
              onChange={(event) => setEscalated(event.target.value)}
              className="glass-input px-3 py-2.5 text-sm"
            >
              <option value="all">All escalation states</option>
              <option value="true">Escalated</option>
              <option value="false">Not escalated</option>
            </select>

            <input
              type="text"
              placeholder="Filter by issue"
              value={flag}
              onChange={(event) => setFlag(event.target.value)}
              className="glass-input px-3 py-2.5 text-sm"
            />

            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-2.5 text-sm text-[var(--text-secondary)]">
              {loading ? "Loading..." : `${stats.low} need review`}
            </div>
          </div>
        </div>
      </GlassCard>

      <div className="space-y-3 lg:hidden">
        {conversations.map((conversation) => (
          <Link key={conversation.id} href={`/conversations/${conversation.id}`} className="block">
            <GlassCard className="rounded-[1.1rem] p-4">
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
                  <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-2.5 py-1 text-xs text-[var(--text-muted)]">
                    {statusLabel(conversation)}
                  </span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-2.5 py-1 text-xs text-[var(--text-secondary)] capitalize">
                  {conversation.platform}
                </span>
                <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-2.5 py-1 text-xs text-[var(--text-secondary)] capitalize">
                  {statusLabel(conversation)}
                </span>
                {conversation.was_escalated ? (
                  <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                    Escalated
                  </span>
                ) : null}
              </div>
            </GlassCard>
          </Link>
        ))}
      </div>

      <GlassCard className="hidden overflow-x-auto rounded-[1.25rem] lg:block">
        <table className="glass-table min-w-[1080px] table-fixed">
          <thead>
            <tr>
              <th className="w-[26%]">Customer</th>
              <th className="w-[9%]">Platform</th>
              <th className="w-[10%]">Overall</th>
              <th className="w-[10%]">Accuracy</th>
              <th className="w-[11%]">Hallucination</th>
              <th className="w-[10%]">Resolution</th>
              <th className="w-[10%]">Status</th>
              <th className="w-[8%]">Escalated</th>
              <th className="w-[16%] whitespace-nowrap">Date</th>
            </tr>
          </thead>
          <tbody>
            {conversations.map((conversation) => (
              <tr key={conversation.id}>
                <td>
                  <Link
                    href={`/conversations/${conversation.id}`}
                    className="block font-medium text-[var(--text-primary)] hover:underline"
                  >
                    {conversation.customer_identifier || "Unknown"}
                    {conversation.external_id ? (
                      <span className="mt-1 block truncate text-xs font-normal text-[var(--text-muted)]">
                        {conversation.external_id}
                      </span>
                    ) : null}
                  </Link>
                </td>
                <td className="capitalize text-[var(--text-secondary)]">{conversation.platform}</td>
                <td>
                  {conversation.quality_scores ? (
                    <ScoreBadge score={conversation.quality_scores.overall_score} />
                  ) : (
                    <span className="text-xs text-[var(--text-muted)]">{statusLabel(conversation)}</span>
                  )}
                </td>
                <td>
                  {conversation.quality_scores?.accuracy_score !== undefined ? (
                    <ScoreBadge score={conversation.quality_scores.accuracy_score} size="sm" />
                  ) : (
                    <span className="text-xs text-[var(--text-muted)]">—</span>
                  )}
                </td>
                <td>
                  {conversation.quality_scores?.hallucination_score !== undefined ? (
                    <ScoreBadge score={conversation.quality_scores.hallucination_score} size="sm" />
                  ) : (
                    <span className="text-xs text-[var(--text-muted)]">—</span>
                  )}
                </td>
                <td>
                  {conversation.quality_scores?.resolution_score !== undefined ? (
                    <ScoreBadge score={conversation.quality_scores.resolution_score} size="sm" />
                  ) : (
                    <span className="text-xs text-[var(--text-muted)]">—</span>
                  )}
                </td>
                <td className="capitalize text-[var(--text-secondary)]">{statusLabel(conversation)}</td>
                <td>
                  {conversation.was_escalated ? (
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Yes</span>
                  ) : (
                    <span className="text-xs text-[var(--text-muted)]">No</span>
                  )}
                </td>
                <td className="whitespace-nowrap text-[var(--text-secondary)]">{formatDate(conversation.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
}
