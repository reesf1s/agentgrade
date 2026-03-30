"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  Headphones,
  Info,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { GlassButton } from "@/components/ui/glass-button";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassSelect, GlassTextarea } from "@/components/ui/glass-input";
import { ScoreBadge } from "@/components/ui/score-badge";
import { useToast } from "@/components/ui/toast";
import { scoreColor, formatScore } from "@/lib/utils";
import type { ClaimAnalysis, Message, QualityScore } from "@/lib/db/types";
import { isGroundingRiskOnlyScore } from "@/lib/scoring/quality-score-status";
import {
  getConversationDispositionMap,
  setConversationDisposition,
  setQueueState,
  type ReviewDisposition,
} from "@/lib/review-workflow";

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

interface ReviewGroup {
  title: string;
  body: string;
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
    strengths.push("Clear next step");
  }
  if ((score?.tone_score || 0) >= 0.84) {
    strengths.push("Calm tone");
  }
  if (hasStructuredAnswer(messages)) {
    strengths.push("Clear structure");
  }
  if ((score?.overall_score || 0) >= 0.8) {
    strengths.push("Reusable pattern");
  }

  return strengths.slice(0, 3);
}

function claimLooksLikeDate(text: string) {
  return /\b(today|tomorrow|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december|deadline|due|close date|week|month|quarter|day)\b/i.test(
    text
  );
}

function claimLooksLikeNumber(text: string) {
  return /[%£$€]|\b\d+(\.\d+)?\b|score|probability|value|hours|rate|metric|accuracy|conversion|win rate|amount/i.test(
    text
  );
}

function claimLooksLikeRecord(text: string) {
  return /\b(deal|account|company|contact|ticket|subscription|order|record|crm|pipeline|stage|owner|champion|todo|history|health|risk|briefing|competitor)\b/i.test(
    text
  );
}

function buildReviewGroups(score?: QualityScore | null): ReviewGroup[] {
  const claims = (score?.claim_analysis || []).filter((claim) => claim.verdict !== "verified");
  if (claims.length === 0) {
    return [];
  }

  const groups: ReviewGroup[] = [];

  if (claims.some((claim) => claimLooksLikeRecord(claim.claim))) {
    groups.push({
      title: "Record details",
      body: "Deal fields, contact roles, or internal record details should be checked against the source system before reuse.",
    });
  }

  if (claims.some((claim) => claimLooksLikeNumber(claim.claim))) {
    groups.push({
      title: "Numbers and scores",
      body: "Metrics, values, probabilities, or score changes were stated confidently and should be spot-checked before anyone acts on them.",
    });
  }

  if (claims.some((claim) => claimLooksLikeDate(claim.claim))) {
    groups.push({
      title: "Dates and timing",
      body: "Dates, deadlines, and overdue status should be checked before they are used in planning or follow-up.",
    });
  }

  if (groups.length === 0) {
    groups.push({
      title: "Specific details",
      body: "A few specific claims are not fully traceable in the transcript and are worth a quick spot-check.",
    });
  }

  return groups.slice(0, 3);
}

function nextBestAction(score?: QualityScore | null, groundingOnly = false) {
  if (!score) return "Wait for score";
  if (groundingOnly) return "Verify first";
  if ((score.overall_score || 0) >= 0.82) return "Safe";
  if ((score.overall_score || 0) >= 0.65) return "Watch";
  return "Escalate";
}

function isLongMessage(content: string) {
  return content.length > 520 || content.split("\n").length > 10;
}

function groupClaimsForAdvancedReview(score?: QualityScore | null) {
  const claims = (score?.claim_analysis || []).filter((claim) => claim.verdict !== "verified");
  const grouped: Array<{ title: string; items: ClaimAnalysis[] }> = [];

  const buckets = [
    {
      title: "Record details to verify",
      test: (claim: ClaimAnalysis) => claimLooksLikeRecord(claim.claim),
    },
    {
      title: "Numbers to verify",
      test: (claim: ClaimAnalysis) => claimLooksLikeNumber(claim.claim),
    },
    {
      title: "Dates to verify",
      test: (claim: ClaimAnalysis) => claimLooksLikeDate(claim.claim),
    },
  ];

  const remaining = [...claims];

  for (const bucket of buckets) {
    const items = remaining.filter(bucket.test);
    if (items.length > 0) {
      grouped.push({ title: bucket.title, items: items.slice(0, 4) });
      for (const item of items) {
        const index = remaining.indexOf(item);
        if (index >= 0) remaining.splice(index, 1);
      }
    }
  }

  if (remaining.length > 0) {
    grouped.push({ title: "Other details to sense-check", items: remaining.slice(0, 4) });
  }

  return grouped;
}

