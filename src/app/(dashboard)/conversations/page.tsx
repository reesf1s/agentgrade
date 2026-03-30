"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { ScoreBadge } from "@/components/ui/score-badge";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/utils";
import {
  getConversationWorkflow,
  getQueueStateMap,
  setQueueState,
  type QueueWorkflowState,
} from "@/lib/review-workflow";

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

function priorityReason(conversation: ConversationRow) {
  if (!conversation.quality_scores) {
    return conversation.score_status === "waiting_for_completion" ? "Still open" : "Scoring…";
  }
  const score   = conversation.quality_scores.overall_score;
  const summary = (conversation.quality_scores.summary || "").toLowerCase();
  const flags   = conversation.quality_scores.flags || [];

  if (flags.some((f) => /escalation/i.test(f)) || /escalat/.test(summary)) return "Escalation issue";
  if (flags.some((f) => /resolution/i.test(f)) || /resolve|next step|follow-up/.test(summary)) return "Weak resolution";
  if (flags.some((f) => /ground|crm|record|source|verify/i.test(f)) || /verify|record|source|detail/.test(summary)) return "Source check needed";
  if (score < 0.5) return "Needs review";
  if (score < 0.72) return "Quick pass";
  return "Looks safe";
}

function groupLabel(conversation: ConversationRow) {
  const s = conversation.quality_scores?.overall_score;
  if (s === undefined || s === null) return "Pending";
  if (s < 0.65) return "Review now";
  if (s < 0.82) return "Quick pass";
  return "Safe to close";
}

const GROUP_ORDER = ["Review now", "Quick pass", "Pending", "Safe to close"];

const RISK_COLOR: Record<string, string> = {
  "Review now":    "score-critical",
  "Quick pass":    "score-warning",
  "Pending":       "text-[var(--text-muted)]",
  "Safe to close": "score-good",
};

