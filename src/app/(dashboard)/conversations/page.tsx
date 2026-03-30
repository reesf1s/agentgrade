"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, Search } from "lucide-react";
import { ScoreBadge } from "@/components/ui/score-badge";
import { GlassButton } from "@/components/ui/glass-button";
import { useToast } from "@/components/ui/toast";
import type { QueueWorkflowState, ReviewDisposition } from "@/lib/review-workflow";

interface ConversationRow {
  id: string;
  customer_identifier?: string;
  external_id?: string;
  platform: string;
  was_escalated: boolean;
  created_at: string;
  metadata?: Record<string, unknown>;
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

const GROUP_ORDER = ["Review now", "Quick pass", "Healthy", "Scoring"] as const;

function insightLabel(conversation: ConversationRow) {
  if (!conversation.quality_scores) {
    return conversation.score_status === "waiting_for_completion" ? "Still open" : "Scoring";
  }

  const score = conversation.quality_scores.overall_score;
  const summary = (conversation.quality_scores.summary || "").toLowerCase();
  const flags = conversation.quality_scores.flags || [];

  if (flags.some((flag) => /escalation/i.test(flag)) || /escalat/.test(summary)) {
    return "Escalation handling";
  }
  if (flags.some((flag) => /resolution/i.test(flag)) || /resolve|next step|follow-up/.test(summary)) {
    return "Resolution weak";
  }
  if (flags.some((flag) => /ground|crm|record|source|verify/i.test(flag)) || /verify|record|source|detail/.test(summary)) {
    return "Needs source check";
  }
  if (score < 0.5) return "High risk";
  if (score < 0.72) return "Needs review";
  return "Looks healthy";
}

function groupLabel(conversation: ConversationRow) {
  const score = conversation.quality_scores?.overall_score;
  if (score === undefined || score === null) return "Scoring";
  if (score < 0.65) return "Review now";
  if (score < 0.82) return "Quick pass";
  return "Healthy";
}

function compactDate(conversation: ConversationRow) {
  const date = new Date(conversation.created_at);
  const formatted = date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const confidence = conversation.quality_scores?.confidence_level;
  return confidence ? `${formatted} · ${confidence}` : formatted;
}

function scoreSummary(conversation: ConversationRow) {
  if (!conversation.quality_scores) return "Scoring";
  const accuracy = conversation.quality_scores.accuracy_score;
  const hallucination = conversation.quality_scores.hallucination_score;
  const resolution = conversation.quality_scores.resolution_score;
  return [
    accuracy !== undefined ? `Acc ${Math.round(accuracy * 100)}` : null,
    hallucination !== undefined ? `Hall ${Math.round(hallucination * 100)}` : null,
    resolution !== undefined ? `Res ${Math.round(resolution * 100)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function queueStateFromDisposition(disposition: ReviewDisposition): QueueWorkflowState {
  switch (disposition) {
    case "safe":
      return "safe";
    case "escalate_issue":
      return "escalated";
    case "ignore":
      return "reviewed";
    case "watch":
      return "reviewed";
    case "action_needed":
    default:
      return "needs_review";
  }
}

export default function ConversationsPage() {
  const { success, error } = useToast();
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [scoreFilter, setScoreFilter] = useState<string>("all");
  const [platform, setPlatform] = useState<string>("all");
  const [escalated, setEscalated] = useState<string>("all");
  const [flag, setFlag] = useState("");
  const [sortPreset, setSortPreset] = useState<"review" | "risk" | "recent" | "safe">("review");
  const [showFilters, setShowFilters] = useState(false);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState(false);

  const fetchConversations = useCallback(() => {
    setLoading(true);
    setFetchError(false);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (scoreFilter !== "all") params.set("score_filter", scoreFilter);
    if (platform !== "all") params.set("platform", platform);
    if (escalated !== "all") params.set("escalated", escalated);
    if (flag) params.set("flag", flag);
    params.set("limit", "80");

    fetch(`/api/conversations?${params}`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        setConversations(data.conversations || []);
        setTotal(data.total || 0);
      })
      .catch(() => {
        setFetchError(true);
      })
      .finally(() => setLoading(false));
  }, [search, scoreFilter, platform, escalated, flag]);

  useEffect(() => {
    const timeout = setTimeout(fetchConversations, 260);
    return () => clearTimeout(timeout);
  }, [fetchConversations]);

  useEffect(() => {
    if (loading) return;
    const shouldPoll = conversations.some(
      (conversation) =>
        conversation.score_status === "pending" || conversation.score_status === "refreshing"
    );
    if (!shouldPoll) return;
    const timeout = setTimeout(fetchConversations, 2500);
    return () => clearTimeout(timeout);
  }, [conversations, loading, fetchConversations]);

  async function applyDisposition(conversationId: string, disposition: ReviewDisposition) {
    const removed = conversations.find((conversation) => conversation.id === conversationId);
    if (!removed) return;

    setActingOn(conversationId);
    setConversations((current) => current.filter((conversation) => conversation.id !== conversationId));

    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disposition,
          queue_state: queueStateFromDisposition(disposition),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update conversation");
      }

      success(`Marked as ${disposition.replace("_", " ")}`);
    } catch (err) {
      console.error(err);
      setConversations((current) => [removed, ...current]);
      error("Could not update review state");
    } finally {
      setActingOn(null);
    }
  }

  const stats = useMemo(() => {
    const scored = conversations.filter((conversation) => Boolean(conversation.quality_scores));
    const attention = scored.filter((conversation) => (conversation.quality_scores?.overall_score ?? 1) < 0.65);
    const quickPass = scored.filter((conversation) => {
      const score = conversation.quality_scores?.overall_score ?? 0;
      return score >= 0.65 && score < 0.82;
    });
    return {
      attention: attention.length,
      quickPass: quickPass.length,
      scoring: conversations.filter((conversation) => !conversation.quality_scores).length,
    };
  }, [conversations]);

  const sorted = useMemo(() => {
    const items = [...conversations];
    items.sort((a, b) => {
      const aScore = a.quality_scores?.overall_score ?? -1;
      const bScore = b.quality_scores?.overall_score ?? -1;
      switch (sortPreset) {
        case "risk":
          return aScore - bScore;
        case "recent":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
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
    return items;
  }, [conversations, sortPreset]);

  const groups = useMemo(() => {
    const grouped: Record<(typeof GROUP_ORDER)[number], ConversationRow[]> = {
      "Review now": [],
      "Quick pass": [],
      Healthy: [],
      Scoring: [],
    };

    for (const conversation of sorted) {
      grouped[groupLabel(conversation)].push(conversation);
    }

    return grouped;
  }, [sorted]);

  return (
    <div className="space-y-6 pb-8">
      <div className="page-header">
        <div>
          <p className="page-eyebrow mb-2">Weekly review loop</p>
          <h1 className="page-title">Review queue</h1>
          <p className="page-subtitle mt-2">
            Open what matters, clear the queue, and move on. {total} conversations loaded.
          </p>
        </div>

        <GlassButton size="sm">
          {stats.attention + stats.quickPass} worth reviewing
        </GlassButton>
      </div>

      <div className="summary-strip">
        <div className="summary-strip-item">
          <p className="value-key">Review now</p>
          <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-fg">{stats.attention}</p>
          <p className="mt-1 text-sm text-fg-secondary">Highest-value items to open first.</p>
        </div>
        <div className="summary-strip-item">
          <p className="value-key">Quick pass</p>
          <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-fg">{stats.quickPass}</p>
          <p className="mt-1 text-sm text-fg-secondary">Worth checking, but not urgent.</p>
        </div>
        <div className="summary-strip-item">
          <p className="value-key">Scoring</p>
          <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-fg">{stats.scoring}</p>
          <p className="mt-1 text-sm text-fg-secondary">Still waiting for a final assessment.</p>
        </div>
      </div>

      <div className="glass-static p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-muted" />
            <input
              type="text"
              placeholder="Search customer or conversation"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="glass-input w-full py-2.5 pl-9 pr-3 text-sm"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            {([
              ["review", "Review first"],
              ["risk", "Highest risk"],
              ["recent", "Most recent"],
              ["safe", "Lowest risk"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSortPreset(key)}
                className={`operator-chip cursor-pointer transition-colors ${
                  sortPreset === key ? "!bg-[rgba(94,106,210,0.15)] !text-[#7178E0] !border-[rgba(94,106,210,0.3)]" : ""
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowFilters((current) => !current)}
            className="operator-chip cursor-pointer lg:ml-auto"
          >
            Refine
            <ChevronDown className={`h-3 w-3 transition-transform ${showFilters ? "rotate-180" : ""}`} />
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 grid gap-3 pt-4 md:grid-cols-2 xl:grid-cols-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <select
              value={scoreFilter}
              onChange={(event) => setScoreFilter(event.target.value)}
              className="glass-input px-3 py-2 text-sm"
            >
              <option value="all">All scores</option>
              <option value="critical">Review now</option>
              <option value="warning">Quick pass</option>
              <option value="good">Healthy</option>
            </select>

            <select
              value={platform}
              onChange={(event) => setPlatform(event.target.value)}
              className="glass-input px-3 py-2 text-sm"
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
              className="glass-input px-3 py-2 text-sm"
            >
              <option value="all">All escalation states</option>
              <option value="true">Escalated</option>
              <option value="false">Not escalated</option>
            </select>

            <input
              type="text"
              placeholder="Flag keyword"
              value={flag}
              onChange={(event) => setFlag(event.target.value)}
              className="glass-input px-3 py-2 text-sm"
            />
          </div>
        )}
      </div>

