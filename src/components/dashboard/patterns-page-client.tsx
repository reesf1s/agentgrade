"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ArrowRight, Check, RefreshCw, X } from "lucide-react";
import { GlassButton } from "@/components/ui/glass-button";
import { GlassCard } from "@/components/ui/glass-card";
import { SeverityBadge } from "@/components/ui/score-badge";
import type { FailurePattern } from "@/lib/db/types";

function issueState(pattern: FailurePattern) {
  if (pattern.is_resolved) return "Resolved";
  if (pattern.severity === "critical" || pattern.severity === "high") return "Action needed";
  if (pattern.affected_conversation_ids.length >= 6) return "Watching";
  return "New";
}

function issueStateTone(pattern: FailurePattern) {
  const state = issueState(pattern);
  if (state === "Resolved") return "score-bg-good score-good";
  if (state === "Action needed") return "score-bg-warning score-warning";
  return "";
}

function nextAction(pattern: FailurePattern) {
  return (
    pattern.recommendation ||
    pattern.prompt_fix ||
    pattern.knowledge_base_suggestion ||
    "Review a few examples and decide whether this belongs in prompt, workflow, or source coverage."
  );
}

export function PatternsPageClient({ initialPatterns }: { initialPatterns: FailurePattern[] }) {
  const [patterns, setPatterns] = useState(initialPatterns);
  const [resolving, setResolving] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPattern, setSelectedPattern] = useState<FailurePattern | null>(null);

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
            <h1 className="mt-2 page-title">Repeated problems, grouped into one fixable list.</h1>
            <p className="mt-3 page-subtitle">
              This page should only surface repeated issues that are clear enough to matter and actionable enough to fix.
            </p>
          </div>
          <GlassButton onClick={refreshPatterns} disabled={refreshing} className="inline-flex items-center gap-2">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing..." : "Refresh issues"}
          </GlassButton>
        </div>
      </section>

      {patterns.length === 0 ? (
        <GlassCard className="rounded-[1.4rem] p-10 text-center">
          <p className="text-sm text-[var(--text-muted)]">
            No repeated issue is standing out yet. Once enough usable scored conversations land, AgentGrade will group them here.
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {patterns.map((pattern) => (
            <GlassCard key={pattern.id} className="rounded-[1.4rem] p-5 sm:p-6">
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
                <div>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                            pattern.severity === "critical"
                              ? "score-bg-critical"
                              : pattern.severity === "high"
                                ? "score-bg-warning"
                                : "bg-[var(--surface-soft)]"
                          }`}
                        >
                          <AlertTriangle
                            className={`h-4 w-4 ${
                              pattern.severity === "critical"
                                ? "score-critical"
                                : pattern.severity === "high"
                                  ? "score-warning"
                                  : "text-[var(--text-secondary)]"
                            }`}
                          />
                        </div>
                        <div>
                          <p className="text-lg font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
                            {pattern.title}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <SeverityBadge severity={pattern.severity} />
                            <span className={`operator-chip ${issueStateTone(pattern)}`}>{issueState(pattern)}</span>
                            <span className="operator-chip">
                              {pattern.affected_conversation_ids.length} conversations
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <GlassButton
                      size="sm"
                      onClick={() => resolvePattern(pattern.id)}
                      disabled={resolving === pattern.id}
                      className="inline-flex items-center gap-2"
                    >
                      <Check className="h-4 w-4" />
                      {resolving === pattern.id ? "Resolving..." : "Mark resolved"}
                    </GlassButton>
                  </div>

                  <div className="mt-5 grid gap-3 lg:grid-cols-2">
                    <div className="metric-card px-4 py-4">
                      <p className="section-label">Why it matters</p>
                      <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{pattern.description}</p>
                    </div>
                    <div className="metric-card px-4 py-4">
                      <p className="section-label">What to do next</p>
                      <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{nextAction(pattern)}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="metric-card px-4 py-4">
                    <p className="section-label">Recommended next action</p>
                    <p className="mt-3 text-sm font-medium text-[var(--text-primary)]">{nextAction(pattern)}</p>
                    <button
                      type="button"
                      onClick={() => setSelectedPattern(pattern)}
                      className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]"
                    >
                      Open issue detail
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>

                  {pattern.prompt_fix ? (
                    <div className="metric-card px-4 py-4">
                      <p className="section-label">Prompt change</p>
                      <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{pattern.prompt_fix}</p>
                    </div>
                  ) : null}

                  {pattern.knowledge_base_suggestion ? (
                    <div className="metric-card px-4 py-4">
                      <p className="section-label">Knowledge update</p>
                      <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{pattern.knowledge_base_suggestion}</p>
                    </div>
                  ) : null}

                  {pattern.affected_conversation_ids.length > 0 ? (
                    <div className="metric-card px-4 py-4">
                      <p className="section-label">Examples</p>
                      <div className="mt-3 space-y-2">
                        {pattern.affected_conversation_ids.slice(0, 4).map((conversationId) => (
                          <Link
                            key={conversationId}
                            href={`/conversations/${conversationId}`}
                            className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text-primary)]"
                          >
                            <span>{conversationId.slice(0, 8)}</span>
                            <ArrowRight className="h-4 w-4 text-[var(--text-muted)]" />
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </GlassCard>
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
                  <span className={`operator-chip ${issueStateTone(selectedPattern)}`}>{issueState(selectedPattern)}</span>
                  <span className="operator-chip">{selectedPattern.affected_conversation_ids.length} examples</span>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedPattern(null)} className="operator-chip">
                <X className="h-4 w-4" />
                Close
              </button>
            </div>
            <div className="drawer-body space-y-4">
              <div className="compact-list">
                <div className="compact-list-item">
                  <p className="section-label">Why it matters</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{selectedPattern.description}</p>
                </div>
                <div className="compact-list-item">
                  <p className="section-label">Recommended next action</p>
                  <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">{nextAction(selectedPattern)}</p>
                </div>
              </div>

              {selectedPattern.prompt_fix ? (
                <div className="compact-list-item">
                  <p className="section-label">Prompt change</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{selectedPattern.prompt_fix}</p>
                </div>
              ) : null}

              {selectedPattern.knowledge_base_suggestion ? (
                <div className="compact-list-item">
                  <p className="section-label">Knowledge update</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{selectedPattern.knowledge_base_suggestion}</p>
                </div>
              ) : null}

              {selectedPattern.affected_conversation_ids.length > 0 ? (
                <div className="compact-list-item">
                  <p className="section-label">Example conversations</p>
                  <div className="mt-3 space-y-2">
                    {selectedPattern.affected_conversation_ids.slice(0, 6).map((conversationId) => (
                      <Link
                        key={conversationId}
                        href={`/conversations/${conversationId}`}
                        className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text-primary)]"
                      >
                        <span>{conversationId.slice(0, 8)}</span>
                        <ArrowRight className="h-4 w-4 text-[var(--text-muted)]" />
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}
