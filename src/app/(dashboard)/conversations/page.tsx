"use client";
import { useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { ScoreBadge } from "@/components/ui/score-badge";
import { formatDate } from "@/lib/utils";
import { SEED_CONVERSATIONS } from "@/lib/db/seed-data";
import { Search, Filter } from "lucide-react";
import Link from "next/link";

export default function ConversationsPage() {
  const [search, setSearch] = useState("");
  const [scoreFilter, setScoreFilter] = useState<string>("all");

  const filtered = SEED_CONVERSATIONS.filter((c) => {
    const matchesSearch =
      !search ||
      c.customer_identifier?.toLowerCase().includes(search.toLowerCase()) ||
      c.quality_score.summary?.toLowerCase().includes(search.toLowerCase());

    const matchesScore =
      scoreFilter === "all" ||
      (scoreFilter === "critical" && c.quality_score.overall_score < 0.4) ||
      (scoreFilter === "warning" && c.quality_score.overall_score >= 0.4 && c.quality_score.overall_score < 0.7) ||
      (scoreFilter === "good" && c.quality_score.overall_score >= 0.7);

    return matchesSearch && matchesScore;
  });

  return (
    <div className="max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Conversations</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          {SEED_CONVERSATIONS.length} conversations scored
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search conversations..."
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
                  : "text-[var(--text-secondary)] hover:bg-[rgba(0,0,0,0.02)]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

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
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((conv) => (
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
                <td><ScoreBadge score={conv.quality_score.overall_score} /></td>
                <td><ScoreBadge score={conv.quality_score.accuracy_score || 0} size="sm" /></td>
                <td><ScoreBadge score={conv.quality_score.hallucination_score || 0} size="sm" /></td>
                <td><ScoreBadge score={conv.quality_score.resolution_score || 0} size="sm" /></td>
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
        {filtered.length === 0 && (
          <div className="p-12 text-center text-sm text-[var(--text-muted)]">
            No conversations match your filters.
          </div>
        )}
      </GlassCard>
    </div>
  );
}
