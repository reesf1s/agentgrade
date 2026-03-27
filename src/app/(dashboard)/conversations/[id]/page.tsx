"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { GlassCard } from "@/components/ui/glass-card";
import { ScoreBadge, SeverityBadge } from "@/components/ui/score-badge";
import { GlassButton } from "@/components/ui/glass-button";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { scoreColor, formatScore, formatDate } from "@/lib/utils";
import {
  ArrowLeft, AlertTriangle, Brain, BookOpen,
  User, Bot, Headphones, RefreshCw, X, Check,
} from "lucide-react";
import Link from "next/link";
import type { Message, QualityScore, ClaimAnalysis } from "@/lib/db/types";

interface ConversationDetail {
  id: string;
  customer_identifier?: string;
  platform: string;
  message_count: number;
  was_escalated: boolean;
  created_at: string;
  messages: Message[];
  quality_score: QualityScore | null;
}

// Score dimension labels and descriptions for the override modal
const DIMENSIONS = [
  { key: "overall_score",       label: "Overall",      desc: "Holistic quality rating" },
  { key: "accuracy_score",      label: "Accuracy",     desc: "Factual correctness" },
  { key: "hallucination_score", label: "Hallucination", desc: "Absence of fabricated claims" },
  { key: "resolution_score",    label: "Resolution",   desc: "Did the agent resolve the issue?" },
  { key: "tone_score",          label: "Tone",         desc: "Professionalism & empathy" },
  { key: "sentiment_score",     label: "Sentiment",    desc: "Customer sentiment outcome" },
] as const;

const roleConfig = {
  customer:    { icon: User,       label: "Customer",     align: "justify-start", bubble: "bg-[rgba(255,255,255,0.03)]" },
  agent:       { icon: Bot,        label: "AI Agent",     align: "justify-end",   bubble: "bg-[rgba(255,255,255,0.06)]" },
  human_agent: { icon: Headphones, label: "Human Agent",  align: "justify-end",   bubble: "bg-[rgba(59,130,246,0.08)]" },
  system:      { icon: Bot,        label: "System",       align: "justify-center", bubble: "bg-[rgba(255,255,255,0.02)]" },
};