function getAssessmentLabel(score?: QualityScore | null, groundingOnly = false) {
  if (!score) return "Scoring in progress";
  if (groundingOnly && (score.overall_score || 0) >= 0.74) return "Strong answer";
  if ((score.overall_score || 0) >= 0.82) return "Healthy";
  if ((score.overall_score || 0) >= 0.65) return "Needs review";
  if ((score.overall_score || 0) >= 0.45) return "Risky";
  return "Broken";
}

function getRiskLine(score?: QualityScore | null, groundingOnly = false) {
  if (!score) return "Pending";
  if (groundingOnly) return "Moderate if reused";
  if ((score.overall_score || 0) >= 0.82) return "Low reuse risk";
  if ((score.overall_score || 0) >= 0.65) return "Moderate if reused";
  return "High confusion risk";
}

function getEvidenceLabel(score?: QualityScore | null, groundingOnly = false) {
  if (!score) return null;
  if (groundingOnly) return "Evidence limited";
  const flags = score.flags || [];
  if (flags.some((flag) => /grounding|trace|tool_backed|unverified|ungrounded/i.test(flag))) {
    return "Evidence mixed";
  }
  return "Evidence strong";
}

function getDisplaySummary(score?: QualityScore | null, groundingOnly = false) {
  if (!score) return "Scoring in progress.";
  if (groundingOnly) {
    return "Useful, but verify first.";
  }
  return score.summary || "No summary available.";
}

