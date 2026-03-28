"use client";
import { useState, useEffect, useCallback } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { ScoreBadge } from "@/components/ui/score-badge";
import { formatDate } from "@/lib/utils";
import { Search, Filter } from "lucide-react";
import Link from "next/link";

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
  score_status?: "pending" | "refreshing" | "ready" | "waiting_for_completion" | "waiting_for_quiet_period";
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
      .then((r) => r.json())
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
      (conversation) => conversation.score_status === "pending" || conversation.score_status === "refreshing"
    );

    if (!shouldPoll) return;

    const timer = setTimeout(fetchConversations, 2500);
    return () => clearTimeout(timer);
  }, [conversations, loading, fetchConversations]);

  return (
    <div className="max-w-6xl">
      <div className="mb-8 rounded-[1.45rem] border border-[var(--border-subtle)] bg-[var(--panel)] p-6 shadow-sm">
        <p className="enterprise-kicker">Conversations</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">Review what actually happened</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          {loading ? "Loading conversations..." : `${total} conversations available for review`}
        </p>
      </div>

      <GlassCard className="mb-6 rounded-[1.2rem] p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Filter the queue</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Find weak conversations, check a specific customer, or focus on one platform.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[250px] flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search customer or conversation..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="glass-input w-full pl-10 pr-4 py-2.5 text-sm"
          />
        </div>
        <div className="flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-2 py-1">
          <Filter className="w-4 h-4 text-[var(--text-muted)]" />
          {["all", "critical", "warning", "good"].map((f) => (
            <button
              key={f}
              onClick={() => setScoreFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-all capitalize ${
                scoreFilter === f
                  ? "bg-[var(--panel)] text-[var(--text-primary)] font-medium shadow-sm"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface)]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
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
          onChange={(e) => setEscalated(e.target.value)}
          className="glass-input px-3 py-2 text-sm"
        >
          <option value="all">All escalation states</option>
          <option value="true">Escalated</option>
          <option value="false">Not escalated</option>
        </select>
        <input
          type="text"
          placeholder="Filter by issue flag..."
          value={flag}
          onChange={(e) => setFlag(e.target.value)}
          className="glass-input px-3 py-2 text-sm"
        />
        </div>
      </GlassCard>

      {/* Table */}
      <GlassCard className="overflow-x-auto rounded-[1.2rem]">
        <table className="glass-table min-w-[980px] table-fixed">
          <thead>
            <tr>
              <th className="w-[26%]">Customer</th>
              <th className="w-[10%]">Platform</th>
              <th className="w-[9%]">Overall</th>
              <th className="w-[10%]">Confidence</th>
              <th className="w-[9%]">Accuracy</th>
              <th className="w-[11%]">Grounding</th>
              <th className="w-[10%]">Resolution</th>
              <th className="w-[8%]">Escalated</th>
              <th className="w-[11%] whitespace-nowrap text-right">Date</th>
            </tr>
          </thead>
          <tbody>
            {conversations.map((conv) => (
              <tr key={conv.id} className="cursor-pointer">
                <td>
                  <Link
                    href={`/conversations/${conv.id}`}
                    className="text-[var(--text-primary)] hover:underline font-medium"
                  >
                    {conv.customer_identifier || "Unknown"}
                  </Link>
                </td>
                <td className="truncate capitalize text-[var(--text-secondary)] text-sm">{conv.platform}</td>
                <td>
                  {conv.quality_scores ? (
                    <ScoreBadge score={conv.quality_scores.overall_score} />
                  ) : (
                    <span className="text-xs text-[var(--text-muted)]">
                      {conv.score_status === "refreshing"
                        ? "Refreshing"
                        : conv.score_status === "waiting_for_quiet_period"
                          ? "Queued"
                          : "Pending"}
                    </span>
                  )}
                </td>
                <td className="text-xs capitalize text-[var(--text-secondary)]">
                  {conv.quality_scores?.confidence_level || "—"}
                </td>
                <td>
                  {conv.quality_scores?.accuracy_score !== undefined ? (
                    <ScoreBadge score={conv.quality_scores.accuracy_score} size="sm" />
                  ) : <span className="text-xs text-[var(--text-muted)]">—</span>}
                </td>
                <td>
                  {conv.quality_scores?.hallucination_score !== undefined ? (
                    <ScoreBadge score={conv.quality_scores.hallucination_score} size="sm" />
                  ) : <span className="text-xs text-[var(--text-muted)]">—</span>}
                </td>
                <td>
                  {conv.quality_scores?.resolution_score !== undefined ? (
                    <ScoreBadge score={conv.quality_scores.resolution_score} size="sm" />
                  ) : <span className="text-xs text-[var(--text-muted)]">—</span>}
                </td>
                <td>
                  {conv.was_escalated ? (
                    <span className="text-xs score-critical font-medium">Yes</span>
                  ) : (
                    <span className="text-xs text-[var(--text-muted)]">No</span>
                  )}
                </td>
                <td className="whitespace-nowrap text-right text-xs text-[var(--text-muted)]">{formatDate(conv.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && conversations.length === 0 && (
          <div className="p-12 text-center text-sm text-[var(--text-muted)]">
            {total === 0
              ? "No conversations yet. Connect your agent to start ingesting data."
              : "No conversations match your filters."}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