      <div className="space-y-5">
        {GROUP_ORDER.map((group) => {
          const items = groups[group];
          if (!items.length) return null;

          return (
            <section key={group} className="glass-static overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-edge px-5 py-3.5">
                <div>
                  <p className="text-sm font-semibold text-fg">{group}</p>
                  <p className="text-xs text-fg-muted">{items.length} conversations</p>
                </div>
                <span className="operator-chip">
                  {group === "Review now"
                    ? "Open first"
                    : group === "Quick pass"
                      ? "Fast scan"
                      : group === "Healthy"
                        ? "Low priority"
                        : "In progress"}
                </span>
              </div>

              <div className="hidden px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-muted lg:grid lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1.2fr)_90px_220px_140px]">
                <span>Conversation</span>
                <span>Assessment</span>
                <span>Score</span>
                <span>Signals</span>
                <span>When</span>
              </div>

              {items.map((conversation) => (
                <div key={conversation.id} className="queue-table-row">
                  <div className="min-w-0">
                    <Link href={`/conversations/${conversation.id}`} className="block">
                      <p className="truncate text-sm font-semibold text-fg">
                        {conversation.customer_identifier || conversation.external_id || "Unknown"}
                      </p>
                      <p className="mt-1 text-xs text-fg-secondary">
                        {insightLabel(conversation)}
                      </p>
                    </Link>
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm text-fg-secondary">
                      {conversation.quality_scores?.summary || (conversation.score_status === "waiting_for_completion" ? "Still open" : "Scoring")}
                    </p>
                  </div>

                  <div className="lg:justify-self-start">
                    {conversation.quality_scores ? (
                      <ScoreBadge score={conversation.quality_scores.overall_score} size="sm" />
                    ) : (
                      <span className="operator-chip">Scoring</span>
                    )}
                  </div>

                  <div className="text-xs text-fg-secondary">
                    {scoreSummary(conversation)}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 lg:block">
                    <p className="text-xs text-fg-muted">{compactDate(conversation)}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <GlassButton
                        size="sm"
                        variant="ghost"
                        className="!px-2.5"
                        onClick={() => applyDisposition(conversation.id, "safe")}
                        loading={actingOn === conversation.id}
                      >
                        Safe
                      </GlassButton>
                      <GlassButton
                        size="sm"
                        variant="ghost"
                        className="!px-2.5"
                        onClick={() => applyDisposition(conversation.id, "action_needed")}
                        loading={actingOn === conversation.id}
                      >
                        Action
                      </GlassButton>
                      <GlassButton
                        size="sm"
                        variant="ghost"
                        className="!px-2.5"
                        onClick={() => applyDisposition(conversation.id, "escalate_issue")}
                        loading={actingOn === conversation.id}
                      >
                        Escalate
                      </GlassButton>
                    </div>
                  </div>
                </div>
              ))}
            </section>
          );
        })}

        {!loading && fetchError && (
          <div className="glass-static py-16 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-edge bg-surface-secondary">
              <AlertTriangle className="h-4 w-4 text-score-critical" />
            </div>
            <p className="text-sm font-medium text-fg-secondary">Could not load conversations</p>
            <p className="mt-1 text-xs text-fg-muted">Check your connection and try again.</p>
            <GlassButton size="sm" className="mt-4" onClick={fetchConversations}>
              Retry
            </GlassButton>
          </div>
        )}

        {!loading && !fetchError && conversations.length === 0 && (
          <div className="glass-static py-16 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-edge bg-surface-secondary">
              <Search className="h-4 w-4 text-fg-muted" />
            </div>
            <p className="text-sm font-medium text-fg-secondary">No conversations found</p>
            <p className="mt-1 text-xs text-fg-muted">Try a different filter or search term.</p>
          </div>
        )}

        {loading && (
          <div className="glass-static py-16 text-center">
            <p className="text-sm text-fg-muted">Loading conversations…</p>
          </div>
        )}
      </div>
    </div>
  );
}
