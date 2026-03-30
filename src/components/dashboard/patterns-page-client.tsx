"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Check, RefreshCw, X } from "lucide-react";
import { SeverityBadge } from "@/components/ui/score-badge";
import type { FailurePattern } from "@/lib/db/types";
import { getIssueStateMap, setIssueState, type IssueWorkflowState } from "@/lib/review-workflow";

const STATE_LABELS: Record<IssueWorkflowState, string> = {
  new:        "New",
  monitoring: "Monitoring",
  actioning:  "In progress",
  quieted:    "Quieted",
  resolved:   "Resolved",
};

const STATE_COLORS: Record<string, string> = {
  New:        "border-edge bg-surface text-fg-muted",
  Monitoring: "border-amber-500/20 bg-amber-500/10 text-amber-500",
  "In progress": "border-white/12 bg-white/[0.06] text-fg",
  Quieted:    "border-edge bg-surface text-fg-muted",
  Resolved:   "border-emerald-500/20 bg-emerald-500/10 text-emerald-500",
};

function issueStateLabel(pattern: FailurePattern, saved?: IssueWorkflowState): string {
  if (saved) return STATE_LABELS[saved];
  if (pattern.is_resolved) return "Resolved";
  if (pattern.severity === "critical" || pattern.severity === "high") return "In progress";
  if (pattern.affected_conversation_ids.length >= 6) return "Monitoring";
  return "New";
}

function nextAction(pattern: FailurePattern) {
  return (
    pattern.recommendation ||
    pattern.prompt_fix ||
    pattern.knowledge_base_suggestion ||
    "Review examples and decide: prompt, workflow, or knowledge base coverage."
  );
}

