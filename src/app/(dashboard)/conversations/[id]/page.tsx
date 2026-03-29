"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { GlassCard } from "@/components/ui/glass-card";
import { ScoreBadge, SeverityBadge } from "@/components/ui/score-badge";
import { GlassButton } from "@/components/ui/glass-button";
import { GlassSelect, GlassTextarea } from "@/components/ui/glass-input";
import { scoreColor, formatScore } from "@/lib/utils";
import { ArrowLeft, AlertTriangle, Brain, BookOpen, CheckCircle2, Bot, Headphones, ShieldAlert, User } from "lucide-react";
import Link from "next/link";
import type { Message, QualityScore, ClaimAnalysis } from "@/lib/db/types";
import { isGroundingRiskOnlyScore } from "@/lib/scoring/quality-score-status";

interface ConversationDetail {
  id: string;
  customer_identifier?: string;
  platform: string;
  message_count: number;
  was_escalated: boolean;
  created_at: string;
  messages: Message[];
  quality_score: QualityScore | null;
  score_status?: "pending" | "refreshing" | "ready" | "waiting_for_completion" | "waiting_for_quiet_period";
}

function hasStructuredAnswer(messages: Message[]) {
  return messages.some(
    (message) =>
      message.role === "agent" &&
      (/##|###|\|/.test(message.content) ||
        /priority|next step|what to do next|snapshot|risk|todo|summary|briefing/i.test(message.content))
  );
}

function deriveStrengths(messages: Message[], score?: QualityScore | null) {
  const strengths: string[] = [];

  if ((score?.resolution_score || 0) >= 0.78) {
    strengths.push("The answer moved the user toward a clear next step.");
  }
  if ((score?.tone_score || 0) >= 0.85) {
    strengths.push("The tone stayed professional and easy to trust.");
  }
  if (hasStructuredAnswer(messages)) {
    strengths.push("The answer was structured in a way a rep or operator could scan quickly.");
  }
  if ((score?.overall_score || 0) >= 0.78) {
    strengths.push("Directionally, the response looked useful enough to act as a working draft.");
  }

  return strengths.slice(0, 3);
}

function deriveChecks(score?: QualityScore | null, evidenceLimited = false) {
  const claims = (score?.claim_analysis || [])
    .filter((claim) => claim.verdict !== "verified")
    .slice(0, evidenceLimited ? 2 : 3)
    .map((claim) => ({
      label:
        claim.verdict === "fabricated"
          ? "Likely wrong"
          : claim.verdict === "contradicted"
            ? "Conflicts with evidence"
            : "Needs confirmation",
      claim: claim.claim,
      verdict: claim.verdict,
    }));

  if (claims.length > 0) {
    return claims;
  }

  if (evidenceLimited) {
    return [
      {
        label: "Needs confirmation",
        claim: "Record-level facts were not directly traceable in the transcript.",
        verdict: "unverifiable" as const,
      },
    ];
  }

  return [];
}

