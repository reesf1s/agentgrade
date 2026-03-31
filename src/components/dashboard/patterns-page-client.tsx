"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Check, RefreshCw, X } from "lucide-react";
import { SeverityBadge } from "@/components/ui/score-badge";
import { useToast } from "@/components/ui/toast";
import type { FailurePattern } from "@/lib/db/types";
import { ISSUE_WORKFLOW_STATES, type IssueWorkflowState } from "@/lib/review-workflow";

const STATE_LABELS: Record<IssueWorkflowState, string> = {
  new:        "New",
  monitoring: "Monitoring",
  actioning:  "In progress",
  quieted:    "Quieted",
  resolved:   "Resolved",
};

const STATE_COLORS: Record<string, string> = {
  New:           "border-[#E9E9E7] bg-[#F7F7F5] text-[#787774]",
  Monitoring:    "border-[rgba(196,122,0,0.2)] bg-[rgba(196,122,0,0.08)] text-[#C47A00]",
  "In progress": "border-[rgba(35,131,226,0.2)] bg-[rgba(35,131,226,0.08)] text-[#2383E2]",
  Quieted:       "border-[#E9E9E7] bg-[#F7F7F5] text-[#ACABA8]",
  Resolved:      "border-[rgba(15,123,61,0.2)] bg-[rgba(15,123,61,0.08)] text-[#0F7B3D]",
};

