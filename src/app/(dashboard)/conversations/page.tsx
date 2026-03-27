"use client";
import { useState, useEffect, useCallback } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { ScoreBadge } from "@/components/ui/score-badge";
import { SkeletonRow } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";
import { Search, Filter, ChevronLeft, ChevronRight, X } from "lucide-react";
import Link from "next/link";

interface ConversationRow {
  id: string;
  customer_identifier?: string;
  platform: string;
  was_escalated: boolean;
  created_at: string;
  quality_scores?: {
    overall_score: number;
    accuracy_score?: number;
    hallucination_score?: number;
    resolution_score?: number;
    flags?: string[];
  } | null;
}

const PAGE_SIZE = 25;

// Score filter → API query param mapping
const SCORE_FILTERS = [
  { id: "all",      label: "All" },
  { id: "critical", label: "Critical (<40%)" },
  { id: "warning",  label: "Warning (40-69%)" },
  { id: "good",     label: "Good (70%+)" },
];

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Filters
  const [search, setSearch] = useState("");
  const [scoreFilter, setScoreFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [escalatedFilter, setEscalatedFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const fetchConversations = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search)                params.set("search", search);
    if (scoreFilter !== "all") params.set("score_filter", scoreFilter);
    if (platformFilter !== "all") params.set("platform", platformFilter);
    if (escalatedFilter !== "all") params.set("escalated", escalatedFilter);
    if (dateFrom)              params.set("from", dateFrom);
    if (dateTo)                params.set("to", dateTo);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String((page - 1) * PAGE_SIZE));

    fetch(`/api/conversations?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setConversations(data.conversations || []);
        setTotal(data.total || 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search, scoreFilter, platformFilter, escalatedFilter, dateFrom, dateTo, page]);

  // Debounce search changes; immediate for other filters
  useEffect(() => {
    if (search) {
      const t = setTimeout(fetchConversations, 300);
      return () => clearTimeout(t);
    }
    fetchConversations();
  }, [fetchConversations, search]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, scoreFilter, platformFilter, escalatedFilter, dateFrom, dateTo]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Check whether any non-default filter is active
  const hasActiveFilters =
    scoreFilter !== "all" ||
    platformFilter !== "all" ||
    escalatedFilter !== "all" ||
    dateFrom !== "" ||
    dateTo !== "";

  function clearFilters() {
    setScoreFilter("all");
    setPlatformFilter("all");
    setEscalatedFilter("all");
    setDateFrom("");
    setDateTo("");
  }

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          Conversations
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          {loading ? "Loading…" : `${total.toLocaleString()} conversation${total !== 1 ? "s" : ""}`}
        </p>
      </div>

      {/* Search + filter bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search by customer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="glass-input w-full pl-10 pr-4 py-2.5 text-sm"
          />
        </div>

        {/* Score quick-filters */}
        <div className="hidden md:flex items-center gap-1 p-1 rounded-xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]">
          {SCORE_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setScoreFilter(f.id)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-all ${
                scoreFilter === f.id
                  ? "bg-[rgba(255,255,255,0.08)] text-[var(--text-primary)] font-medium"
                  : "text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.04)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Advanced filters toggle */}
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-all border ${
            hasActiveFilters
              ? "bg-[rgba(255,255,255,0.06)] border-[rgba(255,255,255,0.12)] text-[var(--text-primary)]"
              : "bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.06)] text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.04)]"
          }`}
        >
          <Filter className="w-4 h-4" />
          <span className="hidden sm:inline">Filters</span>
          {hasActiveFilters && (
            <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
          )}
        </button>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>

      {/* Advanced filters panel */}
      {showFilters && (
        <GlassCard className="p-4 mb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-medium text-[var(--text-secondary)] block mb-1.5">Platform</label>
              <select
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value)}
                className="glass-input w-full px-3 py-2 text-sm"
              >
                <option value="all">All platforms</option>
                <option value="intercom">Intercom</option>
                <option value="zendesk">Zendesk</option>
                <option value="freshdesk">Freshdesk</option>
                <option value="custom">Custom</option>
                <option value="csv">CSV upload</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--text-secondary)] block mb-1.5">Escalated</label>
              <select
                value={escalatedFilter}
                onChange={(e) => setEscalatedFilter(e.target.value)}
                className="glass-input w-full px-3 py-2 text-sm"
              >
                <option value="all">All</option>
                <option value="yes">Escalated only</option>
                <option value="no">Not escalated</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--text-secondary)] block mb-1.5">Date from</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="glass-input w-full px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--text-secondary)] block mb-1.5">Date to</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="glass-input w-full px-3 py-2 text-sm"
              />
            </div>
          </div>
        </GlassCard>
      )}

      {/* Table */}
      <GlassCard className="overflow-hidden">
        <table className="glass-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Platform</th>
              <th>Overall</th>
              <th>Accuracy</th>
              <th>Hallucination</th>
              <th>Resolution</th>
              <th>Escalated</th>
              <th>Issues</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={9} />)
              : conversations.map((conv) => (
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
                    <td>
                      <span className="text-xs text-[var(--text-secondary)]">
                        {conv.quality_scores?.flags && conv.quality_scores.flags.length > 0
                          ? conv.quality_scores.flags.slice(0, 2).join(", ")
                          : "—"}
                      </span>
                    </td>
                    <td className="text-xs text-[var(--text-muted)]">{formatDate(conv.created_at)}</td>
                  </tr>
                ))}
          </tbody>
        </table>

        {/* Empty state */}
        {!loading && conversations.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-sm text-[var(--text-muted)] mb-2">
              {total === 0
                ? "No conversations yet."
                : "No conversations match your filters."}
            </p>
            {total === 0 && (
              <Link
                href="/settings"
                className="text-xs text-[var(--text-secondary)] underline hover:text-[var(--text-primary)]"
              >
                Connect your agent to start ingesting data
              </Link>
            )}
            {total > 0 && (
              <button
                onClick={clearFilters}
                className="text-xs text-[var(--text-secondary)] underline hover:text-[var(--text-primary)]"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </GlassCard>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <p className="text-xs text-[var(--text-muted)]">
            Showing {Math.min((page - 1) * PAGE_SIZE + 1, total)}–{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {/* Page number pills */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              // Show pages around current page
              let p: number;
              if (totalPages <= 5) {
                p = i + 1;
              } else if (page <= 3) {
                p = i + 1;
              } else if (page >= totalPages - 2) {
                p = totalPages - 4 + i;
              } else {
                p = page - 2 + i;
              }
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`min-w-[32px] h-8 rounded-xl text-xs font-medium transition-all ${
                    p === page
                      ? "bg-[rgba(255,255,255,0.08)] text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--surface)]"
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