export default function ConversationDetailPage() {
  const params = useParams();
  const [conv, setConv] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [overrideDimension, setOverrideDimension] = useState("overall");
  const [overrideScore, setOverrideScore] = useState("50");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideState, setOverrideState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [labelSetState, setLabelSetState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [labelNotes, setLabelNotes] = useState("");
  const [labelShareScope, setLabelShareScope] = useState<"workspace_private" | "global_anonymous">("workspace_private");
  const [labelExampleKind, setLabelExampleKind] = useState<"real" | "synthetic">("real");
  const [trainingLabels, setTrainingLabels] = useState({
    overall: "",
    accuracy: "",
    hallucination: "",
    resolution: "",
    escalation: "",
    tone: "",
    sentiment: "",
  });

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    const loadConversation = async (isInitialLoad = false) => {
      try {
        const response = await fetch(`/api/conversations/${params.id}`, {
          cache: "no-store",
        });

        if (response.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }

        const data = (await response.json()) as ConversationDetail;
        if (cancelled) return;

        setConv(data);

        if (data.score_status === "pending" || data.score_status === "refreshing") {
          pollTimer = setTimeout(() => {
            void loadConversation(false);
          }, 2000);
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelled && isInitialLoad) {
          setLoading(false);
        }
      }
    };

    void loadConversation(true);

    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [params.id]);

  if (loading) {
    return (
      <div className="max-w-6xl">
        <Link href="/conversations" className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to conversations
        </Link>
        <GlassCard className="p-12 text-center">
          <p className="text-[var(--text-muted)]">Loading...</p>
        </GlassCard>
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
          <p className="text-[var(--text-muted)]">Conversation not found</p>
        </GlassCard>
      </div>
    );
  }

  const qs = conv.quality_score;
  const confidenceLevel = qs?.confidence_level ?? qs?.structural_metrics?.confidence_level;
  const confidenceTone = confidenceLevel === "high"
    ? "score-good"
    : confidenceLevel === "medium"
      ? "score-warning"
      : "score-critical";
  const groundingRiskFlags = qs?.flags?.filter((flag) =>
    /(grounding|tool_backed|verification|trace|unverified|ungrounded)/i.test(flag)
  ) || [];
  const groundingOnlyScore = isGroundingRiskOnlyScore(qs);
  const lowConfidenceGroundingOnly = groundingOnlyScore && confidenceLevel === "low";
  const strengths = deriveStrengths(conv.messages, qs);
  const checks = deriveChecks(qs, lowConfidenceGroundingOnly);
  const assessmentHeading = !qs
    ? "Scoring in progress"
    : lowConfidenceGroundingOnly
      ? "Useful answer, limited evidence"
      : (qs.overall_score || 0) >= 0.75
        ? "Strong answer"
        : (qs.overall_score || 0) >= 0.5
          ? "Mixed answer"
          : "High-risk answer";
  const operatorGuidance = !qs
    ? "Wait for the first score to finish."
    : lowConfidenceGroundingOnly
      ? "Use the response as a working brief, but verify the record-level facts before anyone acts on it."
      : (qs.overall_score || 0) >= 0.75
        ? "This conversation looks healthy. Focus on repeatability, not firefighting."
        : (qs.overall_score || 0) >= 0.5
          ? "There is some value here, but parts of the response need tightening before you trust it at scale."
          : "Treat this as a real quality problem. The assistant missed the mark in a way that could affect users.";
  const visiblePromptImprovements = groundingOnlyScore
    ? []
    : (qs?.prompt_improvements || []);
  const visibleKnowledgeGaps = groundingOnlyScore
    ? []
    : (qs?.knowledge_gaps || []);
  const visibleClaimAnalysis = lowConfidenceGroundingOnly
    ? []
    : groundingOnlyScore
    ? (qs?.claim_analysis || []).filter((claim) => claim.verdict !== "verified").slice(0, 3)
    : (qs?.claim_analysis || []);
  const visibleFlags = lowConfidenceGroundingOnly
    ? []
    : groundingOnlyScore
    ? (qs?.flags || []).filter((flag) => !/(tool_backed|verification|trace|org_policy_gap|ungrounded|grounding_risk_review_recommended)/i.test(flag))
    : (qs?.flags || []);

  const roleConfig = {
    customer: { icon: User, label: "Customer", bg: "bg-[var(--surface-soft)] border border-[var(--border-subtle)]", align: "mr-auto" },
    agent: { icon: Bot, label: "AI Agent", bg: "bg-[var(--surface)] border border-[var(--border-subtle)]", align: "ml-auto" },
    human_agent: { icon: Headphones, label: "Human Agent", bg: "bg-[var(--panel-subtle)] border border-[var(--border-subtle)]", align: "ml-auto" },
    tool: { icon: Bot, label: "Tool", bg: "bg-[var(--surface-soft)] border border-[var(--border-subtle)]", align: "mx-auto" },
    system: { icon: Bot, label: "System", bg: "bg-[var(--surface-soft)] border border-[var(--border-subtle)]", align: "mx-auto" },
  };

  async function submitOverride() {
    if (!conv) return;

    setOverrideState("saving");
    try {
      const response = await fetch(`/api/conversations/${conv.id}/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dimension: overrideDimension,
          override_score: Math.max(0, Math.min(1, Number(overrideScore) / 100)),
          reason: overrideReason || null,
        }),
      });

      if (!response.ok) {
        setOverrideState("error");
        return;
      }

      setOverrideState("saved");
      setShowOverrideForm(false);
      setOverrideReason("");
    } catch {
      setOverrideState("error");
    }
  }

  async function submitTrainingLabels() {
    if (!conv) return;

    setLabelSetState("saving");
    try {
      const response = await fetch("/api/calibration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: conv.id,
          labels: trainingLabels,
          notes: labelNotes || null,
          share_scope: labelShareScope,
          example_kind: labelExampleKind,
        }),
      });

      if (!response.ok) {
        setLabelSetState("error");
        return;
      }

      setLabelSetState("saved");
    } catch {
      setLabelSetState("error");
    }
  }

  return (
    <div className="max-w-[88rem] pb-10">
      <Link href="/conversations" className="mb-5 inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
        <ArrowLeft className="w-4 h-4" /> Back to conversations
      </Link>

      <div className="mb-6 rounded-[1rem] border border-[var(--border-subtle)] bg-[var(--panel)] p-5 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="enterprise-kicker">Conversation review</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
              {conv.customer_identifier || "Unknown"}
            </h1>
            <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
              {conv.platform} · {conv.message_count} messages
              {conv.was_escalated && " · Escalated"}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-3 py-1 text-xs text-[var(--text-secondary)] capitalize">
                {conv.platform}
              </span>
              {conv.was_escalated ? (
                <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                  Escalated
                </span>
              ) : null}
              {confidenceLevel ? (
                <span className={`rounded-full border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-3 py-1 text-xs font-medium capitalize ${confidenceTone}`}>
                  {confidenceLevel} confidence
                </span>
              ) : null}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Overall</p>
              <div className="mt-2">{qs && <ScoreBadge score={qs.overall_score} size="lg" label="overall" />}</div>
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Assessment</p>
              <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{assessmentHeading}</p>
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Evidence</p>
              <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
                {groundingRiskFlags.length > 0 ? "Evidence limited" : "Clear enough"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.95fr)]">
        <div className="space-y-4">
          <GlassCard className="rounded-[1rem] p-5">
            <div className="mb-4 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[var(--text-secondary)]" />
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Operator takeaway</h2>
            </div>
            <p className="text-base font-semibold text-[var(--text-primary)]">{assessmentHeading}</p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              {operatorGuidance}
            </p>
          </GlassCard>

          <GlassCard className="rounded-[1rem] p-5">
            <h2 className="mb-5 text-sm font-semibold text-[var(--text-primary)]">Transcript</h2>
            {conv.messages.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No messages found.</p>
            ) : (
              <div className="space-y-4">
                {conv.messages.map((msg) => {
                  const config = roleConfig[msg.role] || roleConfig.system;
                  const Icon = config.icon;
                  const flaggedClaims: ClaimAnalysis[] = lowConfidenceGroundingOnly
                    ? []
                    : qs?.claim_analysis?.filter(
                    (ca) => ca.verdict !== "verified" && msg.content.toLowerCase().includes(ca.claim.toLowerCase().slice(0, 20))
                  ) || [];

                  return (
                    <div key={msg.id} className={`flex ${config.align === "ml-auto" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] ${config.bg} rounded-2xl p-4`}>
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                          <span className="text-xs font-medium text-[var(--text-muted)]">{config.label}</span>
                        </div>
                        <p className="text-sm text-[var(--text-primary)] leading-relaxed">{msg.content}</p>
                        {flaggedClaims.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {flaggedClaims.map((claim, i) => (
                              <div
                                key={i}
                                className={`flex items-start gap-2 p-2 rounded-lg text-xs ${
                                  claim.verdict === "fabricated" ? "score-bg-critical" : "score-bg-warning"
                                }`}
                              >
                                <AlertTriangle className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${
                                  claim.verdict === "fabricated" ? "score-critical" : "score-warning"
                                }`} />
                                <div>
                                  <span className={`font-medium capitalize ${
                                    claim.verdict === "fabricated" ? "score-critical" : "score-warning"
                                  }`}>{claim.verdict}:</span>{" "}
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

          {/* Prompt Improvements */}
          {qs && visiblePromptImprovements.length > 0 && (
            <GlassCard className="rounded-[1.1rem] p-6">
              <div className="flex items-center gap-2 mb-4">
                <Brain className="w-4 h-4 text-[var(--text-secondary)]" />
                <h2 className="text-sm font-medium text-[var(--text-primary)]">
                  {groundingOnlyScore ? "Suggested trust improvement" : "Recommended prompt improvements"}
                </h2>
              </div>
              <div className="space-y-4">
                {visiblePromptImprovements.map((imp, i) => (
                  <div key={i} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-[var(--text-primary)]">{imp.issue}</p>
                      <SeverityBadge severity={imp.priority === "high" ? "high" : imp.priority === "medium" ? "medium" : "low"} />
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mb-3">
                      <strong>Current behavior:</strong> {imp.current_behavior}
                    </p>
                    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--panel-subtle)] p-3 font-mono text-xs text-[var(--text-primary)] leading-relaxed">
                      {imp.recommended_prompt_change}
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-2">Expected impact: {imp.expected_impact}</p>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {/* Knowledge Gaps */}
          {qs && visibleKnowledgeGaps.length > 0 && (
            <GlassCard className="rounded-[1.1rem] p-6">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="w-4 h-4 text-[var(--text-secondary)]" />
                <h2 className="text-sm font-medium text-[var(--text-primary)]">Knowledge gaps</h2>
              </div>
              <div className="space-y-3">
                {visibleKnowledgeGaps.map((gap, i) => (
                  <div key={i} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
                    <p className="text-sm font-medium text-[var(--text-primary)] capitalize mb-1">{gap.topic}</p>
                    <p className="text-xs text-[var(--text-secondary)] mb-2">{gap.description}</p>
                    <p className="text-xs text-[var(--text-muted)]">Suggested content: {gap.suggested_content}</p>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </div>

        <div className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          {qs ? (
            <>
              <GlassCard className="rounded-[1rem] p-5">
                <div className="mb-4 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-[var(--text-secondary)]" />
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">What to check</h2>
                </div>
                {checks.length === 0 ? (
                  <p className="text-sm text-[var(--text-secondary)]">
                    Nothing important stands out for manual checking.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {checks.map((item, index) => (
                      <div key={`${item.claim}-${index}`} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                          {item.label}
                        </p>
                        <p className="mt-2 text-sm leading-5 text-[var(--text-primary)]">{item.claim}</p>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>

              <GlassCard className="rounded-[1rem] p-5">
                <div className="mb-4 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[var(--text-secondary)]" />
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">What worked</h2>
                </div>
                {strengths.length === 0 ? (
                  <p className="text-sm text-[var(--text-secondary)]">
                    No clear positive signals were extracted automatically.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {strengths.map((strength) => (
                      <div key={strength} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-3 py-2.5 text-sm text-[var(--text-primary)]">
                        {strength}
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>

              <GlassCard className="rounded-[1rem] p-5">
                <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Quality scores</h2>
                <div className="space-y-4">
                  {[
                    { label: "Overall", score: qs.overall_score },
                    { label: "Accuracy", score: qs.accuracy_score },
                    { label: "Hallucination", score: qs.hallucination_score },
                    { label: "Resolution", score: qs.resolution_score },
                    { label: "Tone", score: qs.tone_score },
                    { label: "Sentiment", score: qs.sentiment_score },
                  ].map(({ label, score }) => (
                    <div key={label}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-[var(--text-secondary)]">{label}</span>
                        <span className={`text-sm font-mono font-semibold ${scoreColor(score || 0)}`}>
                          {formatScore(score || 0)}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--surface)]">
                        <div
                          className={`h-full rounded-full transition-all ${
                            (score || 0) >= 0.7 ? "bg-score-good" : (score || 0) >= 0.4 ? "bg-score-warning" : "bg-score-critical"
                          }`}
                          style={{ width: `${(score || 0) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>

              <GlassCard className="rounded-[1rem] p-5">
                <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Assessment</h2>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{qs.summary || "No summary."}</p>
                {confidenceLevel ? (
                  <div className="mt-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--panel-subtle)] p-3">
                    <p className="text-xs text-[var(--text-muted)]">Confidence</p>
                    <p className={`mt-1 text-sm font-medium capitalize ${confidenceTone}`}>
                      {confidenceLevel}
                    </p>
                  </div>
                ) : null}
                {lowConfidenceGroundingOnly ? (
                  <div className="mt-3 inline-flex items-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
                    Evidence was limited in the transcript
                  </div>
                ) : null}
                {qs.structural_metrics?.learned_calibration?.applied ? (
                  <div className="mt-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--panel-subtle)] p-3">
                    <p className="text-xs text-[var(--text-muted)]">Calibration model</p>
                    <p className="mt-1 text-sm text-[var(--text-primary)]">
                      Learned calibration adjusted this score using human labels.
                    </p>
                  </div>
                ) : null}
              </GlassCard>

              {visibleFlags.length > 0 && (
                <GlassCard className="rounded-[1rem] p-5">
                  <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
                    Review notes
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {visibleFlags.map((flag, i) => (
                      <span
                        key={i}
                        className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          /(grounding|tool_backed|verification|trace|unverified|ungrounded)/i.test(flag)
                            ? "score-bg-warning score-warning"
                            : "score-bg-critical score-critical"
                        }`}
                      >
                        {flag}
                      </span>
                    ))}
                  </div>
                </GlassCard>
              )}

              {visibleClaimAnalysis.length > 0 && !lowConfidenceGroundingOnly ? (
                <GlassCard className="rounded-[1rem] p-5">
                  <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
                    Claim checks
                  </h2>
                  <div className="space-y-2.5">
                    {visibleClaimAnalysis.map((ca, i) => {
                      const verdictColor = {
                        verified: "score-good",
                        unverifiable: "text-[var(--text-muted)]",
                        contradicted: "score-warning",
                        fabricated: "score-critical",
                      }[ca.verdict];
                      return (
                        <div key={i} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] p-2.5">
                          <p className="text-xs text-[var(--text-primary)] mb-1">{ca.claim}</p>
                          <span className={`text-xs font-medium capitalize ${verdictColor}`}>{ca.verdict}</span>
                        </div>
                      );
                    })}
                  </div>
                </GlassCard>
              ) : null}
            </>
          ) : (
            <GlassCard className="rounded-[1rem] p-5">
              <p className="text-sm text-[var(--text-muted)]">
                {conv.score_status === "waiting_for_completion"
                  ? "Waiting for the conversation to finish before scoring..."
                  : conv.score_status === "refreshing"
                    ? "Refreshing assessment..."
                    : "Scoring in progress..."}
              </p>
            </GlassCard>
          )}

          <GlassCard className="rounded-[1rem] p-5">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Correct the score</h2>
            <p className="text-xs text-[var(--text-muted)] mb-3">
              Disagree with the assessment? Override a score to calibrate the model.
            </p>
            {showOverrideForm ? (
              <div className="space-y-3">
                <select
                  value={overrideDimension}
                  onChange={(e) => setOverrideDimension(e.target.value)}
                  className="glass-input w-full px-3 py-2 text-sm"
                >
                  <option value="overall">Overall</option>
                  <option value="accuracy">Accuracy</option>
                  <option value="hallucination">Hallucination</option>
                  <option value="resolution">Resolution</option>
                  <option value="tone">Tone</option>
                  <option value="sentiment">Sentiment</option>
                </select>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={overrideScore}
                  onChange={(e) => setOverrideScore(e.target.value)}
                  className="glass-input w-full px-3 py-2 text-sm"
                  placeholder="Adjusted score %"
                />
                <textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="glass-input min-h-[88px] w-full px-3 py-2 text-sm"
                  placeholder="Why is the current score wrong?"
                />
                <div className="flex gap-2">
                  <GlassButton size="sm" className="w-full" onClick={submitOverride} disabled={overrideState === "saving"}>
                    {overrideState === "saving" ? "Saving..." : "Save override"}
                  </GlassButton>
                  <GlassButton size="sm" variant="ghost" className="w-full" onClick={() => setShowOverrideForm(false)}>
                    Cancel
                  </GlassButton>
                </div>
              </div>
            ) : (
              <GlassButton size="sm" className="w-full" onClick={() => setShowOverrideForm(true)}>
                Submit Override
              </GlassButton>
            )}
            {overrideState === "saved" ? (
              <p className="mt-3 text-xs text-score-good">Override saved.</p>
            ) : null}
            {overrideState === "error" ? (
              <p className="mt-3 text-xs text-score-critical">Failed to save override.</p>
            ) : null}
          </GlassCard>

          <GlassCard className="rounded-[1rem] p-5">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Train the scorer</h2>
            <p className="text-xs text-[var(--text-muted)] mb-4">
              Save a full human label set for this conversation. AgentGrade uses these labels to evaluate scoring regressions and train a lightweight calibration model on top of the base evaluator.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <GlassSelect
                label="Example type"
                value={labelExampleKind}
                onChange={(event) => setLabelExampleKind(event.target.value as "real" | "synthetic")}
                options={[
                  { value: "real", label: "Real customer conversation" },
                  { value: "synthetic", label: "Synthetic or fake test case" },
                ]}
              />
              <GlassSelect
                label="Training scope"
                value={labelShareScope}
                onChange={(event) => setLabelShareScope(event.target.value as "workspace_private" | "global_anonymous")}
                options={[
                  { value: "workspace_private", label: "Private to this workspace" },
                  { value: "global_anonymous", label: "Contribute anonymized features globally" },
                ]}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["overall", "Overall"],
                ["accuracy", "Accuracy"],
                ["hallucination", "Hallucination"],
                ["resolution", "Resolution"],
                ["escalation", "Escalation"],
                ["tone", "Tone"],
                ["sentiment", "Sentiment"],
              ].map(([key, label]) => (
                <div key={key}>
                  <p className="mb-1 text-xs text-[var(--text-secondary)]">{label}</p>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={trainingLabels[key as keyof typeof trainingLabels]}
                    onChange={(event) =>
                      setTrainingLabels((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                    className="glass-input w-full px-3 py-2 text-sm"
                    placeholder="Optional %"
                  />
                </div>
              ))}
            </div>
            <GlassButton
              size="sm"
              variant="ghost"
              className="mt-3 w-full"
              onClick={() =>
                setTrainingLabels({
                  overall: qs ? String(Math.round(qs.overall_score * 100)) : "",
                  accuracy: qs?.accuracy_score !== undefined ? String(Math.round(qs.accuracy_score * 100)) : "",
                  hallucination: qs?.hallucination_score !== undefined ? String(Math.round(qs.hallucination_score * 100)) : "",
                  resolution: qs?.resolution_score !== undefined ? String(Math.round(qs.resolution_score * 100)) : "",
                  escalation: qs?.escalation_score !== undefined ? String(Math.round(qs.escalation_score * 100)) : "",
                  tone: qs?.tone_score !== undefined ? String(Math.round(qs.tone_score * 100)) : "",
                  sentiment: qs?.sentiment_score !== undefined ? String(Math.round(qs.sentiment_score * 100)) : "",
                })
              }
            >
              Start from current scores
            </GlassButton>
            <GlassTextarea
              value={labelNotes}
              onChange={(event) => setLabelNotes(event.target.value)}
              className="mt-3 min-h-[96px]"
              placeholder="Why are these labels correct? Capture groundedness, user intent, escalation quality, and any notes for calibration."
            />
            <p className="mt-2 text-[11px] leading-5 text-[var(--text-muted)]">
              Global sharing uses anonymized score features and your labels, not raw transcript text.
            </p>
            <GlassButton size="sm" className="mt-3 w-full" onClick={submitTrainingLabels} disabled={labelSetState === "saving"}>
              {labelSetState === "saving" ? "Saving labels..." : "Save gold-set labels"}
            </GlassButton>
            {labelSetState === "saved" ? (
              <p className="mt-3 text-xs text-score-good">Gold-set labels saved.</p>
            ) : null}
            {labelSetState === "error" ? (
              <p className="mt-3 text-xs text-score-critical">Failed to save training labels.</p>
            ) : null}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