export function PatternsPageClient({ initialPatterns }: { initialPatterns: FailurePattern[] }) {
  const [patterns, setPatterns]           = useState(initialPatterns);
  const [resolving, setResolving]         = useState<string | null>(null);
  const [refreshing, setRefreshing]       = useState(false);
  const [selectedPattern, setSelectedPattern] = useState<FailurePattern | null>(null);
  const [issueStates, setIssueStates]     = useState<Record<string, IssueWorkflowState>>({});

  useEffect(() => { setIssueStates(getIssueStateMap()); }, []);

  function updateState(id: string, state: IssueWorkflowState) {
    setIssueState(id, state);
    setIssueStates((cur) => ({ ...cur, [id]: state }));
  }

  async function resolvePattern(id: string) {
    setResolving(id);
    try {
      const res = await fetch(`/api/patterns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_resolved: true }),
      });
      if (res.ok) setPatterns((cur) => cur.filter((p) => p.id !== id));
    } finally {
      setResolving(null);
    }
  }

  async function refreshPatterns() {
    setRefreshing(true);
    try {
      await fetch("/api/patterns", { method: "POST" });
      window.location.reload();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="space-y-5 pb-8">

      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Issues</h1>
          <p className="mt-1 text-sm text-fg-secondary">
            Recurring failure patterns detected across conversations
          </p>
        </div>
        <button
          type="button"
          onClick={refreshPatterns}
          disabled={refreshing}
          className="glass-button inline-flex items-center gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {patterns.length === 0 ? (
        <div className="glass-static py-12 text-center">
          <p className="text-sm text-fg-muted">No issues detected this week.</p>
        </div>
      ) : (
        <div className="glass-static overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[minmax(0,2fr)_100px_80px_100px_minmax(160px,1fr)] gap-0 border-b border-edge px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
            <span>Issue</span>
            <span>Severity</span>
            <span>Volume</span>
            <span>Status</span>
            <span>Actions</span>
          </div>

          {patterns.map((pattern, idx) => {
            const stateLabel = issueStateLabel(pattern, issueStates[pattern.id]);
            const stateStyle = STATE_COLORS[stateLabel] || STATE_COLORS["New"];

            return (
              <div
                key={pattern.id}
                className={`grid grid-cols-[minmax(0,2fr)_100px_80px_100px_minmax(160px,1fr)] items-start gap-0 px-4 py-3 hover:bg-surface-hover transition-colors ${
                  idx < patterns.length - 1 ? "border-b border-edge" : ""
                }`}
              >
                {/* Title + description */}
                <div className="min-w-0 pr-6">
                  <button
                    type="button"
                    className="text-left text-sm font-semibold text-fg hover:text-[var(--btn-primary-bg)] transition-colors"
                    onClick={() => setSelectedPattern(pattern)}
                  >
                    {pattern.title}
                  </button>
                  <p className="mt-0.5 text-xs text-fg-secondary line-clamp-2 leading-relaxed">
                    {pattern.description}
                  </p>
                  <p className="mt-1 text-xs font-medium text-fg">
                    → {nextAction(pattern)}
                  </p>
                </div>

                {/* Severity */}
                <div className="pt-0.5">
                  <SeverityBadge severity={pattern.severity} />
                </div>

                {/* Volume */}
                <div className="pt-0.5 text-sm font-medium text-fg">
                  {pattern.affected_conversation_ids.length}
                  <span className="ml-1 text-xs text-fg-muted">convs</span>
                </div>

                {/* Status */}
                <div className="pt-0.5">
                  <select
                    value={issueStates[pattern.id] || ""}
                    onChange={(e) => updateState(pattern.id, e.target.value as IssueWorkflowState)}
                    className={`rounded-md border px-2 py-0.5 text-xs font-medium cursor-pointer ${stateStyle}`}
                  >
                    <option value="new">New</option>
                    <option value="monitoring">Monitoring</option>
                    <option value="actioning">In progress</option>
                    <option value="quieted">Quieted</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <button
                    type="button"
                    className="glass-button py-0.5 px-2 text-xs"
                    onClick={() => setSelectedPattern(pattern)}
                  >
                    Details
                  </button>
                  <button
                    type="button"
                    className="glass-button py-0.5 px-2 text-xs"
                    onClick={() => updateState(pattern.id, "actioning")}
                  >
                    Track fix
                  </button>
                  <button
                    type="button"
                    disabled={resolving === pattern.id}
                    className="glass-button glass-button-primary py-0.5 px-2 text-xs inline-flex items-center gap-1"
                    onClick={() => resolvePattern(pattern.id)}
                  >
                    <Check className="h-3 w-3" />
                    {resolving === pattern.id ? "…" : "Resolve"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail drawer */}
      {selectedPattern && (
        <>
          <button
            type="button"
            aria-label="Close"
            className="drawer-backdrop"
            onClick={() => setSelectedPattern(null)}
          />
          <aside className="drawer-panel">
            <div className="drawer-header">
              <div className="min-w-0">
                <p className="page-eyebrow">Issue detail</p>
                <h2 className="mt-1.5 text-lg font-semibold tracking-[-0.03em] text-fg">
                  {selectedPattern.title}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <SeverityBadge severity={selectedPattern.severity} />
                  <span className="operator-chip">
                    {issueStateLabel(selectedPattern, issueStates[selectedPattern.id])}
                  </span>
                  <span className="operator-chip">
                    {selectedPattern.affected_conversation_ids.length} affected
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPattern(null)}
                className="glass-button py-1 px-2 text-xs inline-flex items-center gap-1 shrink-0"
              >
                <X className="h-3.5 w-3.5" />
                Close
              </button>
            </div>

            <div className="drawer-body space-y-4">
              <div className="compact-list-item">
                <p className="section-label mb-2">What is happening</p>
                <p className="text-sm leading-relaxed text-fg-secondary">
                  {selectedPattern.description}
                </p>
              </div>

              <div className="compact-list-item">
                <p className="section-label mb-2">Recommended action</p>
                <p className="text-sm font-medium text-fg">
                  {nextAction(selectedPattern)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="glass-button py-1 px-2.5 text-xs"
                    onClick={() => updateState(selectedPattern.id, "actioning")}
                  >
                    Track fix
                  </button>
                  <button
                    type="button"
                    className="glass-button py-1 px-2.5 text-xs"
                    onClick={() => updateState(selectedPattern.id, "quieted")}
                  >
                    Recheck next week
                  </button>
                  <button
                    type="button"
                    className="glass-button glass-button-primary py-1 px-2.5 text-xs"
                    onClick={() => updateState(selectedPattern.id, "resolved")}
                  >
                    Mark resolved
                  </button>
                </div>
              </div>

              <div className="compact-list-item">
                <p className="section-label mb-2">Affected conversations</p>
                <div className="space-y-1">
                  {selectedPattern.affected_conversation_ids.slice(0, 8).map((id) => (
                    <Link
                      key={id}
                      href={`/conversations/${id}`}
                      className="flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm hover:bg-surface-hover transition-colors"
                      onClick={() => setSelectedPattern(null)}
                    >
                      <span className="font-mono text-xs text-fg-secondary">{id.slice(0, 12)}…</span>
                      <ArrowRight className="h-3.5 w-3.5 text-fg-muted" />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
