"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { ScoreBadge } from "@/components/ui/score-badge";
import { formatDate } from "@/lib/utils";

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

function insightLabel(conversation: ConversationRow) {
  if (!conversation.quality_scores) {
    return conversation.score_status === "waiting_for_completion" ? "Still open" : "Scoring…";
  }
  const score   = conversation.quality_scores.overall_score;
  const summary = (conversation.quality_scores.summary || "").toLowerCase();
  const flags   = conversation.quality_scores.flags || [];

  if (flags.some((f) => /escalation/i.test(f)) || /escalat/.test(summary)) return "Escalation detected";
  if (flags.some((f) => /resolution/i.test(f)) || /resolve|next step|follow-up/.test(summary)) return "Weak resolution";
  if (flags.some((f) => /ground|crm|record|source|verify/i.test(f)) || /verify|record|source|detail/.test(summary)) return "Verify claims";
  if (score < 0.5) return "Quality issue";
  if (score < 0.72) return "Needs review";
  return "Looks good";
}

function groupLabel(conversation: ConversationRow) {
  const s = conversation.quality_scores?.overall_score;
  if (s === undefined || s === null) return "Pending";
  if (s < 0.65) return "Needs attention";
  if (s < 0.82) return "Review";
  return "Healthy";
}

const GROUP_ORDER = ["Needs attention", "Review", "Pending", "Healthy"];

const RISK_COLOR: Record<string, string> = {
  "Needs attention": "text-[#EF4444]",
  "Review":          "text-[#F59E0B]",
  "Pending":         "text-[var(--text-muted)]",
  "Healthy":         "text-[#10B981]",
};

const BAR_COLOR: Record<string, string> = {
  "Needs attention": "#EF4444",
  "Review":          "#F59E0B",
  "Pending":         "rgba(255,255,255,0.15)",
  "Healthy":         "#10B981",
};

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [total, setTotal]                 = useState(0);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState("");
  const [scoreFilter, setScoreFilter]     = useState<string>("all");
  const [platform, setPlatform]           = useState<string>("all");
  const [escalated, setEscalated]         = useState<string>("all");
  const [flag, setFlag]                   = useState("");
  const [sortPreset, setSortPreset]       = useState<"review" | "risk" | "recent" | "safe">("review");
  const [showFilters, setShowFilters]     = useState(false);

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
    const scored     = conversations.filter((c) => Boolean(c.quality_scores));
    const attention  = scored.filter((c) => (c.quality_scores?.overall_score ?? 1) < 0.65);
    const pending    = conversations.filter((c) => !c.quality_scores);
    return { scored: scored.length, attention: attention.length, pending: pending.length };
  }, [conversations]);

  const sorted = useMemo(() => {
    const arr = [...conversations];
    arr.sort((a, b) => {
      const aS = a.quality_scores?.overall_score ?? -1;
      const bS = b.quality_scores?.overall_score ?? -1;
      switch (sortPreset) {
        case "risk":   return aS - bS;
        case "recent": return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "safe":   return bS - aS;
        default: {
          const aP = a.quality_scores ? 0 : 1;
          const bP = b.quality_scores ? 0 : 1;
          return aP - bP || aS - bS;
        }
      }
    });
    return arr;
  }, [conversations, sortPreset]);

  const groups = useMemo(() => {
    const g: Record<string, ConversationRow[]> = { "Needs attention": [], "Review": [], "Pending": [], "Healthy": [] };
    for (const c of sorted) g[groupLabel(c)].push(c);
    return g;
  }, [sorted]);

  return (
    <div className="space-y-5 pb-8">

      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Conversations</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-[var(--text-secondary)]">
            <span><strong className="text-[var(--text-primary)]">{total}</strong> total</span>
            {stats.attention > 0 && <span><strong className="text-[#EF4444]">{stats.attention}</strong> need attention</span>}
            {stats.pending > 0 && <span className="text-[var(--text-muted)]">{stats.pending} scoring</span>}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-static p-3">
        <div className="flex flex-wrap items-center gap-2">
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

          <div className="flex flex-wrap items-center gap-1">
            {([
              ["review",  "Review first"],
              ["risk",    "Highest risk"],
              ["recent",  "Most recent"],
              ["safe",    "Lowest risk"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSortPreset(key)}
                className={`operator-chip cursor-pointer transition-colors ${
                  sortPreset === key
                    ? "!border-[rgba(255,255,255,0.15)] !bg-[rgba(255,255,255,0.06)] !text-[var(--text-primary)] font-semibold"
                    : ""
                }`}
              >
                {label}
              </button>
            ))}
          </div>

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
              <option value="critical">Needs attention (&lt;65%)</option>
              <option value="warning">Review (65–82%)</option>
              <option value="good">Healthy (&gt;82%)</option>
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

      {/* Conversation list */}
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
                <span className="text-[10px] font-medium text-[var(--text-muted)]">
                  {items.length}
                </span>
                <div className="ml-auto h-[2px] flex-1 max-w-[80px] rounded-full bg-[rgba(255,255,255,0.04)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (items.length / Math.max(1, sorted.length)) * 100)}%`,
                      background: BAR_COLOR[groupName] || "rgba(255,255,255,0.15)",
                      opacity: 0.6,
                    }}
                  />
                </div>
              </div>

              {/* Table — NO actions column */}
              <div className="glass-static overflow-hidden">
                <div className="grid grid-cols-[minmax(0,2fr)_minmax(140px,1fr)_80px] gap-0 border-b border-[var(--divider)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  <span>Conversation</span>
                  <span>Insight</span>
                  <span>Score</span>
                </div>

                {items.map((c, idx) => (
                  <Link key={c.id} href={`/conversations/${c.id}`} className="block">
                    <div
                      className={`grid grid-cols-[minmax(0,2fr)_minmax(140px,1fr)_80px] items-center gap-0 px-4 py-2.5 hover:bg-[var(--table-row-hover)] transition-colors ${
                        idx < items.length - 1 ? "border-b border-[var(--divider)]" : ""
                      }`}
                    >
                      <div className="min-w-0 pr-4">
                        <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                          {c.customer_identifier || c.external_id || "Unknown"}
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                          {formatDate(c.created_at)}
                          {c.quality_scores?.confidence_level && ` · ${c.quality_scores.confidence_level}`}
                        </p>
                      </div>

                      <div className="pr-4 text-xs text-[var(--text-secondary)]">
                        {insightLabel(c)}
                      </div>

                      <div>
                        {c.quality_scores ? (
                          <ScoreBadge score={c.quality_scores.overall_score} size="sm" />
                        ) : (
                          <span className="text-xs text-[var(--text-muted)]">—</span>
                        )}
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
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(255,255,255,0.04)]">
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
