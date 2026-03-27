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

function pushUniqueFlag(flags: string[], flag: string) {
  if (!flags.includes(flag)) {
    flags.push(flag);
  }
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

  adjusted.overall_score = clamp(
    adjusted.accuracy_score * 0.2 +
      adjusted.hallucination_score * 0.25 +
      adjusted.resolution_score * 0.25 +
      adjusted.tone_score * 0.15 +
      adjusted.sentiment_score * 0.1 +
      adjusted.edge_case_score * 0.03 +
      adjusted.escalation_score * 0.02
  );

  return adjusted;
}
