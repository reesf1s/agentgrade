"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, Search } from "lucide-react";
import { ScoreBadge } from "@/components/ui/score-badge";

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

const GROUP_ORDER = ["Needs attention", "Average", "Good", "Pending"] as const;

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

function groupLabel(conversation: ConversationRow): (typeof GROUP_ORDER)[number] {
  const score = conversation.quality_scores?.overall_score;
  if (score === undefined || score === null) return "Pending";
  if (score < 0.65) return "Needs attention";
  if (score < 0.82) return "Average";
  return "Good";
}

function compactDate(conversation: ConversationRow) {
  const date = new Date(conversation.created_at);
  const formatted = date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const confidence = conversation.quality_scores?.confidence_level;
  return confidence ? `${formatted} · ${confidence}` : formatted;
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
  const [sortPreset, setSortPreset] = useState<"review" | "risk" | "recent" | "safe">("review");
  const [showFilters, setShowFilters] = useState(false);
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
      "Needs attention": [],
      Average: [],
      Good: [],
      Pending: [],
    };

    for (const conversation of sorted) {
      grouped[groupLabel(conversation)].push(conversation);
    }

    return grouped;
  }, [sorted]);

  return (
    <div className="space-y-5 pb-8">
      {/* Page header */}
      <div className="pt-1">
        <h1 className="text-xl font-semibold text-[#37352F]">Conversations</h1>
        <p className="mt-1 text-sm text-[#787774]">
          {total.toLocaleString()} conversations · search and filter to investigate issues
        </p>
      </div>

      {/* Filter bar */}
      <div className="rounded-[6px] border border-[#E9E9E7] bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#ACABA8]" />
            <input
              type="text"
              placeholder="Search customer or conversation"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-[6px] border border-[#E9E9E7] bg-white py-2 pl-9 pr-3 text-sm text-[#37352F] placeholder-[#ACABA8] outline-none transition-colors focus:border-[#2383E2]"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            {([
              ["review", "Lowest quality"],
              ["risk", "Highest risk"],
              ["recent", "Most recent"],
              ["safe", "Best first"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSortPreset(key)}
                className={`inline-flex items-center gap-1.5 rounded-[4px] border px-2.5 py-1 text-xs font-medium transition-colors ${
                  sortPreset === key
                    ? "!bg-[rgba(35,131,226,0.08)] !text-[#2383E2] !border-[rgba(35,131,226,0.2)]"
                    : "border-[#E9E9E7] bg-white text-[#787774] hover:bg-[#F1F1EF]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowFilters((current) => !current)}
            className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#E9E9E7] bg-white px-2.5 py-1 text-xs font-medium text-[#787774] transition-colors hover:bg-[#F1F1EF] lg:ml-auto"
          >
            Refine
            <ChevronDown className={`h-3 w-3 transition-transform ${showFilters ? "rotate-180" : ""}`} />
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 grid gap-3 border-t border-[#E9E9E7] pt-4 md:grid-cols-2 xl:grid-cols-4">
            <select
              value={scoreFilter}
              onChange={(event) => setScoreFilter(event.target.value)}
              className="rounded-[6px] border border-[#E9E9E7] bg-white px-3 py-2 text-sm text-[#37352F] outline-none focus:border-[#2383E2]"
            >
              <option value="all">All scores</option>
              <option value="critical">Needs attention</option>
              <option value="warning">Average</option>
              <option value="good">Good</option>
            </select>

            <select
              value={platform}
              onChange={(event) => setPlatform(event.target.value)}
              className="rounded-[6px] border border-[#E9E9E7] bg-white px-3 py-2 text-sm text-[#37352F] outline-none focus:border-[#2383E2]"
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
              className="rounded-[6px] border border-[#E9E9E7] bg-white px-3 py-2 text-sm text-[#37352F] outline-none focus:border-[#2383E2]"
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
              className="rounded-[6px] border border-[#E9E9E7] bg-white px-3 py-2 text-sm text-[#37352F] placeholder-[#ACABA8] outline-none focus:border-[#2383E2]"
            />
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="rounded-[6px] border border-[#E9E9E7] bg-white py-16 text-center">
          <p className="text-sm text-[#ACABA8]">Loading conversations…</p>
        </div>
      )}

      {/* Error */}
      {!loading && fetchError && (
        <div className="rounded-[6px] border border-[#E9E9E7] bg-white py-16 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#FEF2F2]">
            <AlertTriangle className="h-4 w-4 text-[#C4342C]" />
          </div>
          <p className="text-sm font-medium text-[#37352F]">Could not load conversations</p>
          <p className="mt-1 text-xs text-[#787774]">Check your connection and try again.</p>
          <button
            type="button"
            onClick={fetchConversations}
            className="mt-4 rounded-[6px] border border-[#E9E9E7] bg-white px-3 py-1.5 text-sm font-medium text-[#37352F] transition-colors hover:bg-[#F1F1EF]"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty */}
      {!loading && !fetchError && conversations.length === 0 && (
        <div className="rounded-[6px] border border-[#E9E9E7] bg-white py-16 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#F7F7F5]">
            <Search className="h-4 w-4 text-[#ACABA8]" />
          </div>
          <p className="text-sm font-medium text-[#37352F]">No conversations found</p>
          <p className="mt-1 text-xs text-[#787774]">Try a different filter or search term.</p>
        </div>
      )}

      {/* Grouped tables */}
      {!loading && !fetchError && conversations.length > 0 && (
        <div className="space-y-5">
          {GROUP_ORDER.map((group) => {
            const items = groups[group];
            if (!items.length) return null;

            return (
              <section key={group} className="overflow-hidden rounded-[6px] border border-[#E9E9E7] bg-white">
                {/* Group header */}
                <div className="flex items-center gap-2 border-b border-[#E9E9E7] bg-[#F7F7F5] px-4 py-2.5">
                  <span className="text-[13px] font-semibold text-[#37352F]">{group}</span>
                  <span className="text-[12px] text-[#ACABA8]">· {items.length}</span>
                </div>

                {/* Table header */}
                <div className="hidden border-b border-[#E9E9E7] bg-[#F7F7F5] lg:grid lg:grid-cols-[minmax(0,1fr)_100px_160px_120px] lg:px-4 lg:py-2.5">
                  <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#ACABA8]">Conversation</span>
                  <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#ACABA8]">Score</span>
                  <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#ACABA8]">Flags</span>
                  <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#ACABA8]">Date</span>
                </div>

                {/* Rows */}
                {items.map((conversation, index) => (
                  <Link
                    key={conversation.id}
                    href={`/conversations/${conversation.id}`}
                    className={`flex cursor-pointer flex-col gap-2 px-4 py-3 transition-colors hover:bg-[#F7F7F5] lg:grid lg:grid-cols-[minmax(0,1fr)_100px_160px_120px] lg:items-center ${
                      index < items.length - 1 ? "border-b border-[#F1F1EF]" : ""
                    }`}
                  >
                    {/* Conversation identity */}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#37352F]">
                        {conversation.customer_identifier || conversation.external_id || "Unknown"}
                      </p>
                      <p className="mt-0.5 text-xs text-[#787774]">
                        {insightLabel(conversation)}
                      </p>
                    </div>

                    {/* Score */}
                    <div>
                      {conversation.quality_scores ? (
                        <ScoreBadge score={conversation.quality_scores.overall_score} size="sm" />
                      ) : (
                        <span className="inline-flex items-center rounded-[4px] bg-[#F1F1EF] px-1.5 py-0.5 text-[10px] text-[#787774]">
                          Scoring
                        </span>
                      )}
                    </div>

                    {/* Flags */}
                    <div className="flex flex-wrap gap-1">
                      {conversation.quality_scores?.flags?.length ? (
                        conversation.quality_scores.flags.slice(0, 3).map((f) => (
                          <span
                            key={f}
                            className="max-w-[140px] truncate rounded-[4px] bg-[#F1F1EF] px-1.5 py-0.5 text-[10px] text-[#787774]"
                          >
                            {f}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-[#ACABA8]">—</span>
                      )}
                    </div>

                    {/* Date */}
                    <div>
                      <span className="text-xs text-[#787774]">{compactDate(conversation)}</span>
                    </div>
                  </Link>
                ))}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
