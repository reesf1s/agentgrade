"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Check, RefreshCw, X } from "lucide-react";
import { GlassButton } from "@/components/ui/glass-button";
import { SeverityBadge } from "@/components/ui/score-badge";
import type { FailurePattern } from "@/lib/db/types";
import { getIssueStateMap, setIssueState, type IssueWorkflowState } from "@/lib/review-workflow";

function issueState(pattern: FailurePattern, savedState?: IssueWorkflowState) {
  if (savedState) {
    const labels: Record<IssueWorkflowState, string> = {
      new: "New",
      monitoring: "Monitoring",
      actioning: "Actioning",
      quieted: "Quieted",
      resolved: "Resolved",
    };
    return labels[savedState];
  }
  if (pattern.is_resolved) return "Resolved";
  if (pattern.severity === "critical" || pattern.severity === "high") return "Actioning";
  if (pattern.affected_conversation_ids.length >= 6) return "Monitoring";
  return "New";
}

function nextAction(pattern: FailurePattern) {
  return (
    pattern.recommendation ||
    pattern.prompt_fix ||
    pattern.knowledge_base_suggestion ||
    "Review examples and decide whether this belongs in prompt, workflow, or source coverage."
  );
}

function leverageLabel(pattern: FailurePattern) {
  if (pattern.severity === "critical" || pattern.affected_conversation_ids.length >= 6) return "High";
  if (pattern.severity === "high" || pattern.affected_conversation_ids.length >= 3) return "Medium";
  return "Low";
}

export function PatternsPageClient({ initialPatterns }: { initialPatterns: FailurePattern[] }) {
  const [patterns, setPatterns] = useState(initialPatterns);
  const [resolving, setResolving] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPattern, setSelectedPattern] = useState<FailurePattern | null>(null);
  const [issueStates, setIssueStates] = useState<Record<string, IssueWorkflowState>>({});

  useEffect(() => {
    setIssueStates(getIssueStateMap());
  }, []);

  function updateIssueWorkflowState(patternId: string, state: IssueWorkflowState) {
    setIssueState(patternId, state);
    setIssueStates((current) => ({ ...current, [patternId]: state }));
  }

  async function resolvePattern(patternId: string) {
    setResolving(patternId);
    try {
      const response = await fetch(`/api/patterns/${patternId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_resolved: true }),
      });

      if (response.ok) {
        setPatterns((current) => current.filter((pattern) => pattern.id !== patternId));
      }
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
    <div className="space-y-6 pb-10">
      <section className="glass-static rounded-[1.5rem] p-5 sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="page-eyebrow">Issues</p>
            <h1 className="mt-2 page-title">The work worth fixing.</h1>
          </div>
          <GlassButton onClick={refreshPatterns} disabled={refreshing} className="inline-flex items-center gap-2">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing..." : "Refresh issues"}
          </GlassButton>
        </div>
      </section>

      {patterns.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm text-[var(--text-muted)]">None this week.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {patterns.map((pattern) => (
            <div key={pattern.id} className="stack-row py-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={(issueStates[pattern.id] || "").toString()}
                      onChange={(event) => updateIssueWorkflowState(pattern.id, event.target.value as IssueWorkflowState)}
                      className="glass-input px-3 py-1 text-xs"
                    >
                      <option value="">New</option>
                      <option value="new">New</option>
                      <option value="monitoring">Monitoring</option>
                      <option value="actioning">Actioning</option>
                      <option value="quieted">Quieted</option>
                      <option value="resolved">Resolved</option>
                    </select>
                    <p className="text-base font-semibold tracking-[-0.03em] text-[var(--text-primary)]">{pattern.title}</p>
                  </div>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">{pattern.affected_conversation_ids.length} conversations this week.</p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">{pattern.description}</p>
                  <p className="mt-2 text-sm text-[var(--text-primary)]">{nextAction(pattern)}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <SeverityBadge severity={pattern.severity} />
                    <span className="operator-chip">Frequency: {pattern.affected_conversation_ids.length}</span>
                    <span className="operator-chip">Leverage: {leverageLabel(pattern)}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button type="button" className="operator-chip" onClick={() => setSelectedPattern(pattern)}>
                    Open issue
                  </button>
                  <button type="button" className="operator-chip" onClick={() => updateIssueWorkflowState(pattern.id, "actioning")}>
                    Mark in progress
                  </button>
                  <GlassButton
                    size="sm"
                    onClick={() => resolvePattern(pattern.id)}
                    disabled={resolving === pattern.id}
                    className="inline-flex items-center gap-2"
                  >
                    <Check className="h-4 w-4" />
                    {resolving === pattern.id ? "Resolving..." : "Resolve"}
                  </GlassButton>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedPattern ? (
        <>
          <button
            type="button"
            aria-label="Close issue detail"
            className="drawer-backdrop"
            onClick={() => setSelectedPattern(null)}
          />
          <aside className="drawer-panel">
            <div className="drawer-header">
              <div>
                <p className="page-eyebrow">Issue detail</p>
                <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
                  {selectedPattern.title}
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  <SeverityBadge severity={selectedPattern.severity} />
                  <span className="operator-chip">{issueState(selectedPattern, issueStates[selectedPattern.id])}</span>
                  <span className="operator-chip">Leverage: {leverageLabel(selectedPattern)}</span>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedPattern(null)} className="operator-chip">
                <X className="h-4 w-4" />
                Close
              </button>
            </div>

            <div className="drawer-body space-y-4">
              <div className="compact-list-item">
                <p className="section-label">What is happening</p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{selectedPattern.description}</p>
              </div>

              <div className="compact-list-item">
                <p className="section-label">Recommended action</p>
                <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">{nextAction(selectedPattern)}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" className="operator-chip" onClick={() => updateIssueWorkflowState(selectedPattern.id, "actioning")}>
                    Track fix
                  </button>
                  <button type="button" className="operator-chip" onClick={() => updateIssueWorkflowState(selectedPattern.id, "quieted")}>
                    Recheck next week
                  </button>
                  <button type="button" className="operator-chip" onClick={() => updateIssueWorkflowState(selectedPattern.id, "resolved")}>
                    Mark resolved
                  </button>
                </div>
              </div>

              <div className="compact-list-item">
                <p className="section-label">Examples</p>
                <div className="mt-2 space-y-2">
                  {selectedPattern.affected_conversation_ids.slice(0, 6).map((conversationId) => (
                    <Link
                      key={conversationId}
                      href={`/conversations/${conversationId}`}
                      className="flex items-center justify-between text-sm text-[var(--text-primary)]"
                    >
                      <span>{conversationId.slice(0, 8)}</span>
                      <ArrowRight className="h-4 w-4 text-[var(--text-muted)]" />
                    </Link>
                  ))}
                </div>
              </div>

              <div className="compact-list-item">
                <p className="section-label">Current state</p>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  {issueState(selectedPattern, issueStates[selectedPattern.id])} · Severity {selectedPattern.severity} · Frequency {selectedPattern.affected_conversation_ids.length}
                </p>
              </div>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}
