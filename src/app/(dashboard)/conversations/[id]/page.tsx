"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { GlassCard } from "@/components/ui/glass-card";
import { ScoreBadge, SeverityBadge } from "@/components/ui/score-badge";
import { GlassButton } from "@/components/ui/glass-button";
import { scoreColor, formatScore } from "@/lib/utils";
import { ArrowLeft, AlertTriangle, Brain, BookOpen, User, Bot, Headphones } from "lucide-react";
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
  score_status?: "pending" | "refreshing" | "ready" | "waiting_for_completion" | "waiting_for_quiet_period";
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

  const roleConfig = {
    customer: { icon: User, label: "Customer", bg: "bg-[rgba(0,0,0,0.02)]", align: "mr-auto" },
    agent: { icon: Bot, label: "AI Agent", bg: "bg-[rgba(0,0,0,0.04)]", align: "ml-auto" },
    human_agent: { icon: Headphones, label: "Human Agent", bg: "bg-[rgba(59,130,246,0.05)]", align: "ml-auto" },
    tool: { icon: Bot, label: "Tool", bg: "bg-[rgba(16,185,129,0.06)]", align: "mx-auto" },
    system: { icon: Bot, label: "System", bg: "bg-[rgba(0,0,0,0.02)]", align: "mx-auto" },
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
    <div className="max-w-6xl">
      <Link href="/conversations" className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to conversations
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">{conv.customer_identifier || "Unknown"}</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {conv.platform} &middot; {conv.message_count} messages
            {conv.was_escalated && " · Escalated"}
          </p>
        </div>
        {qs && <ScoreBadge score={qs.overall_score} size="lg" label="overall" />}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Conversation Transcript */}
        <div className="col-span-2 space-y-4">
          <GlassCard className="p-6">
            <h2 className="text-sm font-medium text-[var(--text-primary)] mb-5">Conversation</h2>
            {conv.messages.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No messages found.</p>
            ) : (
              <div className="space-y-4">
                {conv.messages.map((msg) => {
                  const config = roleConfig[msg.role] || roleConfig.system;
                  const Icon = config.icon;
                  const flaggedClaims: ClaimAnalysis[] = qs?.claim_analysis?.filter(
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
          {qs && qs.prompt_improvements.length > 0 && (
            <GlassCard className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Brain className="w-4 h-4 text-[var(--text-secondary)]" />
                <h2 className="text-sm font-medium text-[var(--text-primary)]">Recommended Prompt Improvements</h2>
              </div>
              <div className="space-y-4">
                {qs.prompt_improvements.map((imp, i) => (
                  <div key={i} className="p-4 rounded-xl bg-[rgba(0,0,0,0.02)]">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-[var(--text-primary)]">{imp.issue}</p>
                      <SeverityBadge severity={imp.priority === "high" ? "high" : imp.priority === "medium" ? "medium" : "low"} />
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mb-3">
                      <strong>Current behavior:</strong> {imp.current_behavior}
                    </p>
                    <div className="p-3 rounded-lg bg-[rgba(0,0,0,0.03)] font-mono text-xs text-[var(--text-primary)] leading-relaxed">
                      {imp.recommended_prompt_change}
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-2">Expected impact: {imp.expected_impact}</p>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {/* Knowledge Gaps */}
          {qs && qs.knowledge_gaps.length > 0 && (
            <GlassCard className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="w-4 h-4 text-[var(--text-secondary)]" />
                <h2 className="text-sm font-medium text-[var(--text-primary)]">Knowledge Base Gaps</h2>
              </div>
              <div className="space-y-3">
                {qs.knowledge_gaps.map((gap, i) => (
                  <div key={i} className="p-4 rounded-xl bg-[rgba(0,0,0,0.02)]">
                    <p className="text-sm font-medium text-[var(--text-primary)] capitalize mb-1">{gap.topic}</p>
                    <p className="text-xs text-[var(--text-secondary)] mb-2">{gap.description}</p>
                    <p className="text-xs text-[var(--text-muted)]">Suggested content: {gap.suggested_content}</p>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </div>

        {/* Score Sidebar */}
        <div className="space-y-4">
          {qs ? (
            <>
              <GlassCard className="p-5">
                <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4">Quality Scores</h2>
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
                      <div className="h-1.5 rounded-full bg-[rgba(0,0,0,0.04)]">
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

              <GlassCard className="p-5">
                <h2 className="text-sm font-medium text-[var(--text-primary)] mb-3">Summary</h2>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{qs.summary || "No summary."}</p>
                {confidenceLevel ? (
                  <div className="mt-4 rounded-xl bg-[rgba(0,0,0,0.02)] p-3">
                    <p className="text-xs text-[var(--text-muted)]">Confidence</p>
                    <p className={`mt-1 text-sm font-medium capitalize ${confidenceTone}`}>
                      {confidenceLevel}
                    </p>
                  </div>
                ) : null}
              </GlassCard>

              {qs.flags.length > 0 && (
                <GlassCard className="p-5">
                  <h2 className="text-sm font-medium text-[var(--text-primary)] mb-3">Flags</h2>
                  <div className="flex flex-wrap gap-2">
                    {qs.flags.map((flag, i) => (
                      <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-[rgba(239,68,68,0.08)] text-[#EF4444] font-medium">
                        {flag}
                      </span>
                    ))}
                  </div>
                </GlassCard>
              )}

              {qs.claim_analysis.length > 0 && (
                <GlassCard className="p-5">
                  <h2 className="text-sm font-medium text-[var(--text-primary)] mb-3">Claim Verification</h2>
                  <div className="space-y-2.5">
                    {qs.claim_analysis.map((ca, i) => {
                      const verdictColor = {
                        verified: "score-good",
                        unverifiable: "text-[var(--text-muted)]",
                        contradicted: "score-warning",
                        fabricated: "score-critical",
                      }[ca.verdict];
                      return (
                        <div key={i} className="p-2.5 rounded-lg bg-[rgba(0,0,0,0.02)]">
                          <p className="text-xs text-[var(--text-primary)] mb-1">{ca.claim}</p>
                          <span className={`text-xs font-medium capitalize ${verdictColor}`}>{ca.verdict}</span>
                        </div>
                      );
                    })}
                  </div>
                </GlassCard>
              )}
            </>
          ) : (
            <GlassCard className="p-5">
              <p className="text-sm text-[var(--text-muted)]">
                {conv.score_status === "waiting_for_completion"
                  ? "Waiting for the conversation to finish before scoring..."
                  : conv.score_status === "waiting_for_quiet_period"
                    ? "Waiting for 10 minutes of inactivity before scoring..."
                  : conv.score_status === "refreshing"
                    ? "Refreshing assessment..."
                    : "Scoring in progress..."}
              </p>
            </GlassCard>
          )}

          <GlassCard className="p-5">
            <h2 className="text-sm font-medium text-[var(--text-primary)] mb-3">Override Score</h2>
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

          <GlassCard className="p-5">
            <h2 className="text-sm font-medium text-[var(--text-primary)] mb-3">Training Label Set</h2>
            <p className="text-xs text-[var(--text-muted)] mb-4">
              Save a full human label set for this conversation. These labels are used for scorer calibration and evaluation, not instant live fine-tuning.
            </p>
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
            <textarea
              value={labelNotes}
              onChange={(event) => setLabelNotes(event.target.value)}
              className="glass-input mt-3 min-h-[96px] w-full px-3 py-2 text-sm"
              placeholder="Why are these labels correct? Capture groundedness, user intent, escalation quality, and any notes for calibration."
            />
            <GlassButton size="sm" className="mt-3 w-full" onClick={submitTrainingLabels} disabled={labelSetState === "saving"}>
              {labelSetState === "saving" ? "Saving labels..." : "Save training labels"}
            </GlassButton>
            {labelSetState === "saved" ? (
              <p className="mt-3 text-xs text-score-good">Training labels saved.</p>
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
