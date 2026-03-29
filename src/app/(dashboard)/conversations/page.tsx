"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock3, Filter, Search, ShieldCheck } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { ScoreBadge } from "@/components/ui/score-badge";
import { formatDate } from "@/lib/utils";
import { getQueueStateMap, setQueueState, type QueueWorkflowState } from "@/lib/review-workflow";

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
  if (conversation.quality_scores) return `${conversation.quality_scores.confidence_level || "scored"} confidence`;
  if (conversation.score_status === "waiting_for_completion") return "Waiting for conversation to finish";
  if (conversation.score_status === "waiting_for_quiet_period") return "Queued";
  if (conversation.score_status === "refreshing") return "Refreshing saved score";
  return "Pending";
}

function queueLabel(conversation: ConversationRow) {
  const score = conversation.quality_scores?.overall_score ?? null;
  if (score === null) return "Waiting";
  if (score < 0.5) return "High priority";
  if (score < 0.72) return "Review next";
  return "Healthy";
}

function priorityReason(conversation: ConversationRow) {
  if (!conversation.quality_scores) {
    return conversation.score_status === "waiting_for_completion"
      ? "Still open"
      : "Scoring";
  }

  const score = conversation.quality_scores.overall_score;
  const summary = (conversation.quality_scores.summary || "").toLowerCase();
  const flags = conversation.quality_scores.flags || [];

  if (flags.some((flag) => /escalation/i.test(flag)) || /escalat/.test(summary)) return "Escalation handling";
  if (flags.some((flag) => /resolution/i.test(flag)) || /resolve|next step|follow-up/.test(summary)) return "Resolution weak";
  if (flags.some((flag) => /ground|crm|record|source|verify/i.test(flag)) || /verify|record|source|detail/.test(summary)) {
    return "Needs source check";
  }
  if (score < 0.5) return "Needs review now";
  if (score < 0.72) return "Needs a quick pass";
  return "Likely safe";
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
  const [sortPreset, setSortPreset] = useState<"review" | "risk" | "recent" | "confidence" | "safe">("review");
  const [queueStates, setQueueStates] = useState<Record<string, QueueWorkflowState>>({});

  useEffect(() => {
    setQueueStates(getQueueStateMap());
  }, []);

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
    const debounce = setTimeout(fetchConversations, 280);
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
    const reviewNext = scored.filter((conversation) => (conversation.quality_scores?.overall_score ?? 1) < 0.72);
    const pending = conversations.filter((conversation) => !conversation.quality_scores);

    return {
      scored: scored.length,
      reviewNext: reviewNext.length,
      pending: pending.length,
      reviewed: Object.values(queueStates).filter((value) => value === "reviewed" || value === "safe").length,
    };
  }, [conversations, queueStates]);

  const sortedConversations = useMemo(() => {
    const sorted = [...conversations];

    sorted.sort((a, b) => {
      const aScore = a.quality_scores?.overall_score ?? -1;
      const bScore = b.quality_scores?.overall_score ?? -1;
      const aConfidence = a.quality_scores?.confidence_level === "high" ? 2 : a.quality_scores?.confidence_level === "medium" ? 1 : 0;
      const bConfidence = b.quality_scores?.confidence_level === "high" ? 2 : b.quality_scores?.confidence_level === "medium" ? 1 : 0;

      switch (sortPreset) {
        case "risk":
          return aScore - bScore;
        case "recent":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "confidence":
          return aConfidence - bConfidence || aScore - bScore;
        case "safe":
          return bScore - aScore;
        case "review":
        default: {
          const aPending = a.quality_scores ? 0 : 1;
          const bPending = b.quality_scores ? 0 : 1;
          return aPending - bPending || aScore - bScore;
        }
      }
    });

    return sorted;
  }, [conversations, sortPreset]);

  function updateQueueState(conversationId: string, state: QueueWorkflowState) {
    setQueueState(conversationId, state);
    setQueueStates((current) => ({ ...current, [conversationId]: state }));
  }

  function rowWorkflowState(conversationId: string, score?: number | null): QueueWorkflowState {
    const saved = queueStates[conversationId];
    if (saved) return saved;
    if (score === null || score === undefined) return "new";
    if (score < 0.65) return "needs_review";
    return "safe";
  }

  return (
    <div className="space-y-6 pb-10">
      <section className="glass-static rounded-[1.25rem] p-4 sm:p-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="page-eyebrow">Review queue</p>
            <h1 className="mt-2 page-title">Review inbox.</h1>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="text-[var(--text-primary)]">Visible: {total}</span>
          <span className="text-[var(--text-primary)]">Needs review: {stats.reviewNext}</span>
          <span className="text-[var(--text-primary)]">Waiting: {stats.pending}</span>
          <span className="text-[var(--text-primary)]">Processed: {stats.reviewed}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--text-secondary)]">
          <span>{stats.reviewNext} to review</span>
          <span>•</span>
          <span>{conversations.filter((conversation) => (conversation.quality_scores?.overall_score ?? 1) < 0.5).length} high risk</span>
          <span>•</span>
          <span>~{Math.max(1, stats.reviewNext)} min</span>
        </div>
        <div className="mt-3 h-1.5 rounded-full bg-[var(--surface)]">
          <div
            className="h-full rounded-full bg-[var(--text-primary)]"
            style={{ width: `${total > 0 ? Math.min(100, (stats.reviewed / total) * 100) : 0}%` }}
          />
        </div>
      </section>

      <GlassCard className="rounded-[1.2rem] p-3.5 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          {[
            ["review", "Needs review now"],
            ["risk", "Highest risk"],
            ["recent", "Most recent"],
            ["confidence", "Lowest confidence"],
            ["safe", "Likely safe"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSortPreset(key as typeof sortPreset)}
              className={`operator-chip transition-colors ${
                sortPreset === key ? "border-[var(--border-strong)] bg-[var(--panel)] text-[var(--text-primary)]" : ""
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.45fr)_repeat(3,minmax(0,0.55fr))_minmax(0,0.8fr)]">
          <label className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search by customer, external id, or issue"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="glass-input w-full py-2.5 pl-10 pr-4 text-sm"
            />
          </label>

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
            value={scoreFilter}
            onChange={(event) => setScoreFilter(event.target.value)}
            className="glass-input px-3 py-2.5 text-sm"
          >
            <option value="all">All states</option>
            <option value="critical">Needs review</option>
            <option value="warning">Watch</option>
            <option value="good">Healthy</option>
          </select>

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
        </div>
      </GlassCard>

      <div className="space-y-3">
        {sortedConversations.map((conversation) => (
          <Link key={conversation.id} href={`/conversations/${conversation.id}`} className="block">
            <div className="stack-row group">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="stack-row-meta">
                  <span className="operator-chip">
                    {rowWorkflowState(conversation.id, conversation.quality_scores?.overall_score).replaceAll("_", " ")}
                  </span>
                  <span className="operator-chip">{priorityReason(conversation)}</span>
                  <span className="operator-chip">{conversation.quality_scores?.confidence_level || "pending"}</span>
                </div>
                <div
                  className="flex flex-wrap gap-2 transition-opacity xl:opacity-0 xl:group-hover:opacity-100"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                >
                  <button type="button" className="operator-chip" onClick={() => updateQueueState(conversation.id, "reviewed")}>
                    Mark reviewed
                  </button>
                  <button type="button" className="operator-chip" onClick={() => updateQueueState(conversation.id, "safe")}>
                    Mark safe
                  </button>
                  <button type="button" className="operator-chip" onClick={() => updateQueueState(conversation.id, "escalated")}>
                    Escalate
                  </button>
                  <button type="button" className="operator-chip" onClick={() => updateQueueState(conversation.id, "snoozed")}>
                    Snooze
                  </button>
                </div>
              </div>
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.65fr)_minmax(0,0.9fr)_minmax(0,0.9fr)] xl:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-base font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                      {conversation.customer_identifier || conversation.external_id || "Unknown conversation"}
                    </p>
                    {conversation.was_escalated ? (
                      <span className="operator-chip score-bg-warning score-warning">Escalated</span>
                    ) : null}
                  </div>
                  <p className="mt-1 max-w-3xl text-sm text-[var(--text-secondary)]">
                    {conversation.quality_scores?.flags?.slice(0, 2).map((flag) => flag.replaceAll("_", " ")).join(" • ") || priorityReason(conversation)}
                  </p>
                  <div className="mt-2 stack-row-meta">
                    <span className="operator-chip capitalize">{conversation.platform}</span>
                    <span className="operator-chip">{statusLabel(conversation)}</span>
                    <span className="operator-chip">{formatDate(conversation.created_at)}</span>
                  </div>
                </div>

                <div className="metric-card px-4 py-3">
                  <p className="section-label">Priority</p>
                  <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                    {conversation.quality_scores?.overall_score !== undefined && conversation.quality_scores.overall_score < 0.5 ? (
                      <AlertTriangle className="h-4 w-4 text-score-critical" />
                    ) : conversation.quality_scores ? (
                      <ShieldCheck className="h-4 w-4 text-score-good" />
                    ) : (
                      <Clock3 className="h-4 w-4 text-[var(--text-muted)]" />
                    )}
                    <span>{queueLabel(conversation)}</span>
                  </div>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    {rowWorkflowState(conversation.id, conversation.quality_scores?.overall_score).replaceAll("_", " ")}
                  </p>
                </div>

                <div className="metric-card px-4 py-3">
                  <p className="section-label">Score</p>
                  <div className="mt-2">
                    {conversation.quality_scores ? (
                      <ScoreBadge score={conversation.quality_scores.overall_score} size="sm" />
                    ) : (
                      <span className="text-sm text-[var(--text-muted)]">Pending</span>
                    )}
                  </div>
                </div>

                <div className="metric-card px-4 py-3">
                  <p className="section-label">Next</p>
                  <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">Open review</p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">Read the transcript and make a call.</p>
                </div>
              </div>
            </div>
          </Link>
        ))}

        {!loading && conversations.length === 0 ? (
          <GlassCard className="p-10 text-center">
            <p className="text-sm text-[var(--text-muted)]">No conversations match these filters.</p>
          </GlassCard>
        ) : null}
      </div>
    </div>
  );
}