function issueStateLabel(pattern: FailurePattern): string {
  if (pattern.is_resolved) return "Resolved";
  return STATE_LABELS[pattern.workflow_state] || "New";
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
  const { success, error } = useToast();
  const [patterns, setPatterns]               = useState(initialPatterns);
  const [resolving, setResolving]             = useState<string | null>(null);
  const [refreshing, setRefreshing]           = useState(false);
  const [selectedPattern, setSelectedPattern] = useState<FailurePattern | null>(null);
  const [stateSaving, setStateSaving]         = useState<string | null>(null);

  useEffect(() => {
    setPatterns(initialPatterns);
  }, [initialPatterns]);

  async function updateState(id: string, state: IssueWorkflowState) {
    setStateSaving(id);
    const previous = patterns;
    const optimisticPatterns = patterns.map((pattern) =>
      pattern.id === id
        ? {
            ...pattern,
            workflow_state: state,
            workflow_updated_at: new Date().toISOString(),
            is_resolved: state === "resolved",
            resolved_at: state === "resolved" ? new Date().toISOString() : pattern.resolved_at,
          }
        : pattern
    );
    const nextPatterns =
      state === "resolved"
        ? optimisticPatterns.filter((pattern) => pattern.id !== id)
        : optimisticPatterns;

    setPatterns(nextPatterns);
    if (selectedPattern?.id === id) {
      const nextSelected =
        state === "resolved"
          ? null
          : nextPatterns.find((pattern) => pattern.id === id) || null;
      setSelectedPattern(nextSelected);
    }

    try {
      const response = await fetch(`/api/patterns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflow_state: state }),
      });
      if (!response.ok) {
        throw new Error("Failed to persist issue state");
      }
      const updated = (await response.json()) as FailurePattern;
      setPatterns((current) =>
        state === "resolved"
          ? current.filter((pattern) => pattern.id !== id)
          : current.map((pattern) => (pattern.id === id ? updated : pattern))
      );
      if (selectedPattern?.id === id) {
        setSelectedPattern(state === "resolved" ? null : updated);
      }
      success(state === "resolved" ? "Issue resolved" : "Issue updated");
    } catch (err) {
      console.error(err);
      setPatterns(previous);
      if (selectedPattern?.id === id) {
        const previousSelected = previous.find((pattern) => pattern.id === id) || null;
        setSelectedPattern(previousSelected);
      }
      error("Could not update issue state");
    } finally {
      setStateSaving(null);
    }
  }

  async function resolvePattern(id: string) {
    setResolving(id);
    try {
      await updateState(id, "resolved");
    } finally {
      setResolving(null);
    }
  }

  async function refreshPatterns() {
    setRefreshing(true);
    try {
      const response = await fetch("/api/patterns", { method: "POST" });
      if (!response.ok) {
        throw new Error("Failed to refresh issues");
      }
      window.location.reload();
    } catch (err) {
      console.error(err);
      error("Could not refresh issues");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="space-y-5 pb-8 animate-fade-in">

      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Issues</h1>
          <p className="mt-1 text-sm" style={{ color: "#787774" }}>
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
        <div
          className="rounded-[6px] border border-[#E9E9E7] bg-white px-6 py-14 text-center"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
        >
          <div
            className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full"
            style={{ background: "#F7F7F5", border: "1px solid #E9E9E7" }}
          >
            <Check className="h-4.5 w-4.5" style={{ color: "#ACABA8" }} />
          </div>
          <p className="text-sm font-medium" style={{ color: "#37352F" }}>
            No open issues
          </p>
          <p className="mt-1 text-xs" style={{ color: "#787774" }}>
            No recurring failure patterns detected this week.
          </p>
        </div>
      ) : (
        <div
          className="rounded-[6px] border border-[#E9E9E7] bg-white overflow-hidden"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
        >
          {/* Table header */}
          <div
            className="grid grid-cols-[minmax(0,2fr)_100px_80px_120px_minmax(160px,1fr)] gap-0 border-b border-[#E9E9E7] px-4 py-2.5"
            style={{ background: "#F7F7F5" }}
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "#ACABA8" }}>Issue</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "#ACABA8" }}>Severity</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "#ACABA8" }}>Volume</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "#ACABA8" }}>Status</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "#ACABA8" }}>Actions</span>
          </div>

          {patterns.map((pattern, idx) => {
            const stateLabel = issueStateLabel(pattern);
            const stateStyle = STATE_COLORS[stateLabel] || STATE_COLORS["New"];

            return (
              <div
                key={pattern.id}
                className={`grid grid-cols-[minmax(0,2fr)_100px_80px_120px_minmax(160px,1fr)] items-start gap-0 px-4 py-3 transition-colors hover:bg-[#F7F7F5] ${
                  idx < patterns.length - 1 ? "border-b border-[#F1F1EF]" : ""
                }`}
              >
                {/* Title + description + recommendation */}
                <div className="min-w-0 pr-6">
                  <button
                    type="button"
                    className="text-left text-sm font-semibold transition-colors hover:text-[#2383E2]"
                    style={{ color: "#37352F" }}
                    onClick={() => setSelectedPattern(pattern)}
                  >
                    {pattern.title}
                  </button>
                  <p
                    className="mt-0.5 text-xs leading-relaxed line-clamp-2"
                    style={{ color: "#787774" }}
                  >
                    {pattern.description}
                  </p>
                  <div className="mt-1.5 pl-3 border-l-2 border-[#2383E2]">
                    <p className="text-xs font-medium" style={{ color: "#37352F" }}>
                      {nextAction(pattern)}
                    </p>
                  </div>
                </div>

                {/* Severity */}
                <div className="pt-0.5">
                  <SeverityBadge severity={pattern.severity} />
                </div>

                {/* Volume */}
                <div className="pt-0.5 text-sm font-medium" style={{ color: "#37352F" }}>
                  {pattern.affected_conversation_ids.length}
                  <span className="ml-1 text-xs" style={{ color: "#ACABA8" }}>convs</span>
                </div>

                {/* Status */}
                <div className="pt-0.5">
                  <select
                    value={pattern.workflow_state}
                    onChange={(e) => updateState(pattern.id, e.target.value as IssueWorkflowState)}
                    disabled={stateSaving === pattern.id}
                    className={`appearance-none rounded-md border px-2 py-0.5 text-xs font-medium cursor-pointer bg-[#FFFFFF] ${stateStyle}`}
                  >
                    {ISSUE_WORKFLOW_STATES.map((state) => (
                      <option key={state} value={state}>
                        {STATE_LABELS[state]}
                      </option>
                    ))}
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
                    disabled={stateSaving === pattern.id}
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
            <div className="drawer-header" style={{ background: "#F7F7F5" }}>
              <div className="min-w-0">
                <p className="page-eyebrow">Issue detail</p>
                <h2
                  className="mt-1.5 text-lg font-semibold tracking-[-0.03em]"
                  style={{ color: "#37352F" }}
                >
                  {selectedPattern.title}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <SeverityBadge severity={selectedPattern.severity} />
                  <span className="operator-chip">
                    {issueStateLabel(selectedPattern)}
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
                <p className="text-sm leading-relaxed" style={{ color: "#787774" }}>
                  {selectedPattern.description}
                </p>
              </div>

              <div className="compact-list-item" style={{ borderTop: "1px solid #F1F1EF" }}>
                <p className="section-label mb-2 pt-4">Recommended action</p>
                <div className="pl-3 border-l-2 border-[#2383E2]">
                  <p className="text-sm font-medium" style={{ color: "#37352F" }}>
                    {nextAction(selectedPattern)}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="glass-button py-1 px-2.5 text-xs"
                    onClick={() => updateState(selectedPattern.id, "actioning")}
                    disabled={stateSaving === selectedPattern.id}
                  >
                    Track fix
                  </button>
                  <button
                    type="button"
                    className="glass-button py-1 px-2.5 text-xs"
                    onClick={() => updateState(selectedPattern.id, "quieted")}
                    disabled={stateSaving === selectedPattern.id}
                  >
                    Recheck next week
                  </button>
                  <button
                    type="button"
                    className="glass-button glass-button-primary py-1 px-2.5 text-xs"
                    onClick={() => updateState(selectedPattern.id, "resolved")}
                    disabled={stateSaving === selectedPattern.id}
                  >
                    Mark resolved
                  </button>
                </div>
              </div>

              <div className="compact-list-item" style={{ borderTop: "1px solid #F1F1EF" }}>
                <p className="section-label mb-2 pt-4">Affected conversations</p>
                <div className="space-y-0.5">
                  {selectedPattern.affected_conversation_ids.slice(0, 8).map((id) => (
                    <Link
                      key={id}
                      href={`/conversations/${id}`}
                      className="flex items-center justify-between rounded-[4px] px-2.5 py-1.5 transition-colors hover:bg-[#F7F7F5]"
                      onClick={() => setSelectedPattern(null)}
                    >
                      <span className="font-mono text-xs" style={{ color: "#787774" }}>
                        {id.slice(0, 12)}…
                      </span>
                      <ArrowRight className="h-3.5 w-3.5" style={{ color: "#ACABA8" }} />
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