export default function ConversationDetailPage() {
  const params = useParams();
  const [conv, setConv] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [showAdvancedDrawer, setShowAdvancedDrawer] = useState(false);
  const [reviewDisposition, setReviewDispositionState] = useState<ReviewDisposition | null>(null);
  const [savingDisposition, setSavingDisposition] = useState<ReviewDisposition | null>(null);
  const [nextConversationId, setNextConversationId] = useState<string | null>(null);
  const [overrideDimension, setOverrideDimension] = useState("overall");
  const [overrideScore, setOverrideScore] = useState("50");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideState, setOverrideState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [showTrainingForm, setShowTrainingForm] = useState(false);
  const [labelSetState, setLabelSetState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [labelNotes, setLabelNotes] = useState("");
  const [labelShareScope, setLabelShareScope] = useState<"workspace_private" | "global_anonymous">("workspace_private");
  const [labelExampleKind, setLabelExampleKind] = useState<"real" | "synthetic">("real");
  const [expandedMessages, setExpandedMessages] = useState<Record<string, boolean>>({});
  const { success, error } = useToast();
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
          }, 2500);
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

  useEffect(() => {
    if (!conv) return;
    const dispositions = getConversationDispositionMap();
    setReviewDispositionState(dispositions[conv.id] || null);
  }, [conv]);

  useEffect(() => {
    let cancelled = false;

    async function loadNextConversation() {
      try {
        const response = await fetch("/api/conversations?limit=100", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (cancelled) return;

        const list = (data.conversations || []) as Array<{ id: string }>;
        const currentIndex = list.findIndex((item) => item.id === params.id);
        if (currentIndex >= 0 && currentIndex < list.length - 1) {
          setNextConversationId(list[currentIndex + 1]?.id || null);
        } else {
          setNextConversationId(null);
        }
      } catch (error) {
        console.error(error);
      }
    }

    void loadNextConversation();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

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

  async function updateDisposition(disposition: ReviewDisposition) {
    if (!conv) return;
    const previousDisposition = reviewDisposition;
    setConversationDisposition(conv.id, disposition);
    setReviewDispositionState(disposition);
    setSavingDisposition(disposition);

    const queueState =
      disposition === "safe"
        ? "safe"
        : disposition === "ignore"
          ? "reviewed"
          : disposition === "escalate_issue"
            ? "escalated"
            : disposition === "action_needed"
              ? "needs_review"
              : "reviewed";

    setQueueState(conv.id, queueState);
    try {
      const response = await fetch(`/api/conversations/${conv.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disposition, queue_state: queueState }),
      });

      if (!response.ok) {
        throw new Error("Failed to save review state");
      }

      success(`Marked as ${disposition.replaceAll("_", " ")}`);
    } catch (err) {
      console.error(err);
      if (previousDisposition) {
        setConversationDisposition(conv.id, previousDisposition);
      }
      setReviewDispositionState(previousDisposition || null);
      error("Could not save action. Retry.");
    } finally {
      setSavingDisposition(null);
    }
  }

  if (loading) {
    return (
      <div className="pb-8">
        <Link href="/conversations" className="mb-5 inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          <ArrowLeft className="h-3.5 w-3.5" /> Review queue
        </Link>
        <div className="glass-static p-10 text-center">
          <p className="text-sm text-[var(--text-muted)]">Loading…</p>
        </div>
      </div>
    );
  }

  if (notFound || !conv) {
    return (
      <div className="pb-8">
        <Link href="/conversations" className="mb-5 inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          <ArrowLeft className="h-3.5 w-3.5" /> Review queue
        </Link>
        <div className="glass-static p-10 text-center">
          <p className="text-sm text-[var(--text-muted)]">Conversation not found.</p>
        </div>
      </div>
    );
  }

  const qs = conv.quality_score;
  const groundingOnly = isGroundingRiskOnlyScore(qs);
  const confidenceLevel = qs?.confidence_level ?? qs?.structural_metrics?.confidence_level;
  const evidenceLabel = getEvidenceLabel(qs, groundingOnly);
  const assessmentLabel = getAssessmentLabel(qs, groundingOnly);
  const riskLine = getRiskLine(qs, groundingOnly);
  const displaySummary = getDisplaySummary(qs, groundingOnly);
  const strengths = deriveStrengths(conv.messages, qs);
  const reviewGroups = buildReviewGroups(qs);
  const advancedClaimGroups = groupClaimsForAdvancedReview(qs);
  const showKnowledgeAndPromptDetails = !groundingOnly;
  const actionState = nextBestAction(qs, groundingOnly);

  const msgConfig = {
    customer:    { icon: User,      label: "Customer",     bubbleClass: "msg-customer", align: "start" as const },
    agent:       { icon: Bot,       label: "AI agent",     bubbleClass: "msg-agent",    align: "end"   as const },
    human_agent: { icon: Headphones,label: "Human agent",  bubbleClass: "msg-human",    align: "end"   as const },
    tool:        { icon: Sparkles,  label: "Tool call",    bubbleClass: "msg-tool",     align: "center"as const },
    system:      { icon: Sparkles,  label: "System",       bubbleClass: "msg-tool",     align: "center"as const },
  } as const;

  const scoreRows = qs ? [
    { label: "Overall",       score: qs.overall_score },
    { label: "Accuracy",      score: qs.accuracy_score },
    { label: "Hallucination", score: qs.hallucination_score },
    { label: "Resolution",    score: qs.resolution_score },
    { label: "Tone",          score: qs.tone_score },
  ] : [];

  const dispositions: { value: ReviewDisposition; label: string; hint: string }[] = [
    { value: "safe",           label: "Safe",          hint: "No issues, good to go" },
    { value: "watch",          label: "Watch",         hint: "Monitor for patterns" },
    { value: "action_needed",  label: "Needs action",  hint: "Something to fix" },
    { value: "escalate_issue", label: "Escalate",      hint: "Raise with the team" },
    { value: "ignore",         label: "Ignore",        hint: "Not relevant to review" },
  ];

  return (
    <div className="space-y-4 pb-8">
      {/* Topnav */}
      <div className="flex items-center justify-between gap-4">
        <Link href="/conversations" className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          Review queue
        </Link>
        <div className="flex items-center gap-2">
          {nextConversationId && (
            <Link href={`/conversations/${nextConversationId}`} className="glass-button inline-flex items-center gap-1.5 text-xs">
              Next <ArrowRight className="h-3 w-3" />
            </Link>
          )}
          <button type="button" className="glass-button text-xs" onClick={() => setShowAdvancedDrawer(true)}>
            Advanced
          </button>
        </div>
      </div>

      {/* Header card */}
      <div className="glass-static p-5">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="operator-chip capitalize">{conv.platform}</span>
          <span className="operator-chip">{new Date(conv.created_at).toLocaleDateString("en-GB")}</span>
          <span className="operator-chip">{conv.message_count} messages</span>
          {qs ? <ScoreBadge score={qs.overall_score} size="sm" /> : <span className="operator-chip">Scoring…</span>}
          <span className={`operator-chip font-medium ${
            assessmentLabel === "Healthy" || assessmentLabel === "Strong answer" ? "!text-[#16A34A] !border-[#BBF7D0] !bg-[#F0FDF4]" :
            assessmentLabel === "Needs review" || assessmentLabel === "Risky" ? "!text-[#D97706] !border-[#FDE68A] !bg-[#FFFBEB]" :
            assessmentLabel === "Broken" ? "!text-[#DC2626] !border-[#FECACA] !bg-[#FEF2F2]" : ""
          }`}>{assessmentLabel}</span>
          {conv.was_escalated && <span className="operator-chip !text-[#D97706] !border-[#FDE68A] !bg-[#FFFBEB]">Escalated</span>}
        </div>

        <h1 className="text-xl font-bold tracking-[-0.02em] text-[var(--text-primary)]">
          {conv.customer_identifier || "Unknown customer"}
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
          {groundingOnly ? "Useful, but verify specific claims before reuse." : displaySummary}
        </p>

        {(strengths.length > 0 || reviewGroups.length > 0) && (
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-[var(--divider)] pt-3.5 text-xs">
            {strengths[0] && (
              <span className="flex items-center gap-1.5 font-medium text-[#16A34A]">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {strengths[0]}
              </span>
            )}
            {reviewGroups.slice(0, 2).map((g) => (
              <span key={g.title} className="flex items-center gap-1.5 font-medium text-[#D97706]">
                <AlertTriangle className="h-3.5 w-3.5" />
                Check: {g.title}
              </span>
            ))}
            <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
              <Info className="h-3.5 w-3.5" />
              {riskLine}
            </span>
          </div>
        )}
      </div>

      {/* Main 2-col grid */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">

        {/* Transcript */}
        <div className="glass-static overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-5 py-3">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Conversation transcript</p>
            <div className="flex gap-2">
              {evidenceLabel && <span className="operator-chip">{evidenceLabel}</span>}
            </div>
          </div>

          {conv.messages.length === 0 ? (
            <p className="p-5 text-sm text-[var(--text-muted)]">No messages recorded.</p>
          ) : (
            <div className="space-y-3 p-4">
              {conv.messages.map((message) => {
                const cfg = msgConfig[message.role as keyof typeof msgConfig] || msgConfig.system;
                const Icon = cfg.icon;
                const expanded = expandedMessages[message.id] || false;
                const collapsible = message.role === "agent" && isLongMessage(message.content);
                const preview = collapsible && !expanded ? `${message.content.slice(0, 520).trimEnd()}…` : message.content;
                const isRight = cfg.align === "end";
                const isCenter = cfg.align === "center";

                return (
                  <div key={message.id} className={`flex ${isRight ? "justify-end" : isCenter ? "justify-center" : "justify-start"}`}>
                    <div className={`max-w-[85%] px-4 py-3 text-sm ${cfg.bubbleClass}`}>
                      <div className={`mb-2 flex items-center gap-1.5 ${isRight ? "justify-end flex-row-reverse" : ""}`}>
                        <Icon className="h-3 w-3 text-[var(--text-muted)] shrink-0" />
                        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                          {cfg.label}
                        </span>
                      </div>
                      <p className={`whitespace-pre-wrap leading-relaxed text-[var(--text-primary)] ${isRight ? "text-right" : ""}`}>
                        {preview}
                      </p>
                      {collapsible && (
                        <button
                          type="button"
                          onClick={() => setExpandedMessages((cur) => ({ ...cur, [message.id]: !expanded }))}
                          className="mt-2.5 text-xs font-semibold text-[var(--btn-primary-bg)] hover:underline"
                        >
                          {expanded ? "Show less" : "Show full response"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto xl:self-start">

          {/* Score card */}
          <div className="glass-static p-4">
            <p className="section-label mb-3">Quality scores</p>
            {!qs ? (
              <p className="text-sm text-[var(--text-secondary)]">
                {conv.score_status === "waiting_for_completion"
                  ? "Waiting for conversation to end."
                  : conv.score_status === "refreshing"
                  ? "Updating score…"
                  : "Scoring in progress…"}
              </p>
            ) : (
              <div className="space-y-3">
                {scoreRows.map(({ label, score }) => {
                  const s = score ?? 0;
                  const barColor = s >= 0.75 ? "#16A34A" : s >= 0.5 ? "#D97706" : "#DC2626";
                  return (
                    <div key={label}>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-medium text-[var(--text-secondary)]">{label}</span>
                        <span className={`text-xs font-semibold tabular-nums ${scoreColor(s)}`}>
                          {formatScore(s)}%
                        </span>
                      </div>
                      <div className="score-bar-track">
                        <div
                          className="score-bar-fill"
                          style={{ width: `${s * 100}%`, background: barColor }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action card */}
          <div className="glass-static p-4">
            <p className="section-label mb-3">Your call</p>
            <div className="space-y-1.5">
              {dispositions.map(({ value, label, hint }) => {
                const isActive = reviewDisposition === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => updateDisposition(value)}
                    disabled={Boolean(savingDisposition)}
                    className={`disposition-btn ${isActive ? "disposition-btn-active" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`disposition-label text-sm font-medium ${isActive ? "" : "text-[var(--text-primary)]"}`}>
                        {savingDisposition === value ? "Saving…" : label}
                      </span>
                      {isActive && <Check className="h-3.5 w-3.5 text-[var(--btn-primary-bg)] shrink-0" />}
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">{hint}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Metadata */}
          <div className="glass-static p-4">
            <p className="section-label mb-2.5">Details</p>
            <div className="space-y-2">
              {[
                { k: "Platform",   v: conv.platform },
                { k: "Messages",   v: conv.message_count },
                { k: "Date",       v: new Date(conv.created_at).toLocaleDateString("en-GB") },
                confidenceLevel ? { k: "Confidence", v: confidenceLevel } : null,
                reviewDisposition ? { k: "Disposition", v: reviewDisposition.replaceAll("_", " ") } : null,
              ].filter(Boolean).map((row) => row && (
                <div key={row.k} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-[var(--text-muted)]">{row.k}</span>
                  <span className="text-xs font-medium capitalize text-[var(--text-secondary)]">{String(row.v)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showAdvancedDrawer ? (
        <>
          <button
            type="button"
            aria-label="Close advanced review"
            className="drawer-backdrop"
            onClick={() => setShowAdvancedDrawer(false)}
          />
          <aside className="drawer-panel">
            <div className="drawer-header">
              <div>
                <p className="page-eyebrow">Advanced review</p>
                <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
                  Claims, evidence, overrides, training
                </h2>
              </div>
              <button type="button" onClick={() => setShowAdvancedDrawer(false)} className="glass-button py-1 px-2 text-xs inline-flex items-center gap-1 shrink-0">
                <X className="h-3.5 w-3.5" />
                Close
              </button>
            </div>
            <div className="drawer-body space-y-3">
              {advancedClaimGroups.length > 0 ? (
                <div className="details-panel-content space-y-3">
                  {advancedClaimGroups.map((group) => (
                    <div key={group.title} className="compact-list-item">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{group.title}</p>
                      <div className="mt-2 space-y-2">
                        {group.items.map((claim) => (
                          <div key={`${group.title}-${claim.claim}`} className="border-b border-[var(--divider)] pb-2 last:border-b-0 last:pb-0">
                            <p className="text-sm text-[var(--text-primary)]">{claim.claim}</p>
                            <p className="mt-1 text-xs capitalize text-[var(--text-muted)]">{claim.verdict}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {showKnowledgeAndPromptDetails && qs?.prompt_improvements?.length ? (
                <div className="compact-list-item">
                  <p className="section-label">Prompt guidance</p>
                  <div className="mt-3 space-y-3">
                    {qs.prompt_improvements.slice(0, 3).map((improvement) => (
                      <div key={improvement.issue}>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{improvement.issue}</p>
                        <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{improvement.expected_impact}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {showKnowledgeAndPromptDetails && qs?.knowledge_gaps?.length ? (
                <div className="compact-list-item">
                  <p className="section-label">Knowledge coverage</p>
                  <div className="mt-3 space-y-3">
                    {qs.knowledge_gaps.slice(0, 3).map((gap) => (
                      <div key={gap.topic}>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{gap.topic}</p>
                        <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{gap.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="compact-list-item">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Correct the score</p>
                <div className="mt-3 space-y-3">
                  {showOverrideForm ? (
                    <>
                      <select
                        value={overrideDimension}
                        onChange={(event) => setOverrideDimension(event.target.value)}
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
                        onChange={(event) => setOverrideScore(event.target.value)}
                        className="glass-input w-full px-3 py-2 text-sm"
                        placeholder="Adjusted score %"
                      />
                      <GlassTextarea
                        value={overrideReason}
                        onChange={(event) => setOverrideReason(event.target.value)}
                        className="min-h-[88px]"
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
                    </>
                  ) : (
                    <GlassButton size="sm" className="w-full" onClick={() => setShowOverrideForm(true)}>
                      Add override
                    </GlassButton>
                  )}
                  {overrideState === "saved" ? <p className="text-xs text-score-good">Override saved.</p> : null}
                  {overrideState === "error" ? <p className="text-xs text-score-critical">Failed to save override.</p> : null}
                </div>
              </div>

              <div className="compact-list-item">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Train the scorer</p>
                <div className="mt-3 space-y-3">
                  {showTrainingForm ? (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <GlassSelect
                          label="Example type"
                          value={labelExampleKind}
                          onChange={(event) => setLabelExampleKind(event.target.value as "real" | "synthetic")}
                          options={[
                            { value: "real", label: "Real customer conversation" },
                            { value: "synthetic", label: "Synthetic training example" },
                          ]}
                        />
                        <GlassSelect
                          label="Training scope"
                          value={labelShareScope}
                          onChange={(event) => setLabelShareScope(event.target.value as "workspace_private" | "global_anonymous")}
                          options={[
                            { value: "workspace_private", label: "Private to this workspace" },
                            { value: "global_anonymous", label: "Share anonymized features" },
                          ]}
                        />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {Object.entries(trainingLabels).map(([key, value]) => (
                          <label key={key} className="space-y-1">
                            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">{key}</span>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={value}
                              onChange={(event) =>
                                setTrainingLabels((current) => ({
                                  ...current,
                                  [key]: event.target.value,
                                }))
                              }
                              className="glass-input w-full px-3 py-2 text-sm"
                              placeholder="Optional %"
                            />
                          </label>
                        ))}
                      </div>
                      <GlassButton
                        size="sm"
                        variant="ghost"
                        className="w-full"
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
                        className="min-h-[104px]"
                        placeholder="Why are these labels correct?"
                      />
                      <div className="flex gap-2">
                        <GlassButton size="sm" className="w-full" onClick={submitTrainingLabels} disabled={labelSetState === "saving"}>
                          {labelSetState === "saving" ? "Saving..." : "Save labels"}
                        </GlassButton>
                        <GlassButton size="sm" variant="ghost" className="w-full" onClick={() => setShowTrainingForm(false)}>
                          Cancel
                        </GlassButton>
                      </div>
                    </>
                  ) : (
                    <GlassButton size="sm" className="w-full" onClick={() => setShowTrainingForm(true)}>
                      Save training label
                    </GlassButton>
                  )}
                  {labelSetState === "saved" ? <p className="text-xs text-score-good">Labels saved.</p> : null}
                  {labelSetState === "error" ? <p className="text-xs text-score-critical">Failed to save labels.</p> : null}
                </div>
              </div>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}