export default function ConversationsPage() {
  const [conversations, setConversations]   = useState<ConversationRow[]>([]);
  const [total, setTotal]                   = useState(0);
  const [loading, setLoading]               = useState(true);
  const [savingActionId, setSavingActionId] = useState<string | null>(null);
  const [search, setSearch]                 = useState("");
  const [scoreFilter, setScoreFilter]       = useState<string>("all");
  const [platform, setPlatform]             = useState<string>("all");
  const [escalated, setEscalated]           = useState<string>("all");
  const [flag, setFlag]                     = useState("");
  const [sortPreset, setSortPreset]         = useState<"review" | "risk" | "recent" | "confidence" | "safe">("review");
  const [queueStates, setQueueStates]       = useState<Record<string, QueueWorkflowState>>({});
  const [showFilters, setShowFilters]       = useState(false);
  const [viewMode, setViewMode]             = useState<"queue" | "all">("all");
  const { success, error }                  = useToast();

  useEffect(() => { setQueueStates(getQueueStateMap()); }, []);

  const fetchConversations = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search)               params.set("search", search);
    if (scoreFilter !== "all") params.set("score_filter", scoreFilter);
    if (platform !== "all")   params.set("platform", platform);
    if (escalated !== "all")  params.set("escalated", escalated);
    if (flag)                  params.set("flag", flag);
    params.set("limit", "50");

    fetch(`/api/conversations?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setConversations(data.conversations || []);
        setTotal((data.conversations || []).length);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search, scoreFilter, platform, escalated, flag]);

  useEffect(() => {
    const t = setTimeout(fetchConversations, 280);
    return () => clearTimeout(t);
  }, [fetchConversations]);

  useEffect(() => {
    if (loading) return;
    const shouldPoll = conversations.some(
      (c) => c.score_status === "pending" || c.score_status === "refreshing"
    );
    if (!shouldPoll) return;
    const t = setTimeout(fetchConversations, 2500);
    return () => clearTimeout(t);
  }, [conversations, loading, fetchConversations]);

  const stats = useMemo(() => {
    const scored      = conversations.filter((c) => Boolean(c.quality_scores));
    const reviewNext  = scored.filter((c) => (c.quality_scores?.overall_score ?? 1) < 0.72);
    const pending     = conversations.filter((c) => !c.quality_scores);
    const doneCount   = Object.values(queueStates).filter((v) => v === "reviewed" || v === "safe").length;
    return { scored: scored.length, reviewNext: reviewNext.length, pending: pending.length, done: doneCount };
  }, [conversations, queueStates]);

  const sorted = useMemo(() => {
    const arr = viewMode === "queue"
      ? conversations.filter((c) => {
          const wf = getConversationWorkflow(c.metadata);
          return wf?.queue_state !== "safe" && wf?.queue_state !== "reviewed";
        })
      : [...conversations];
    arr.sort((a, b) => {
      const aS = a.quality_scores?.overall_score ?? -1;
      const bS = b.quality_scores?.overall_score ?? -1;
      const aC = a.quality_scores?.confidence_level === "high" ? 2 : a.quality_scores?.confidence_level === "medium" ? 1 : 0;
      const bC = b.quality_scores?.confidence_level === "high" ? 2 : b.quality_scores?.confidence_level === "medium" ? 1 : 0;
      switch (sortPreset) {
        case "risk":       return aS - bS;
        case "recent":     return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "confidence": return aC - bC || aS - bS;
        case "safe":       return bS - aS;
        default: {
          const aP = a.quality_scores ? 0 : 1;
          const bP = b.quality_scores ? 0 : 1;
          return aP - bP || aS - bS;
        }
      }
    });
    return arr;
  }, [conversations, sortPreset, viewMode]);

  const groups = useMemo(() => {
    const g: Record<string, ConversationRow[]> = { "Review now": [], "Quick pass": [], "Pending": [], "Safe to close": [] };
    for (const c of sorted) g[groupLabel(c)].push(c);
    return g;
  }, [sorted]);

  async function updateQueueState(conversationId: string, state: QueueWorkflowState) {
    const prev = conversations;
    const prevTotal = total;

    setQueueState(conversationId, state);
    setQueueStates((cur) => ({ ...cur, [conversationId]: state }));
    setSavingActionId(conversationId);
    setConversations((cur) => cur.filter((c) => c.id !== conversationId));
    setTotal((cur) => Math.max(0, cur - 1));

    try {
      const disposition =
        state === "safe"         ? "safe"
        : state === "reviewed"   ? "ignore"
        : state === "escalated"  ? "escalate_issue"
        : state === "needs_review" ? "action_needed"
        : "watch";

      const res = await fetch(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disposition, queue_state: state }),
      });
      if (!res.ok) throw new Error("Failed");
      success(`Marked as ${state.replaceAll("_", " ")}`);
    } catch {
      setConversations(prev);
      setTotal(prevTotal);
      setQueueStates((cur) => { const n = { ...cur }; delete n[conversationId]; return n; });
      error("Could not save. Try again.");
    } finally {
      setSavingActionId(null);
    }
  }

  const highRisk = conversations.filter((c) => (c.quality_scores?.overall_score ?? 1) < 0.5).length;

  return (
    <div className="space-y-5 pb-8">

      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Conversations</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-[var(--text-secondary)]">
            <span><strong className="text-[var(--text-primary)]">{total}</strong> total</span>
            {stats.reviewNext > 0 && <span><strong className="text-score-critical">{stats.reviewNext}</strong> to review</span>}
            {highRisk > 0 && <span><strong className="text-score-critical">{highRisk}</strong> high risk</span>}
            {stats.pending > 0 && <span>{stats.pending} scoring</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-1">
          <button
            type="button"
            onClick={() => setViewMode("all")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${viewMode === "all" ? "bg-[var(--panel)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setViewMode("queue")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${viewMode === "queue" ? "bg-[var(--panel)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}
          >
            Queue
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-static p-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <label className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search customer, ID, or issue…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="glass-input w-full py-1.5 pl-8 pr-3 text-sm"
            />
          </label>

          {/* Sort presets */}
          <div className="flex flex-wrap items-center gap-1">
            {([
              ["review",     "Review first"],
              ["risk",       "Highest risk"],
              ["recent",     "Most recent"],
              ["safe",       "Lowest risk"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSortPreset(key)}
                className={`operator-chip cursor-pointer transition-colors ${
                  sortPreset === key
                    ? "!border-[var(--btn-primary-bg)] !bg-[var(--sidebar-accent-bg)] !text-[var(--sidebar-accent-fg)] font-semibold"
                    : ""
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* More filters toggle */}
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className="operator-chip cursor-pointer ml-auto"
          >
            Filters <ChevronDown className={`h-3 w-3 transition-transform ${showFilters ? "rotate-180" : ""}`} />
          </button>
        </div>

        {showFilters && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--divider)] pt-3">
            <select
              value={scoreFilter}
              onChange={(e) => setScoreFilter(e.target.value)}
              className="glass-input px-2.5 py-1.5 text-sm"
            >
              <option value="all">All scores</option>
              <option value="critical">Needs review (&lt;65%)</option>
              <option value="warning">Watch (65–82%)</option>
              <option value="good">Safe (&gt;82%)</option>
            </select>

            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="glass-input px-2.5 py-1.5 text-sm"
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
              onChange={(e) => setEscalated(e.target.value)}
              className="glass-input px-2.5 py-1.5 text-sm"
            >
              <option value="all">All escalation states</option>
              <option value="true">Escalated</option>
              <option value="false">Not escalated</option>
            </select>

            <input
              type="text"
              placeholder="Issue keyword…"
              value={flag}
              onChange={(e) => setFlag(e.target.value)}
              className="glass-input px-2.5 py-1.5 text-sm"
            />
          </div>
        )}
      </div>

      {/* Conversation table */}
      <div className="space-y-5">
        {GROUP_ORDER.map((groupName) => {
          const items = groups[groupName];
          if (!items || items.length === 0) return null;

          return (
            <section key={groupName}>
              {/* Group header */}
              <div className="mb-1.5 flex items-center gap-2">
                <span className={`section-label ${RISK_COLOR[groupName] || "text-[var(--text-muted)]"}`}>
                  {groupName}
                </span>
                <span className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                  {items.length}
                </span>
                <div className="ml-auto h-1 flex-1 max-w-[100px] rounded-full bg-[var(--surface)] overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (items.length / Math.max(1, sorted.length)) * 100)}%`, background: groupName === 'Review now' ? '#DC2626' : groupName === 'Quick pass' ? '#D97706' : groupName === 'Pending' ? '#64748B' : '#16A34A' }} />
                </div>
              </div>

              {/* Table */}
              <div className="glass-static overflow-hidden">
                {/* Column headers */}
                <div className="grid grid-cols-[minmax(0,2fr)_minmax(140px,1fr)_80px_minmax(160px,1fr)] gap-0 border-b border-[var(--border-subtle)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  <span>Conversation</span>
                  <span>Issue</span>
                  <span>Score</span>
                  <span>Actions</span>
                </div>

                {items.map((c, idx) => (
                  <Link key={c.id} href={`/conversations/${c.id}`} className="block">
                    <div
                      className={`grid grid-cols-[minmax(0,2fr)_minmax(140px,1fr)_80px_minmax(160px,1fr)] items-center gap-0 px-4 py-2.5 hover:bg-[var(--table-row-hover)] transition-colors ${
                        idx < items.length - 1 ? "border-b border-[var(--border-subtle)]" : ""
                      }`}
                    >
                      {/* Conversation */}
                      <div className="min-w-0 pr-4">
                        <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                          {c.customer_identifier || c.external_id || "Unknown"}
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                          {formatDate(c.created_at)}
                          {c.quality_scores?.confidence_level && ` · ${c.quality_scores.confidence_level}`}
                        </p>
                      </div>

                      {/* Issue */}
                      <div className="pr-4 text-xs text-[var(--text-secondary)]">
                        {priorityReason(c)}
                      </div>

                      {/* Score */}
                      <div>
                        {c.quality_scores ? (
                          <ScoreBadge score={c.quality_scores.overall_score} size="sm" />
                        ) : (
                          <span className="text-xs text-[var(--text-muted)]">—</span>
                        )}
                      </div>

                      {/* Actions */}
                      <div
                        className="flex flex-wrap gap-1"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      >
                        {(["safe", "needs_review", "escalated", "reviewed"] as const).map((state) => (
                          <button
                            key={state}
                            type="button"
                            disabled={savingActionId === c.id}
                            onClick={() => updateQueueState(c.id, state)}
                            className={`glass-button py-0.5 px-2 text-xs ${state === 'safe' ? 'hover:!border-[#16A34A] hover:!text-[#16A34A]' : state === 'escalated' ? 'hover:!border-[#DC2626] hover:!text-[#DC2626]' : ''}`}
                          >
                            {savingActionId === c.id
                              ? "···"
                              : state === "safe"         ? "Safe"
                              : state === "needs_review" ? "Action"
                              : state === "escalated"    ? "Escalate"
                              : "Ignore"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}

        {!loading && conversations.length === 0 && (
          <div className="glass-static py-16 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface)]">
              <Search className="h-4 w-4 text-[var(--text-muted)]" />
            </div>
            <p className="text-sm font-medium text-[var(--text-secondary)]">No conversations found</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Try adjusting your filters or search terms</p>
          </div>
        )}
      </div>
    </div>
  );
}