export default function ConversationDetailPage() {
  const params = useParams();
  const { error: showError, success: showSuccess } = useToast();

  const [conv, setConv] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [reScoring, setReScoring] = useState(false);

  // Override modal state
  const [showOverride, setShowOverride] = useState(false);
  const [overrideDimension, setOverrideDimension] = useState("overall_score");
  const [overrideScore, setOverrideScore] = useState(70);
  const [overrideReason, setOverrideReason] = useState("");
  const [submittingOverride, setSubmittingOverride] = useState(false);

  useEffect(() => {
    fetch(`/api/conversations/${params.id}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json();
      })
      .then((data) => { if (data) setConv(data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [params.id]);

  // Re-score this conversation via the API
  async function reScore() {
    setReScoring(true);
    try {
      const res = await fetch(`/api/conversations/${params.id}/score`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        // Reload the conversation to get updated scores
        const updated = await fetch(`/api/conversations/${params.id}`).then((r) => r.json());
        setConv(updated);
        showSuccess("Re-scoring complete.");
      } else {
        const d = await res.json();
        showError(d.error ?? "Re-scoring failed. Please try again.");
      }
    } catch {
      showError("Network error — re-scoring failed.");
    } finally {
      setReScoring(false);
    }
  }

  // Submit a score override for one dimension
  async function submitOverride() {
    if (!conv?.quality_score) return;
    setSubmittingOverride(true);
    try {
      const dim = DIMENSIONS.find((d) => d.key === overrideDimension);
      const originalScore = (conv.quality_score as unknown as Record<string, number>)[overrideDimension] ?? 0;

      const res = await fetch(`/api/conversations/${params.id}/override`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dimension: dim?.label.toLowerCase() ?? overrideDimension,
          override_score: overrideScore / 100,
          reason: overrideReason,
          original_score: originalScore,
        }),
      });

      if (res.ok) {
        showSuccess("Score override saved.");
        setShowOverride(false);
        setOverrideReason("");
        // Optimistically update local state
        setConv((prev) => {
          if (!prev?.quality_score) return prev;
          return {
            ...prev,
            quality_score: {
              ...prev.quality_score,
              [overrideDimension]: overrideScore / 100,
            },
          };
        });
      } else {
        const d = await res.json();
        showError(d.error ?? "Failed to save override.");
      }
    } catch {
      showError("Network error — override failed.");
    } finally {
      setSubmittingOverride(false);
    }
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-6xl">
        <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to conversations
        </div>
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-4">
            <SkeletonCard className="h-96" />
          </div>
          <div className="space-y-4">
            <SkeletonCard className="h-64" />
            <SkeletonCard className="h-32" />
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !conv) {
    return (
      <div className="max-w-4xl">
        <Link href="/conversations" className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to conversations
        </Link>
        <GlassCard className="p-12 text-center">
          <p className="text-[var(--text-muted)]">Conversation not found.</p>
        </GlassCard>
      </div>
    );
  }

  const qs = conv.quality_score;

  return (
    <>
      <div className="max-w-6xl">
        <Link
          href="/conversations"
          className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to conversations
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">
              {conv.customer_identifier || "Unknown customer"}
            </h1>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              <span className="capitalize">{conv.platform}</span>
              {" · "}{conv.message_count} messages
              {" · "}{formatDate(conv.created_at)}
              {conv.was_escalated && <span className="score-critical"> · Escalated</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <GlassButton
              size="sm"
              onClick={reScore}
              disabled={reScoring}
              className="flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${reScoring ? "animate-spin" : ""}`} />
              {reScoring ? "Re-scoring…" : "Re-score"}
            </GlassButton>
            {qs && <ScoreBadge score={qs.overall_score} size="lg" label="overall" />}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Left: Transcript + improvements */}
          <div className="col-span-2 space-y-4">
            {/* Conversation transcript */}
            <GlassCard className="p-6">
              <h2 className="text-sm font-medium text-[var(--text-primary)] mb-5">Conversation</h2>
              {conv.messages.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No messages found.</p>
              ) : (
                <div className="space-y-4">
                  {conv.messages.map((msg) => {
                    const cfg = roleConfig[msg.role] ?? roleConfig.system;
                    const Icon = cfg.icon;

                    // Find quality issues in this message
                    const flaggedClaims: ClaimAnalysis[] = qs?.claim_analysis?.filter(
                      (ca) =>
                        ca.verdict !== "verified" &&
                        msg.content.toLowerCase().includes(ca.claim.toLowerCase().slice(0, 20))
                    ) ?? [];

                    return (
                      <div key={msg.id} className={`flex ${cfg.align}`}>
                        <div className={`max-w-[80%] ${cfg.bubble} rounded-2xl p-4`}>
                          <div className="flex items-center gap-2 mb-2">
                            <Icon className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                            <span className="text-xs font-medium text-[var(--text-muted)]">{cfg.label}</span>
                          </div>
                          <p className="text-sm text-[var(--text-primary)] leading-relaxed">{msg.content}</p>

                          {/* Inline claim annotations */}
                          {flaggedClaims.length > 0 && (
                            <div className="mt-3 space-y-1.5">
                              {flaggedClaims.map((claim, i) => (
                                <div
                                  key={i}
                                  className={`flex items-start gap-2 p-2 rounded-lg text-xs ${
                                    claim.verdict === "fabricated"
                                      ? "score-bg-critical border border-[rgba(239,68,68,0.15)]"
                                      : "score-bg-warning border border-[rgba(245,158,11,0.15)]"
                                  }`}
                                >
                                  <AlertTriangle
                                    className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${
                                      claim.verdict === "fabricated" ? "score-critical" : "score-warning"
                                    }`}
                                  />
                                  <div>
                                    <span
                                      className={`font-semibold capitalize ${
                                        claim.verdict === "fabricated" ? "score-critical" : "score-warning"
                                      }`}
                                    >
                                      {claim.verdict}:
                                    </span>{" "}
                                    <span className="text-[var(--text-secondary)]">{claim.evidence}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </GlassCard>

            {/* Prompt improvements */}
            {qs && qs.prompt_improvements.length > 0 && (
              <GlassCard className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Brain className="w-4 h-4 text-[var(--text-secondary)]" />
                  <h2 className="text-sm font-medium text-[var(--text-primary)]">Recommended Prompt Improvements</h2>
                </div>
                <div className="space-y-4">
                  {qs.prompt_improvements.map((imp, i) => (
                    <div key={i} className="p-4 rounded-xl bg-[rgba(255,255,255,0.02)]">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-[var(--text-primary)]">{imp.issue}</p>
                        <SeverityBadge severity={imp.priority === "high" ? "high" : imp.priority === "medium" ? "medium" : "low"} />
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] mb-3">
                        <strong>Current behavior:</strong> {imp.current_behavior}
                      </p>
                      <div className="p-3 rounded-lg bg-[rgba(0,0,0,0.2)] font-mono text-xs text-[var(--text-primary)] leading-relaxed">
                        {imp.recommended_prompt_change}
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mt-2">
                        Expected impact: {imp.expected_impact}
                      </p>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}

            {/* Knowledge gaps */}
            {qs && qs.knowledge_gaps.length > 0 && (
              <GlassCard className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <BookOpen className="w-4 h-4 text-[var(--text-secondary)]" />
                  <h2 className="text-sm font-medium text-[var(--text-primary)]">Knowledge Base Gaps</h2>
                </div>
                <div className="space-y-3">
                  {qs.knowledge_gaps.map((gap, i) => (
                    <div key={i} className="p-4 rounded-xl bg-[rgba(255,255,255,0.02)]">
                      <p className="text-sm font-medium text-[var(--text-primary)] capitalize mb-1">{gap.topic}</p>
                      <p className="text-xs text-[var(--text-secondary)] mb-2">{gap.description}</p>
                      <p className="text-xs text-[var(--text-muted)]">Suggested content: {gap.suggested_content}</p>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}
          </div>

          {/* Right: Scores + sidebar actions */}
          <div className="space-y-4">
            {/* Quality scores */}
            {qs ? (
              <>
                <GlassCard className="p-5">
                  <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4">Quality Scores</h2>
                  <div className="space-y-4">
                    {DIMENSIONS.map(({ key, label }) => {
                      const score = (qs as unknown as Record<string, number | undefined>)[key] ?? 0;
                      return (
                        <div key={key}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs text-[var(--text-secondary)]">{label}</span>
                            <span className={`text-sm font-mono font-semibold ${scoreColor(score)}`}>
                              {formatScore(score)}%
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-[rgba(255,255,255,0.06)]">
                            <div
                              className={`h-full rounded-full transition-all ${
                                score >= 0.7
                                  ? "bg-[#10B981]"
                                  : score >= 0.4
                                  ? "bg-[#F59E0B]"
                                  : "bg-[#EF4444]"
                              }`}
                              style={{ width: `${score * 100}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </GlassCard>

                {/* Summary */}
                <GlassCard className="p-5">
                  <h2 className="text-sm font-medium text-[var(--text-primary)] mb-3">Summary</h2>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    {qs.summary || "No summary available."}
                  </p>
                </GlassCard>

                {/* Flags */}
                {qs.flags.length > 0 && (
                  <GlassCard className="p-5">
                    <h2 className="text-sm font-medium text-[var(--text-primary)] mb-3">Flags</h2>
                    <div className="flex flex-wrap gap-2">
                      {qs.flags.map((flag, i) => (
                        <span
                          key={i}
                          className="text-xs px-2.5 py-1 rounded-full bg-[rgba(239,68,68,0.08)] text-[#EF4444] font-medium border border-[rgba(239,68,68,0.15)]"
                        >
                          {flag}
                        </span>
                      ))}
                    </div>
                  </GlassCard>
                )}

                {/* Claim verification */}
                {qs.claim_analysis.length > 0 && (
                  <GlassCard className="p-5">
                    <h2 className="text-sm font-medium text-[var(--text-primary)] mb-3">Claim Verification</h2>
                    <div className="space-y-2">
                      {qs.claim_analysis.map((ca, i) => {
                        const verdictStyle = {
                          verified:     "score-good",
                          unverifiable: "text-[var(--text-muted)]",
                          contradicted: "score-warning",
                          fabricated:   "score-critical",
                        }[ca.verdict];
                        return (
                          <div key={i} className="p-2.5 rounded-lg bg-[rgba(255,255,255,0.02)]">
                            <p className="text-xs text-[var(--text-primary)] mb-1">{ca.claim}</p>
                            <span className={`text-xs font-medium capitalize ${verdictStyle}`}>
                              {ca.verdict}
                            </span>
                            {ca.evidence && (
                              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{ca.evidence}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </GlassCard>
                )}
              </>
            ) : (
              <GlassCard className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <RefreshCw className="w-4 h-4 text-[var(--text-muted)] animate-spin" />
                  <p className="text-sm text-[var(--text-muted)]">Scoring in progress…</p>
                </div>
                <GlassButton size="sm" onClick={reScore} disabled={reScoring} className="w-full">
                  Score now
                </GlassButton>
              </GlassCard>
            )}

            {/* Override score card */}
            <GlassCard className="p-5">
              <h2 className="text-sm font-medium text-[var(--text-primary)] mb-2">Override Score</h2>
              <p className="text-xs text-[var(--text-muted)] mb-3">
                Disagree with the AI assessment? Override a dimension to calibrate the model.
              </p>
              <GlassButton
                size="sm"
                className="w-full"
                onClick={() => {
                  if (qs) setOverrideScore(Math.round((qs.overall_score ?? 0.7) * 100));
                  setShowOverride(true);
                }}
                disabled={!qs}
              >
                Override a score
              </GlassButton>
            </GlassCard>
          </div>
        </div>
      </div>

      {/* ─── Override Modal ─────────────────────────────────────────────────── */}
      {showOverride && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(0,0,0,0.7)] backdrop-blur-sm">
          <div className="glass-elevated p-6 w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Override Score</h3>
              <button
                onClick={() => setShowOverride(false)}
                className="p-1.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Dimension selector */}
            <div className="mb-4">
              <label className="text-xs font-medium text-[var(--text-secondary)] block mb-2">Dimension</label>
              <div className="grid grid-cols-3 gap-1.5">
                {DIMENSIONS.map((d) => {
                  const currentScore = qs
                    ? (qs as unknown as Record<string, number | undefined>)[d.key] ?? 0
                    : 0;
                  return (
                    <button
                      key={d.key}
                      onClick={() => {
                        setOverrideDimension(d.key);
                        setOverrideScore(Math.round(currentScore * 100));
                      }}
                      className={`p-2 rounded-xl text-left border transition-all ${
                        overrideDimension === d.key
                          ? "bg-[rgba(255,255,255,0.06)] border-[rgba(255,255,255,0.15)]"
                          : "bg-[rgba(255,255,255,0.02)] border-transparent hover:bg-[rgba(255,255,255,0.04)]"
                      }`}
                    >
                      <p className="text-xs font-medium text-[var(--text-primary)]">{d.label}</p>
                      <p className={`text-xs font-mono mt-0.5 ${scoreColor(currentScore)}`}>
                        {formatScore(currentScore)}%
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Score slider */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-[var(--text-secondary)]">New score</label>
                <span className={`text-sm font-mono font-bold ${scoreColor(overrideScore / 100)}`}>
                  {overrideScore}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={overrideScore}
                onChange={(e) => setOverrideScore(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none bg-[rgba(255,255,255,0.1)] cursor-pointer"
                style={{
                  background: `linear-gradient(to right, ${
                    overrideScore >= 70 ? "#10B981" : overrideScore >= 40 ? "#F59E0B" : "#EF4444"
                  } 0%, ${
                    overrideScore >= 70 ? "#10B981" : overrideScore >= 40 ? "#F59E0B" : "#EF4444"
                  } ${overrideScore}%, rgba(255,255,255,0.1) ${overrideScore}%, rgba(255,255,255,0.1) 100%)`,
                }}
              />
              <div className="flex justify-between text-[10px] text-[var(--text-muted)] mt-1">
                <span>0% Critical</span>
                <span>50% Fair</span>
                <span>100% Excellent</span>
              </div>
            </div>

            {/* Reason */}
            <div className="mb-5">
              <label className="text-xs font-medium text-[var(--text-secondary)] block mb-1.5">
                Reason <span className="text-[var(--text-muted)]">(optional)</span>
              </label>
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Why are you overriding this score? This helps calibrate future assessments."
                className="glass-input w-full px-3 py-2.5 text-sm resize-none"
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <GlassButton
                variant="primary"
                onClick={submitOverride}
                disabled={submittingOverride}
                className="flex-1 flex items-center justify-center gap-2"
              >
                {submittingOverride ? "Saving…" : (
                  <>
                    <Check className="w-3.5 h-3.5" /> Save override
                  </>
                )}
              </GlassButton>
              <GlassButton onClick={() => setShowOverride(false)} className="flex-1">
                Cancel
              </GlassButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
