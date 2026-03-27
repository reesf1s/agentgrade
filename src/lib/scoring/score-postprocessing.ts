import type { Message } from "@/lib/db/types";
import type { ScoringInput, ScoringResult } from "./claude-scorer";

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function severityPenalty(severity?: string): number {
  switch (severity) {
    case "critical":
      return 0.22;
    case "high":
      return 0.14;
    case "medium":
      return 0.08;
    default:
      return 0.04;
  }
}

function hasHumanAgent(messages: Message[]): boolean {
  return messages.some((message) => message.role === "human_agent");
}

function hasCustomerDissatisfaction(messages: Message[]): boolean {
  return messages.some(
    (message) =>
      message.role === "customer" &&
      /(still not working|this doesn't help|that didn't help|that's wrong|this is wrong|not helpful|frustrated|angry|useless|human|manager|supervisor)/i.test(
        message.content
      )
  );
}

function hasToolingOrAccessLimitation(messages: Message[]): boolean {
  return messages.some(
    (message) =>
      message.role === "agent" &&
      /(i can't|i cannot|i do not|i don't|unable to|can't access|cannot access|don't have access|cannot verify|can't verify|can't check|cannot check|can't reset|cannot reset|can't update|cannot update|need a human|need to escalate|someone on our team)/i.test(
        message.content
      )
  );
}

function endsWithUnresolvedCustomerIntent(messages: Message[]): boolean {
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== "customer") {
    return false;
  }

  return /(still|again|not working|doesn't work|didn't work|that's wrong|this is wrong|how do i actually|what should i do|can you fix|can someone|human|manager|\?)/i.test(
    lastMessage.content
  );
}

function pushUniqueFlag(flags: string[], flag: string) {
  if (!flags.includes(flag)) {
    flags.push(flag);
  }
}

function deriveConfidenceLevel(
  input: ScoringInput,
  result: ScoringResult
): { level: "high" | "medium" | "low"; reasons: string[] } {
  const reasons: string[] = [];
  let penalty = 0;

  if (!input.knowledgeBaseContext?.length) {
    penalty += 1;
    reasons.push("No workspace knowledge base evidence was available for grounding.");
  }

  const claims = result.claim_analysis || [];
  const fabricatedClaims = claims.filter((claim) => claim.verdict === "fabricated");
  const contradictedClaims = claims.filter((claim) => claim.verdict === "contradicted");
  const unverifiableClaims = claims.filter((claim) => claim.verdict === "unverifiable");
  const verifiedClaims = claims.filter((claim) => claim.verdict === "verified");

  if (fabricatedClaims.length > 0 || contradictedClaims.length > 0) {
    penalty += 2;
    reasons.push("The conversation contains contradicted or fabricated claims.");
  } else if (unverifiableClaims.length >= 2) {
    penalty += 1;
    reasons.push("Several important claims could not be verified confidently.");
  }

  if (claims.length > 0 && verifiedClaims.length === 0) {
    penalty += 1;
    reasons.push("No extracted claims were positively verified.");
  }

  if (input.messages.length < 3) {
    penalty += 1;
    reasons.push("The transcript is very short, which reduces scoring certainty.");
  }

  if (result.flags.includes("scoring_error")) {
    penalty += 3;
    reasons.push("Automated scoring had to fall back to a degraded path.");
  }

  if (result.flags.includes("limited_grounding_context")) {
    penalty += 1;
    reasons.push("Grounding context was limited for factual verification.");
  }

  if (penalty >= 4) {
    return { level: "low", reasons };
  }

  if (penalty >= 2) {
    return { level: "medium", reasons };
  }

  if (reasons.length === 0) {
    reasons.push("The evaluation had transcript evidence and no major verification uncertainty signals.");
  }

  return { level: "high", reasons };
}

export function applyScoringGuardrails(
  input: ScoringInput,
  result: ScoringResult
): ScoringResult {
  const adjusted = {
    ...result,
    flags: [...result.flags],
  };

  const contradictedClaims = adjusted.claim_analysis.filter(
    (claim) => claim.verdict === "contradicted"
  );
  const fabricatedClaims = adjusted.claim_analysis.filter(
    (claim) => claim.verdict === "fabricated"
  );
  const unverifiableClaims = adjusted.claim_analysis.filter(
    (claim) => claim.verdict === "unverifiable"
  );

  const factualPenalty =
    contradictedClaims.reduce((sum, claim) => sum + severityPenalty(claim.severity), 0) +
    fabricatedClaims.reduce((sum, claim) => sum + severityPenalty(claim.severity) * 1.2, 0);

  if (factualPenalty > 0) {
    adjusted.accuracy_score = clamp(adjusted.accuracy_score - factualPenalty);
    adjusted.hallucination_score = clamp(adjusted.hallucination_score - factualPenalty);

    if (fabricatedClaims.length > 0) {
      pushUniqueFlag(adjusted.flags, "fabricated_claims_detected");
    }
    if (contradictedClaims.length > 0) {
      pushUniqueFlag(adjusted.flags, "contradicted_claims_detected");
    }
  }

  if (!input.knowledgeBaseContext?.length && unverifiableClaims.length >= 3) {
    adjusted.accuracy_score = Math.min(adjusted.accuracy_score, 0.72);
    pushUniqueFlag(adjusted.flags, "limited_grounding_context");
  }

  if (input.structuralMetrics.escalation_turn !== undefined && !hasHumanAgent(input.messages)) {
    adjusted.escalation_score = Math.min(adjusted.escalation_score, 0.3);
    adjusted.resolution_score = Math.min(adjusted.resolution_score, 0.45);
    pushUniqueFlag(adjusted.flags, "missed_human_handoff");
  }

  if (input.structuralMetrics.repetition_count >= 2) {
    adjusted.tone_score = clamp(adjusted.tone_score - 0.08);
    adjusted.resolution_score = clamp(adjusted.resolution_score - 0.05);
    pushUniqueFlag(adjusted.flags, "repetitive_agent_behavior");
  }

  if (hasCustomerDissatisfaction(input.messages)) {
    adjusted.sentiment_score = Math.min(adjusted.sentiment_score, 0.45);
    pushUniqueFlag(adjusted.flags, "customer_left_dissatisfied");
  }

  if (hasToolingOrAccessLimitation(input.messages)) {
    adjusted.resolution_score = Math.min(adjusted.resolution_score, 0.58);
    pushUniqueFlag(adjusted.flags, "missing_tool_or_system_access");
  }

  if (endsWithUnresolvedCustomerIntent(input.messages)) {
    adjusted.resolution_score = Math.min(adjusted.resolution_score, 0.4);
    adjusted.sentiment_score = Math.min(adjusted.sentiment_score, 0.4);
    pushUniqueFlag(adjusted.flags, "user_intent_left_unresolved");
  }

  adjusted.overall_score = clamp(
    adjusted.accuracy_score * 0.2 +
      adjusted.hallucination_score * 0.25 +
      adjusted.resolution_score * 0.25 +
      adjusted.tone_score * 0.15 +
      adjusted.sentiment_score * 0.1 +
      adjusted.edge_case_score * 0.03 +
      adjusted.escalation_score * 0.02
  );

  const confidence = deriveConfidenceLevel(input, adjusted);
  adjusted.confidence_level = confidence.level;
  adjusted.summary =
    adjusted.summary ||
    `Confidence: ${confidence.level}. ${confidence.reasons[0] ?? "Evaluation complete."}`;

  return adjusted;
}
