"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bot,
  Headphones,
  Info,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { GlassSelect, GlassTextarea } from "@/components/ui/glass-input";
import { ScoreBadge } from "@/components/ui/score-badge";
import { useToast } from "@/components/ui/toast";
import { formatScore, scoreAccent } from "@/lib/utils";
import type { ClaimAnalysis, Message, QualityScore } from "@/lib/db/types";
import {
  getConversationWorkflow,
  type ReviewDisposition,
} from "@/lib/review-workflow";
import { isGroundingRiskOnlyScore } from "@/lib/scoring/quality-score-status";

interface ConversationDetail {
  id: string;
  customer_identifier?: string;
  platform: string;
  message_count: number;
  was_escalated: boolean;
  created_at: string;
  messages: Message[];
  metadata?: Record<string, unknown> | null;
  quality_score: QualityScore | null;
  score_status?:
    | "pending"
    | "refreshing"
    | "ready"
    | "waiting_for_completion"
    | "waiting_for_quiet_period";
}

type AdvancedTab = "claims" | "evidence" | "override" | "training";

function hasStructuredAnswer(messages: Message[]) {
  return messages.some(
    (message) =>
      message.role === "agent" &&
      (/##|###|\|/.test(message.content) ||
        /priority|next step|what to do next|snapshot|risk|todo|summary|briefing/i.test(message.content))
  );
}

