"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Filter, Search } from "lucide-react";
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
  if (conversation.score_status === "waiting_for_completion") return "Waiting to close";
  if (conversation.score_status === "waiting_for_quiet_period") return "Queued";
  if (conversation.score_status === "refreshing") return "Refreshing";
  return "Pending";
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
  if (score < 0.5) return "Needs review";
  if (score < 0.72) return "Quick pass";
  return "Likely safe";
}

function groupLabel(conversation: ConversationRow) {
  const score = conversation.quality_scores?.overall_score;
  if (score === undefined || score === null) return "Quick pass";
  if (score < 0.65) return "Review now";
  if (score < 0.82) return "Quick pass";
  return "Safe to close";
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

  const groupedConversations = useMemo(() => {
    const groups: Record<string, ConversationRow[]> = {
      "Review now": [],
      "Quick pass": [],
      "Safe to close": [],
    };

    for (const conversation of sortedConversations) {
      groups[groupLabel(conversation)].push(conversation);
    }

    return groups;
  }, [sortedConversations]);

  function updateQueueState(conversationId: string, state: QueueWorkflowState) {
    setQueueState(conversationId, state);
    setQueueStates((current) => ({ ...current, [conversationId]: state }));
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
          <span className="text-[var(--text-primary)]">Review: {stats.reviewNext}</span>
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

      <section className="space-y-3 border-b border-[var(--divider)] pb-4">
        <div className="flex flex-wrap items-center gap-2">
          {[
            ["review", "Review now"],
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

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.8fr)_minmax(180px,0.7fr)_minmax(160px,0.7fr)]">
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

          <select
            value={scoreFilter}
            onChange={(event) => setScoreFilter(event.target.value)}
            className="glass-input px-3 py-2.5 text-sm"
          >
            <option value="all">Review now</option>
            <option value="critical">Needs review</option>
            <option value="warning">Watch</option>
            <option value="good">Likely safe</option>
          </select>

          <details className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-3 py-2.5">
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
              <Filter className="h-4 w-4 text-[var(--text-muted)]" />
              Refine
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <select
                value={platform}
                onChange={(event) => setPlatform(event.target.value)}
                className="glass-input px-3 py-2.5 text-sm"
              >
                <option value="all">All platforms</option>
                <option value="intercom">Intercom</option>
                <option value="zendesk">Zendesk</option>
                <option value="voiceflow">Voiceflow</option>
                <option value="custom">Custom</option>
                <option value="csv">CSV / JSON</option>
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
                placeholder="Issue"
                value={flag}
                onChange={(event) => setFlag(event.target.value)}
                className="glass-input px-3 py-2.5 text-sm sm:col-span-2"
              />
            </div>
          </details>
        </div>
      </section>

      <div className="space-y-6">
        {Object.entries(groupedConversations).map(([groupName, items]) =>
          items.length > 0 ? (
            <section key={groupName} className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">{groupName}</h2>
                <span className="text-xs text-[var(--text-muted)]">{items.length}</span>
              </div>

              <div className="space-y-1">
                {items.map((conversation) => (
                  <Link key={conversation.id} href={`/conversations/${conversation.id}`} className="block">
                    <div className="stack-row group">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                            {conversation.customer_identifier || conversation.external_id || "Unknown conversation"}
                          </p>
                          <p className="mt-1 text-sm text-[var(--text-secondary)]">
                            {priorityReason(conversation)}
                          </p>
                          <p className="mt-1 text-sm text-[var(--text-secondary)]">
                            {formatDate(conversation.created_at)} · {conversation.quality_scores?.confidence_level || "pending"} confidence
                          </p>
                          <p className="mt-1 text-xs text-[var(--text-muted)]">{statusLabel(conversation)}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="operator-chip">{conversation.quality_scores?.confidence_level || "pending"}</span>
                          {conversation.quality_scores ? <ScoreBadge score={conversation.quality_scores.overall_score} size="sm" /> : null}
                        </div>
                      </div>

                      <div
                        className="mt-2 flex flex-wrap gap-2 transition-opacity xl:opacity-0 xl:group-hover:opacity-100"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                      >
                        <button type="button" className="operator-chip" onClick={() => updateQueueState(conversation.id, "safe")}>
                          Safe
                        </button>
                        <button type="button" className="operator-chip" onClick={() => updateQueueState(conversation.id, "needs_review")}>
                          Watch
                        </button>
                        <button type="button" className="operator-chip" onClick={() => updateQueueState(conversation.id, "escalated")}>
                          Escalate
                        </button>
                        <button type="button" className="operator-chip" onClick={() => updateQueueState(conversation.id, "snoozed")}>
                          Snooze
                        </button>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null
        )}

        {!loading && conversations.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-[var(--text-muted)]">No conversations match these filters.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
