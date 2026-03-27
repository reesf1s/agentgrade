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

  return (
    <div className="max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Conversations</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          {loading ? "Loading..." : `${total} conversations`}
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search by customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="glass-input w-full pl-10 pr-4 py-2.5 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[var(--text-muted)]" />
          {["all", "critical", "warning", "good"].map((f) => (
            <button
              key={f}
              onClick={() => setScoreFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-all capitalize ${
                scoreFilter === f
                  ? "bg-[rgba(0,0,0,0.06)] text-[var(--text-primary)] font-medium"
                  : "text-[var(--text-secondary)] hover:bg-[rgba(0,0,0,0.03)]"
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
          placeholder="Filter by flag..."
          value={flag}
          onChange={(e) => setFlag(e.target.value)}
          className="glass-input px-3 py-2 text-sm"
        />
      </div>

      {/* Table */}
      <GlassCard className="overflow-hidden">
        <table className="glass-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Platform</th>
              <th>Overall</th>
              <th>Confidence</th>
              <th>Accuracy</th>
              <th>Hallucination</th>
              <th>Resolution</th>
              <th>Escalated</th>
              <th>Date</th>
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
                <td className="capitalize text-[var(--text-secondary)] text-sm">{conv.platform}</td>
                <td>
                  {conv.quality_scores ? (
                    <ScoreBadge score={conv.quality_scores.overall_score} />
                  ) : (
                    <span className="text-xs text-[var(--text-muted)]">Pending</span>
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
                <td className="text-xs text-[var(--text-muted)]">{formatDate(conv.created_at)}</td>
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