function hasAgentReply(messages: Message[]) {
  return messages.some((message) => message.role === "agent" && message.content.trim().length > 0);
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

function getAssessmentLabel(score?: QualityScore | null, groundingOnly = false) {
  if (!score) return "Scoring";
  if (groundingOnly && (score.overall_score || 0) >= 0.74) return "Strong answer";
  if ((score.overall_score || 0) >= 0.82) return "Healthy";
  if ((score.overall_score || 0) >= 0.65) return "Needs review";
  if ((score.overall_score || 0) >= 0.45) return "Risky";
  return "Broken";
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
  if (groundingOnly) return "Useful answer. Verify specifics before reuse.";
  return score.summary || "No summary available.";
}

function deriveWorked(messages: Message[], score?: QualityScore | null) {
  if (!hasAgentReply(messages)) return "No agent reply";
  if (hasStructuredAnswer(messages)) return "Clear structure";
  if ((score?.resolution_score || 0) >= 0.78) return "Actionable next step";
  if ((score?.tone_score || 0) >= 0.84) return "Trustworthy tone";
  return "Usable answer";
}

function buildCheckItems(score?: QualityScore | null) {
  const claims = (score?.claim_analysis || []).filter((claim) => claim.verdict !== "verified");
  const checks: string[] = [];

  if (claims.some((claim) => claimLooksLikeRecord(claim.claim))) checks.push("Record details");
  if (claims.some((claim) => claimLooksLikeNumber(claim.claim))) checks.push("Metrics");
  if (claims.some((claim) => claimLooksLikeDate(claim.claim))) checks.push("Dates");
  if ((score?.flags || []).some((flag) => /policy|refund|pricing|compliance/i.test(flag))) {
    checks.push("Policy facts");
  }
  if ((score?.resolution_score || 1) < 0.45) checks.push("Resolution");

  return Array.from(new Set(checks)).slice(0, 3);
}

function deriveRiskLine(score?: QualityScore | null, groundingOnly = false) {
  if (!score) return "Scoring";
  if (groundingOnly && (score.overall_score || 0) >= 0.74) return "Moderate if reused";
  if ((score.overall_score || 0) >= 0.82) return "Low reuse risk";
  if ((score.overall_score || 0) >= 0.65) return "Moderate if reused";
  if ((score.overall_score || 0) >= 0.45) return "High confusion risk";
  return "Unsafe to reuse";
}

function buildInsights(score?: QualityScore | null) {
  const claims = (score?.claim_analysis || []).filter((claim) => claim.verdict !== "verified");
  if (claims.length === 0) return [];

  const insights: { title: string; body: string; type: "risk" | "warning" | "info" }[] = [];

  if (claims.some((claim) => claimLooksLikeRecord(claim.claim))) {
    insights.push({
      title: "Check record details",
      body: "Deal fields, contact roles, or internal record details should be checked before reuse.",
      type: "warning",
    });
  }
  if (claims.some((claim) => claimLooksLikeNumber(claim.claim))) {
    insights.push({
      title: "Spot-check metrics",
      body: "Numbers and scores were stated confidently. Verify them before acting.",
      type: "warning",
    });
  }
  if (claims.some((claim) => claimLooksLikeDate(claim.claim))) {
    insights.push({
      title: "Confirm dates",
      body: "Dates, deadlines, and overdue status should be confirmed before planning.",
      type: "info",
    });
  }

  return insights.slice(0, 3);
}

function groupClaimsForAdvancedReview(score?: QualityScore | null) {
  const claims = (score?.claim_analysis || []).filter((claim) => claim.verdict !== "verified");
  const grouped: Array<{ title: string; items: ClaimAnalysis[] }> = [];

  const buckets = [
    { title: "Record details", test: (claim: ClaimAnalysis) => claimLooksLikeRecord(claim.claim) },
    { title: "Metrics", test: (claim: ClaimAnalysis) => claimLooksLikeNumber(claim.claim) },
    { title: "Dates", test: (claim: ClaimAnalysis) => claimLooksLikeDate(claim.claim) },
  ];

  const remaining = [...claims];
  for (const bucket of buckets) {
    const items = remaining.filter(bucket.test);
    if (items.length > 0) {
      grouped.push({ title: bucket.title, items: items.slice(0, 5) });
      for (const item of items) {
        const index = remaining.indexOf(item);
        if (index >= 0) remaining.splice(index, 1);
      }
    }
  }

  if (remaining.length > 0) {
    grouped.push({ title: "Other", items: remaining.slice(0, 5) });
  }

  return grouped;
}

function derivePrimaryAction(
  messages: Message[],
  score?: QualityScore | null,
  groundingOnly = false,
  checks: string[] = []
) {
  if (!score) return "Wait for scoring to finish.";
  if (!hasAgentReply(messages)) return "Review manually.";
  if (checks.includes("Record details")) return "Check record details before reuse.";
  if (checks.includes("Metrics")) return "Verify metrics before sharing.";
  if (checks.includes("Dates")) return "Confirm dates before acting.";
  if ((score.prompt_improvements || []).length > 0) return "Apply the first prompt fix.";
  if ((score.overall_score || 0) >= 0.82 && !groundingOnly) return "Mark safe and move on.";
  return groundingOnly ? "Verify specifics before reuse." : "Review before reuse.";
}

function getDispositionLabel(disposition: ReviewDisposition) {
  switch (disposition) {
    case "safe":
      return "Safe";
    case "watch":
      return "Watch";
    case "action_needed":
      return "Action";
    case "escalate_issue":
      return "Escalate";
    case "ignore":
      return "Ignore";
  }
}

function isLongMessage(content: string) {
  return content.length > 520 || content.split("\n").length > 10;
}

export default function ConversationDetailPage() {
  const params = useParams();
  const { success, error } = useToast();
  const [conv, setConv] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [serverError, setServerError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [showAdvancedDrawer, setShowAdvancedDrawer] = useState(false);
  const [advancedTab, setAdvancedTab] = useState<AdvancedTab>("claims");
  const [nextConversationId, setNextConversationId] = useState<string | null>(null);
  const [expandedMessages, setExpandedMessages] = useState<Record<string, boolean>>({});
  const [selectedDisposition, setSelectedDisposition] = useState<ReviewDisposition | null>(null);
  const [savingDisposition, setSavingDisposition] = useState<ReviewDisposition | null>(null);

  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [overrideDimension, setOverrideDimension] = useState("overall");
  const [overrideScore, setOverrideScore] = useState("50");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideState, setOverrideState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const [showTrainingForm, setShowTrainingForm] = useState(false);
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

    setNotFound(false);
    setServerError(false);

    const loadConversation = async (isInitialLoad = false) => {
      try {
        const response = await fetch(`/api/conversations/${params.id}`, { cache: "no-store" });
        if (response.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }
        if (!response.ok) {
          if (!cancelled) setServerError(true);
          return;
        }
        const data = (await response.json()) as ConversationDetail;
        if (cancelled) return;
        setConv(data);
        const workflow = getConversationWorkflow(data.metadata || null);
        setSelectedDisposition(workflow?.disposition || null);

        if (data.score_status === "pending" || data.score_status === "refreshing") {
          pollTimer = setTimeout(() => {
            void loadConversation(false);
          }, 2500);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setServerError(true);
      } finally {
        if (!cancelled && isInitialLoad) setLoading(false);
      }
    };

    void loadConversation(true);
    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [params.id, retryCount]);

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
        }
      } catch (err) {
        console.error(err);
      }
    }
    void loadNextConversation();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  async function applyDisposition(disposition: ReviewDisposition) {
    if (!conv) return;
    const previous = selectedDisposition;
    setSelectedDisposition(disposition);
    setSavingDisposition(disposition);

    try {
      const response = await fetch(`/api/conversations/${conv.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disposition,
          queue_state:
            disposition === "safe"
              ? "safe"
              : disposition === "escalate_issue"
                ? "escalated"
                : disposition === "action_needed"
                  ? "needs_review"
                  : "reviewed",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update disposition");
      }

      success(`Marked ${getDispositionLabel(disposition).toLowerCase()}`);
    } catch (err) {
      console.error(err);
      setSelectedDisposition(previous);
      error("Could not update review state");
    } finally {
      setSavingDisposition(null);
    }
  }

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

  if (loading) {
    return (
      <div className="pb-8">
        <Link
          href="/conversations"
          className="mb-5 inline-flex items-center gap-1.5 text-sm text-[#787774] hover:text-[#37352F]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Review queue
        </Link>
        <div className="rounded-[6px] border border-[#E9E9E7] bg-white p-10 text-center" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <p className="text-sm text-[#ACABA8]">Loading…</p>
        </div>
      </div>
    );
  }

  if (serverError) {
    return (
      <div className="pb-8">
        <Link
          href="/conversations"
          className="mb-5 inline-flex items-center gap-1.5 text-sm text-[#787774] hover:text-[#37352F]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Review queue
        </Link>
        <div className="rounded-[6px] border border-[#E9E9E7] bg-white p-10 text-center" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <p className="text-sm font-medium text-[#787774]">Could not load this conversation</p>
          <p className="mt-1 text-xs text-[#ACABA8]">There was a problem fetching the data. Try again.</p>
          <button
            type="button"
            className="glass-button mt-4 text-sm"
            onClick={() => { setLoading(true); setRetryCount((n) => n + 1); }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (notFound || !conv) {
    return (
      <div className="pb-8">
        <Link
          href="/conversations"
          className="mb-5 inline-flex items-center gap-1.5 text-sm text-[#787774] hover:text-[#37352F]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Review queue
        </Link>
        <div className="rounded-[6px] border border-[#E9E9E7] bg-white p-10 text-center" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <p className="text-sm text-[#ACABA8]">Conversation not found.</p>
        </div>
      </div>
    );
  }

  const qs = conv.quality_score;
  const groundingOnly = isGroundingRiskOnlyScore(qs);
  const confidenceLevel = qs?.confidence_level ?? qs?.structural_metrics?.confidence_level;
  const evidenceLabel = getEvidenceLabel(qs, groundingOnly);
  const assessmentLabel = getAssessmentLabel(qs, groundingOnly);
  const displaySummary = getDisplaySummary(qs, groundingOnly);
  const checkItems = buildCheckItems(qs);
  const riskLine = deriveRiskLine(qs, groundingOnly);
  const workedLine = deriveWorked(conv.messages, qs);
  const primaryAction = derivePrimaryAction(conv.messages, qs, groundingOnly, checkItems);
  const insights = buildInsights(qs);
  const advancedClaimGroups = groupClaimsForAdvancedReview(qs);
  const showKnowledgeAndPromptDetails = !groundingOnly;

  const scoreRows = qs
    ? [
        { label: "Overall", score: qs.overall_score },
        { label: "Accuracy", score: qs.accuracy_score },
        { label: "Hallucination", score: qs.hallucination_score },
        { label: "Resolution", score: qs.resolution_score },
        { label: "Tone", score: qs.tone_score },
        { label: "Sentiment", score: qs.sentiment_score },
      ]
    : [];

  const msgConfig = {
    customer: {
      icon: User,
      label: "Customer",
      bubbleClass: "bg-[#F7F7F5] border border-[#E9E9E7] text-[#37352F] rounded-[6px]",
      align: "start" as const,
      avatarBg: "bg-[#F7F7F5] border-[#E9E9E7]",
    },
    agent: {
      icon: Bot,
      label: "AI agent",
      bubbleClass: "bg-[rgba(35,131,226,0.06)] border border-[rgba(35,131,226,0.12)] text-[#37352F] rounded-[6px]",
      align: "end" as const,
      avatarBg: "bg-[rgba(35,131,226,0.06)] border-[rgba(35,131,226,0.12)]",
    },
    human_agent: {
      icon: Headphones,
      label: "Human agent",
      bubbleClass: "bg-[rgba(15,123,61,0.06)] border border-[rgba(15,123,61,0.12)] text-[#37352F] rounded-[6px]",
      align: "end" as const,
      avatarBg: "bg-[rgba(15,123,61,0.06)] border-[rgba(15,123,61,0.12)]",
    },
    tool: {
      icon: Sparkles,
      label: "Tool call",
      bubbleClass: "bg-[#F7F7F5] border border-[#E9E9E7] text-[#787774] italic rounded-[6px]",
      align: "center" as const,
      avatarBg: "bg-[#F7F7F5] border-[#E9E9E7]",
    },
    system: {
      icon: Sparkles,
      label: "System",
      bubbleClass: "bg-[#F7F7F5] border border-[#E9E9E7] text-[#787774] italic rounded-[6px]",
      align: "center" as const,
      avatarBg: "bg-[#F7F7F5] border-[#E9E9E7]",
    },
  } as const;

  return (
    <div className="space-y-6 pb-8 bg-white">
      {/* Top navigation bar */}
      <div className="review-topline">
        <Link
          href="/conversations"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#787774] hover:text-[#37352F]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Review queue
        </Link>
        <div className="review-action-strip">
          {nextConversationId && (
            <Link
              href={`/conversations/${nextConversationId}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#2383E2] hover:text-[#1a6fc4]"
            >
              Open next
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
          <button
            type="button"
            className="glass-button text-sm"
            onClick={() => setShowAdvancedDrawer(true)}
          >
            Advanced
          </button>
        </div>
      </div>

      {/* Assessment hero */}
      <section className="assessment-hero">
        {/* Main assessment card */}
        <div className="rounded-[6px] border border-[#E9E9E7] bg-white p-6 sm:p-7" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          {/* Token row */}
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-[4px] border border-[#E9E9E7] bg-[#F7F7F5] px-2 py-0.5 text-[11px] font-medium capitalize text-[#787774]">
              {conv.platform}
            </span>
            <span className="inline-flex items-center rounded-[4px] border border-[#E9E9E7] bg-[#F7F7F5] px-2 py-0.5 text-[11px] font-medium text-[#787774]">
              {new Date(conv.created_at).toLocaleDateString("en-GB")}
            </span>
            <span className="inline-flex items-center rounded-[4px] border border-[#E9E9E7] bg-[#F7F7F5] px-2 py-0.5 text-[11px] font-medium text-[#787774]">
              {conv.message_count} messages
            </span>
            {evidenceLabel ? (
              <span className="inline-flex items-center rounded-[4px] border border-[#E9E9E7] bg-[#F7F7F5] px-2 py-0.5 text-[11px] font-medium text-[#787774]">
                {evidenceLabel}
              </span>
            ) : null}
            {conv.was_escalated ? (
              <span className="inline-flex items-center rounded-[4px] border border-[rgba(196,52,44,0.2)] bg-[rgba(196,52,44,0.08)] px-2 py-0.5 text-[11px] font-medium text-[#C4342C]">
                Escalated
              </span>
            ) : null}
          </div>

          <div className="mt-5 flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-2xl">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#ACABA8]">Assessment</p>
              <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.05em] text-[#37352F] sm:text-[2.4rem]">
                {conv.customer_identifier || "Unknown customer"}
              </h1>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {qs ? (
                  <ScoreBadge score={qs.overall_score} size="lg" />
                ) : (
                  <span className="inline-flex items-center rounded-[4px] border border-[#E9E9E7] bg-[#F7F7F5] px-2 py-0.5 text-[11px] font-medium text-[#787774]">
                    Scoring
                  </span>
                )}
                <span
                  className={`inline-flex items-center rounded-[4px] border px-2 py-0.5 text-[11px] font-medium ${
                    assessmentLabel === "Healthy" || assessmentLabel === "Strong answer"
                      ? "border-[rgba(15,123,61,0.2)] bg-[rgba(15,123,61,0.08)] text-[#0F7B3D]"
                      : assessmentLabel === "Needs review" || assessmentLabel === "Risky"
                        ? "border-[rgba(196,122,0,0.2)] bg-[rgba(196,122,0,0.08)] text-[#C47A00]"
                        : assessmentLabel === "Broken"
                          ? "border-[rgba(196,52,44,0.2)] bg-[rgba(196,52,44,0.08)] text-[#C4342C]"
                          : "border-[#E9E9E7] bg-[#F7F7F5] text-[#787774]"
                  }`}
                >
                  {assessmentLabel}
                </span>
                {confidenceLevel ? (
                  <span className="inline-flex items-center rounded-[4px] border border-[#E9E9E7] bg-[#F7F7F5] px-2 py-0.5 text-[11px] font-medium capitalize text-[#787774]">
                    {confidenceLevel} confidence
                  </span>
                ) : null}
              </div>
              <p className="mt-5 text-xl leading-8 tracking-[-0.02em] text-[#37352F]">
                {displaySummary}
              </p>
              <p className="mt-3 text-base font-medium text-[#787774]">
                {primaryAction}
              </p>
            </div>

            {/* Disposition card */}
            <div className="rounded-[6px] border border-[#E9E9E7] bg-[#F7F7F5] p-5 sm:min-w-[260px]" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#ACABA8]">Disposition</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {(["safe", "watch", "action_needed", "escalate_issue"] as ReviewDisposition[]).map((disposition) => (
                  <button
                    key={disposition}
                    type="button"
                    onClick={() => applyDisposition(disposition)}
                    disabled={Boolean(savingDisposition)}
                    className={`disposition-btn ${selectedDisposition === disposition ? "disposition-btn-active" : ""}`}
                  >
                    <span className="text-sm font-semibold text-[#37352F]">{getDispositionLabel(disposition)}</span>
                  </button>
                ))}
              </div>
              {selectedDisposition ? (
                <p className="mt-4 text-xs text-[#787774]">
                  Saved as {getDispositionLabel(selectedDisposition).toLowerCase()}.
                </p>
              ) : (
                <p className="mt-4 text-xs text-[#787774]">
                  Mark the review outcome once you&apos;ve checked it.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Why this matters card */}
        <div className="rounded-[6px] border border-[#E9E9E7] bg-white p-6" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#ACABA8]">Why this matters</p>
          <div className="mt-4 assessment-strip">
            <div className="assessment-strip-item">
              <span className="value-key">Worked</span>
              <p className="value-text text-[#37352F]">{workedLine}</p>
            </div>
            <div className="assessment-strip-item">
              <span className="value-key">Check</span>
              <div className="flex flex-wrap gap-1.5">
                {checkItems.length > 0 ? (
                  checkItems.map((item) => (
                    <span key={item} className="inline-flex items-center rounded-[4px] border border-[#E9E9E7] bg-[#F7F7F5] px-2 py-0.5 text-[11px] font-medium text-[#787774]">
                      {item}
                    </span>
                  ))
                ) : (
                  <span className="value-text text-[#787774]">No major checks</span>
                )}
              </div>
            </div>
            <div className="assessment-strip-item">
              <span className="value-key">Risk</span>
              <p className="value-text text-[#37352F]">{riskLine}</p>
            </div>
          </div>

          {insights.length > 0 && (
            <div className="mt-5 border-t border-[#E9E9E7] pt-5">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#ACABA8] mb-3">Assessment notes</p>
              <div className="space-y-3">
                {insights.slice(0, 2).map((insight) => (
                  <div
                    key={insight.title}
                    className="flex items-start gap-3 rounded-[6px] border border-[#E9E9E7] bg-[#F7F7F5] p-3"
                  >
                    {insight.type === "risk" ? (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#C4342C]" />
                    ) : insight.type === "warning" ? (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#C47A00]" />
                    ) : (
                      <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#ACABA8]" />
                    )}
                    <div>
                      <p className="text-sm font-semibold text-[#37352F]">{insight.title}</p>
                      <p className="mt-1 text-sm leading-6 text-[#787774]">{insight.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Transcript + sidebar */}
      <section className="transcript-shell">
        <div className="rounded-[6px] border border-[#E9E9E7] bg-white overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div className="flex items-center justify-between gap-3 border-b border-[#E9E9E7] px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-[#37352F]">Transcript</p>
              <p className="text-xs text-[#ACABA8]">{conv.messages.length} messages</p>
            </div>
            {evidenceLabel ? (
              <span className="inline-flex items-center rounded-[4px] border border-[#E9E9E7] bg-[#F7F7F5] px-2 py-0.5 text-[11px] font-medium text-[#787774]">
                {evidenceLabel}
              </span>
            ) : null}
          </div>

          {conv.messages.length === 0 ? (
            <p className="p-5 text-sm text-[#ACABA8]">No messages recorded.</p>
          ) : (
            <div className="space-y-4 p-5 sm:p-6">
              {conv.messages.map((message, index) => {
                const cfg = msgConfig[message.role as keyof typeof msgConfig] || msgConfig.system;
                const Icon = cfg.icon;
                const expanded = expandedMessages[message.id] || false;
                const collapsible = message.role === "agent" && isLongMessage(message.content);
                const preview = collapsible && !expanded ? `${message.content.slice(0, 560).trimEnd()}…` : message.content;
                const isRight = cfg.align === "end";
                const isCenter = cfg.align === "center";
                const timestamp = message.timestamp
                  ? new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  : null;

                return (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${isRight ? "flex-row-reverse" : isCenter ? "justify-center" : ""} animate-fade-in`}
                    style={{ animationDelay: `${index * 28}ms` }}
                  >
                    {!isCenter && (
                      <div className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${cfg.avatarBg}`}>
                        <Icon className="h-4 w-4 text-[#787774]" />
                      </div>
                    )}

                    <div className={`max-w-[640px] ${isCenter ? "w-full" : ""}`}>
                      <div className={`px-4 py-3.5 text-sm ${cfg.bubbleClass}`}>
                        <p className={`whitespace-pre-wrap leading-7 ${isRight ? "text-right" : ""}`}>
                          {preview}
                        </p>
                        {collapsible && (
                          <button
                            type="button"
                            onClick={() => setExpandedMessages((current) => ({ ...current, [message.id]: !expanded }))}
                            className="mt-3 text-xs font-semibold text-[#2383E2] hover:text-[#1a6fc4]"
                          >
                            {expanded ? "Show less" : "Show full response"}
                          </button>
                        )}
                      </div>
                      <div className={`mt-1 flex items-center gap-2 ${isRight ? "justify-end" : ""}`}>
                        <span className="text-[11px] font-medium text-[#ACABA8]">{cfg.label}</span>
                        {timestamp ? <span className="text-[11px] text-[#ACABA8]">{timestamp}</span> : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Scores card */}
          <div className="rounded-[6px] border border-[#E9E9E7] bg-white p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#ACABA8]">Scores</p>
                <p className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[#37352F]">Breakdown</p>
              </div>
              {qs ? <ScoreBadge score={qs.overall_score} size="sm" /> : null}
            </div>

            {!qs ? (
              <p className="mt-4 text-sm text-[#787774]">
                {conv.score_status === "waiting_for_completion"
                  ? "Waiting for the conversation to finish."
                  : conv.score_status === "refreshing"
                    ? "Refreshing score…"
                    : "Scoring in progress…"}
              </p>
            ) : (
              <div className="mt-4 score-strip">
                {scoreRows.map(({ label, score }) => {
                  const safeScore = score ?? 0;
                  return (
                    <div key={label} className="score-strip-row">
                      <div>
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-xs font-medium text-[#787774]">{label}</span>
                          <span className="text-xs font-semibold font-mono tabular-nums" style={{ color: scoreAccent(safeScore) }}>
                            {formatScore(safeScore)}%
                          </span>
                        </div>
                        <div className="score-strip-bar">
                          <div
                            className="score-strip-fill"
                            style={{ width: `${safeScore * 100}%`, background: scoreAccent(safeScore) }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Best next move card */}
          <div className="rounded-[6px] border border-[#E9E9E7] bg-white p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#ACABA8]">Best next move</p>
            <div className="action-card mt-4">
              <p className="text-sm font-semibold text-[#37352F]">{primaryAction}</p>
              {showKnowledgeAndPromptDetails && qs?.prompt_improvements?.[0]?.expected_impact ? (
                <p className="mt-2 text-sm leading-6 text-[#787774]">
                  {qs.prompt_improvements[0].expected_impact}
                </p>
              ) : (
                <p className="mt-2 text-sm leading-6 text-[#787774]">
                  Use the transcript below to spot-check the claims that matter.
                </p>
              )}
            </div>
          </div>

          {/* Details card */}
          <div className="rounded-[6px] border border-[#E9E9E7] bg-white p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#ACABA8]">Details</p>
            <div className="mt-4 info-grid">
              {[
                { label: "Platform", value: conv.platform },
                { label: "Messages", value: String(conv.message_count) },
                { label: "Date", value: new Date(conv.created_at).toLocaleDateString("en-GB") },
                confidenceLevel ? { label: "Confidence", value: confidenceLevel } : null,
              ]
                .filter(Boolean)
                .map((row) => row && (
                  <div key={row.label} className="info-row">
                    <span className="text-xs text-[#ACABA8]">{row.label}</span>
                    <span className="text-xs font-medium capitalize text-[#787774]">{row.value}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </section>

      {/* Advanced drawer */}
      {showAdvancedDrawer ? (
        <>
          <button
            type="button"
            aria-label="Close advanced review"
            className="drawer-backdrop"
            onClick={() => setShowAdvancedDrawer(false)}
          />
          <aside className="drawer-panel bg-white border-l border-[#E9E9E7]">
            <div className="drawer-header border-b border-[#E9E9E7]">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#ACABA8]">Advanced review</p>
                <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[#37352F]">
                  Claims, evidence and calibration
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowAdvancedDrawer(false)}
                className="glass-button py-1 px-2 text-xs inline-flex items-center gap-1 shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="drawer-body">
              {/* Tab buttons */}
              <div className="mb-5 flex flex-wrap gap-2">
                {([
                  ["claims", "Claims"],
                  ["evidence", "Evidence"],
                  ["override", "Override"],
                  ["training", "Training"],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setAdvancedTab(key)}
                    className={`rounded-[6px] border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                      advancedTab === key
                        ? "bg-white border-[#E9E9E7] text-[#37352F]"
                        : "bg-transparent border-transparent text-[#787774] hover:text-[#37352F] hover:border-[#E9E9E7]"
                    }`}
                    style={advancedTab === key ? { boxShadow: "0 1px 3px rgba(0,0,0,0.04)" } : undefined}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {advancedTab === "claims" && (
                <div className="space-y-4">
                  {advancedClaimGroups.length > 0 ? (
                    advancedClaimGroups.map((group) => (
                      <div key={group.title} className="rounded-[6px] border border-[#E9E9E7] bg-[#F7F7F5] p-4">
                        <p className="text-sm font-semibold text-[#37352F]">{group.title}</p>
                        <div className="mt-3 space-y-3">
                          {group.items.map((claim) => (
                            <div
                              key={`${group.title}-${claim.claim}`}
                              className="rounded-[6px] border border-[#E9E9E7] bg-white p-3"
                              style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
                            >
                              <p className="text-sm text-[#37352F]">{claim.claim}</p>
                              <p className="mt-1 text-xs capitalize text-[#ACABA8]">{claim.verdict}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[#ACABA8]">No claim checks for this conversation.</p>
                  )}
                </div>
              )}

              {advancedTab === "evidence" && (
                <div className="space-y-4">
                  {insights.length > 0 ? (
                    <div className="rounded-[6px] border border-[#E9E9E7] bg-[#F7F7F5] p-4">
                      <p className="text-sm font-semibold text-[#37352F]">Evidence notes</p>
                      <div className="mt-3 space-y-3">
                        {insights.map((insight) => (
                          <div
                            key={insight.title}
                            className="rounded-[6px] border border-[#E9E9E7] bg-white p-3"
                            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
                          >
                            <p className="text-sm font-semibold text-[#37352F]">{insight.title}</p>
                            <p className="mt-1 text-sm leading-6 text-[#787774]">{insight.body}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {showKnowledgeAndPromptDetails && qs?.prompt_improvements?.length ? (
                    <div className="rounded-[6px] border border-[#E9E9E7] bg-[#F7F7F5] p-4">
                      <p className="text-sm font-semibold text-[#37352F]">Prompt fixes</p>
                      <div className="mt-3 space-y-3">
                        {qs.prompt_improvements.slice(0, 3).map((improvement) => (
                          <div
                            key={improvement.issue}
                            className="rounded-[6px] border border-[#E9E9E7] bg-white p-3"
                            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
                          >
                            <p className="text-sm font-semibold text-[#37352F]">{improvement.issue}</p>
                            <p className="mt-1 text-sm leading-6 text-[#787774]">{improvement.expected_impact}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {showKnowledgeAndPromptDetails && qs?.knowledge_gaps?.length ? (
                    <div className="rounded-[6px] border border-[#E9E9E7] bg-[#F7F7F5] p-4">
                      <p className="text-sm font-semibold text-[#37352F]">Knowledge gaps</p>
                      <div className="mt-3 space-y-3">
                        {qs.knowledge_gaps.slice(0, 3).map((gap) => (
                          <div
                            key={gap.topic}
                            className="rounded-[6px] border border-[#E9E9E7] bg-white p-3"
                            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
                          >
                            <p className="text-sm font-semibold text-[#37352F]">{gap.topic}</p>
                            <p className="mt-1 text-sm leading-6 text-[#787774]">{gap.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {!insights.length && !(qs?.prompt_improvements?.length || qs?.knowledge_gaps?.length) ? (
                    <p className="text-sm text-[#ACABA8]">No extra evidence notes for this conversation.</p>
                  ) : null}
                </div>
              )}

              {advancedTab === "override" && (
                <div>
                  <p className="text-sm font-semibold text-[#37352F]">Correct the score</p>
                  {showOverrideForm ? (
                    <div className="mt-4 space-y-3">
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
                        placeholder="Score %"
                      />
                      <GlassTextarea
                        value={overrideReason}
                        onChange={(event) => setOverrideReason(event.target.value)}
                        className="min-h-[84px]"
                        placeholder="Why is the current score wrong?"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="glass-button glass-button-primary w-full text-sm"
                          onClick={submitOverride}
                          disabled={overrideState === "saving"}
                        >
                          {overrideState === "saving" ? "Saving…" : "Save override"}
                        </button>
                        <button
                          type="button"
                          className="glass-button w-full text-sm"
                          onClick={() => setShowOverrideForm(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4">
                      <button
                        type="button"
                        className="glass-button text-sm"
                        onClick={() => setShowOverrideForm(true)}
                      >
                        Add override
                      </button>
                    </div>
                  )}
                  {overrideState === "saved" ? (
                    <p className="mt-3 text-xs text-[#0F7B3D]">Override saved.</p>
                  ) : null}
                  {overrideState === "error" ? (
                    <p className="mt-3 text-xs text-[#C4342C]">Failed to save.</p>
                  ) : null}
                </div>
              )}

              {advancedTab === "training" && (
                <div>
                  <p className="text-sm font-semibold text-[#37352F]">Train the scorer</p>
                  {showTrainingForm ? (
                    <div className="mt-4 space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <GlassSelect
                          label="Example type"
                          value={labelExampleKind}
                          onChange={(event) => setLabelExampleKind(event.target.value as "real" | "synthetic")}
                          options={[
                            { value: "real", label: "Real conversation" },
                            { value: "synthetic", label: "Synthetic example" },
                          ]}
                        />
                        <GlassSelect
                          label="Scope"
                          value={labelShareScope}
                          onChange={(event) =>
                            setLabelShareScope(event.target.value as "workspace_private" | "global_anonymous")
                          }
                          options={[
                            { value: "workspace_private", label: "Private" },
                            { value: "global_anonymous", label: "Shared anonymous" },
                          ]}
                        />
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        {Object.entries(trainingLabels).map(([key, value]) => (
                          <label key={key} className="space-y-1">
                            <span className="text-[11px] font-semibold capitalize text-[#787774]">{key}</span>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={value}
                              onChange={(event) => setTrainingLabels((current) => ({ ...current, [key]: event.target.value }))}
                              className="glass-input w-full px-3 py-2 text-sm"
                              placeholder="%"
                            />
                          </label>
                        ))}
                      </div>

                      <button
                        type="button"
                        className="glass-button w-full text-sm"
                        onClick={() =>
                          setTrainingLabels({
                            overall: qs ? String(Math.round(qs.overall_score * 100)) : "",
                            accuracy: qs?.accuracy_score !== undefined ? String(Math.round(qs.accuracy_score * 100)) : "",
                            hallucination:
                              qs?.hallucination_score !== undefined ? String(Math.round(qs.hallucination_score * 100)) : "",
                            resolution: qs?.resolution_score !== undefined ? String(Math.round(qs.resolution_score * 100)) : "",
                            escalation: qs?.escalation_score !== undefined ? String(Math.round(qs.escalation_score * 100)) : "",
                            tone: qs?.tone_score !== undefined ? String(Math.round(qs.tone_score * 100)) : "",
                            sentiment: qs?.sentiment_score !== undefined ? String(Math.round(qs.sentiment_score * 100)) : "",
                          })
                        }
                      >
                        Start from current scores
                      </button>

                      <GlassTextarea
                        value={labelNotes}
                        onChange={(event) => setLabelNotes(event.target.value)}
                        className="min-h-[84px]"
                        placeholder="Why are these labels correct?"
                      />

                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="glass-button glass-button-primary w-full text-sm"
                          onClick={submitTrainingLabels}
                          disabled={labelSetState === "saving"}
                        >
                          {labelSetState === "saving" ? "Saving…" : "Save labels"}
                        </button>
                        <button
                          type="button"
                          className="glass-button w-full text-sm"
                          onClick={() => setShowTrainingForm(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4">
                      <button
                        type="button"
                        className="glass-button text-sm"
                        onClick={() => setShowTrainingForm(true)}
                      >
                        Save training label
                      </button>
                    </div>
                  )}
                  {labelSetState === "saved" ? (
                    <p className="mt-3 text-xs text-[#0F7B3D]">Labels saved.</p>
                  ) : null}
                  {labelSetState === "error" ? (
                    <p className="mt-3 text-xs text-[#C4342C]">Failed to save.</p>
                  ) : null}
                </div>
              )}
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}
