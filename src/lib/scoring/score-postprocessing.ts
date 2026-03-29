import type { KnowledgeGap, Message, PromptImprovement } from "@/lib/db/types";
import type { ScoringInput, ScoringResult } from "./judge-scorer";

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

function hasTranscriptToolEvidence(messages: Message[]): boolean {
  return messages.some(
    (message) =>
      message.role === "tool" ||
      message.role === "system" ||
      Boolean(message.metadata?.tool_name) ||
      Boolean(message.metadata?.tool_result) ||
      Boolean(message.metadata?.source)
  );
}

function hasOperationalRecordClaim(messages: Message[]): boolean {
  return messages.some(
    (message) =>
      message.role === "agent" &&
      /(i can see|i found|i checked|it looks like|already exists|in your pipeline|on your account|your account shows|your order shows|your subscription is|record shows|crm|deal|contact|ticket|company|workspace|briefing|close date|stage|value|partner|decision-maker|internal champion|open todos|what to do next|risk|competitor)/i.test(
        message.content
      )
  );
}

function customerRequestedGuidance(messages: Message[]): boolean {
  return messages.some(
    (message) =>
      message.role === "customer" &&
      /\b(what shall i do|what should i do|what do i do|what next|next steps|priority|prioritise|prioritize|how do i convert|how can i convert|how do i win|how can i win|show me|walk me through|explain|health trend|score history|improving or declining|what changed and when|closest deal|which deal|why)\b/i.test(
        message.content
      )
  );
}

function agentDeliveredStructuredPlan(messages: Message[]): boolean {
  return messages.some((message) => {
    if (message.role !== "agent") return false;

    return (
      /\b(priority|priorities|next step|next steps|watch point|recommend|start with|follow up|leadership|briefing|summary|trend|health)\b/i.test(
        message.content
      ) &&
      (/[-•\n]/.test(message.content) || /\bfirst\b|\bsecond\b|\bthird\b/i.test(message.content))
    );
  });
}

function hasSubstantiveAgentResponse(messages: Message[]): boolean {
  const agentMessages = messages.filter((message) => message.role === "agent");
  if (agentMessages.length === 0) return false;

  return agentMessages.some((message) => {
    const normalized = message.content.trim();
    const wordCount = normalized.split(/\s+/).filter(Boolean).length;
    return (
      wordCount >= 25 ||
      /priority|next step|today|first|second|follow up|action|recommend|should|start with|watch point|briefing|snapshot|stage|value|close date|contact|where things stand|risk|todo|what to do next/i.test(
        normalized
      ) ||
      /##|###|\|/.test(normalized)
    );
  });
}

function hasNegativeAgentTone(messages: Message[]): boolean {
  return messages.some(
    (message) =>
      message.role === "agent" &&
      /(can't help|not my problem|figure it out|obviously|as i said|i already told you|you should know)/i.test(
        message.content
      )
  );
}

function customerAskedForAnalysis(messages: Message[]): boolean {
  return messages.some(
    (message) =>
      message.role === "customer" &&
      /\b(show me|explain|score history|trend|health|why|what changed|closest deal|which deal|summary|briefing|leadership)\b/i.test(
        message.content
      )
  );
}

function customerRequestedAction(messages: Message[]): boolean {
  return messages.some(
    (message) =>
      message.role === "customer" &&
      /\b(add|create|update|edit|change|delete|remove|cancel|refund|reset|book|schedule|send|apply|upgrade|downgrade|rename)\b/i.test(
        message.content
      )
  );
}

function agentAskedClarifyingQuestion(messages: Message[]): boolean {
  return messages.some(
    (message) =>
      message.role === "agent" &&
      /\?/.test(message.content)
  );
}

function agentConfirmedAction(messages: Message[]): boolean {
  return messages.some(
    (message) =>
      message.role === "agent" &&
      /\b(i've|i have|done|created|updated|changed|cancelled|canceled|reset|sent|scheduled|added|removed|completed|switched|processed)\b/i.test(
        message.content
      )
  );
}

function hasMissingToolEvidenceButHelpfulResponse(messages: Message[]): boolean {
  return (
    hasOperationalRecordClaim(messages) &&
    !hasTranscriptToolEvidence(messages) &&
    hasSubstantiveAgentResponse(messages)
  );
}

function hasOnlyUnverifiableClaims(result: ScoringResult): boolean {
  const claims = result.claim_analysis || [];
  if (claims.length === 0) return false;

  return claims.every((claim) => claim.verdict === "unverifiable" || claim.verdict === "verified");
}

function isStrongAdvisoryAnswer(messages: Message[]): boolean {
  return (
    (customerRequestedGuidance(messages) || customerAskedForAnalysis(messages)) &&
    hasSubstantiveAgentResponse(messages) &&
    agentDeliveredStructuredPlan(messages) &&
    !hasCustomerDissatisfaction(messages)
  );
}

function pushPromptImprovement(
  improvements: PromptImprovement[],
  improvement: PromptImprovement
) {
  const issueKey = improvement.issue.toLowerCase().trim();
  const exists = improvements.some((candidate) => candidate.issue.toLowerCase().trim() === issueKey);
  if (!exists) {
    improvements.push(improvement);
  }
}

function pushKnowledgeGap(gaps: KnowledgeGap[], gap: KnowledgeGap) {
  const topicKey = gap.topic.toLowerCase().trim();
  const existing = gaps.find((candidate) => candidate.topic.toLowerCase().trim() === topicKey);
  if (existing) {
    existing.affected_conversations = Math.max(existing.affected_conversations, gap.affected_conversations);
    return;
  }

  gaps.push(gap);
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

function removeMatchingFlags(flags: string[], pattern: RegExp): string[] {
  return flags.filter((flag) => !pattern.test(flag));
}

function removePromptImprovementsByPattern(
  improvements: PromptImprovement[],
  pattern: RegExp
): PromptImprovement[] {
  return improvements.filter((improvement) => {
    const combined = `${improvement.issue} ${improvement.current_behavior} ${improvement.recommended_prompt_change}`;
    return !pattern.test(combined);
  });
}

function removeKnowledgeGapsByPattern(
  gaps: KnowledgeGap[],
  pattern: RegExp
): KnowledgeGap[] {
  return gaps.filter((gap) => {
    const combined = `${gap.topic} ${gap.description} ${gap.suggested_content}`;
    return !pattern.test(combined);
  });
}

function downgradeUnsupportedOperationalFabrication(
  input: ScoringInput,
  result: ScoringResult
): ScoringResult {
  const hasToolEvidence = hasTranscriptToolEvidence(input.messages);
  const operational = hasOperationalRecordClaim(input.messages);
  const hasKbBackedEvidence = result.claim_analysis.some(
    (claim) =>
      Boolean(claim.kb_source) &&
      (claim.verdict === "verified" || claim.verdict === "contradicted")
  );

  if (hasToolEvidence || !operational || hasKbBackedEvidence) {
    return result;
  }

  const remappedClaims = result.claim_analysis.map((claim) => {
    if (claim.verdict !== "fabricated" && claim.verdict !== "contradicted") {
      return claim;
    }

    return {
      ...claim,
      verdict: "unverifiable" as const,
      evidence:
        claim.evidence ||
        "The transcript did not include a visible lookup or source trace, so this claim could not be verified from the available evidence.",
    };
  });

  const stillHasStrongNegativeClaims = remappedClaims.some(
    (claim) => claim.verdict === "fabricated" || claim.verdict === "contradicted"
  );
  if (stillHasStrongNegativeClaims) {
    return result;
  }

  return {
    ...result,
    claim_analysis: remappedClaims,
    flags: removeMatchingFlags(result.flags, /fabricat|hallucinat|unsupported_internal_metrics|unsupported_contact_roles|likely_fabricated/i),
  };
}

function buildDefaultSummary(result: ScoringResult, confidence: { level: "high" | "medium" | "low"; reasons: string[] }) {
  const strongResolution = result.resolution_score >= 0.75;
  const strongGrounding = result.hallucination_score >= 0.8 && result.accuracy_score >= 0.75;
  const weakResolution = result.resolution_score < 0.45;
  const weakGrounding = result.hallucination_score < 0.55 || result.accuracy_score < 0.55;

  if (strongResolution && strongGrounding) {
    return `The agent gave a strong, actionable answer that appears directionally correct. Confidence is ${confidence.level} because ${confidence.reasons[0]?.toLowerCase() || "the available evidence was sufficient"}.`;
  }

  if (strongResolution && !strongGrounding) {
    return `The agent gave a strong, decision-useful answer and moved the user toward a sensible next step, but some claims were only weakly grounded in the available evidence. Confidence is ${confidence.level} because ${confidence.reasons[0]?.toLowerCase() || "verification context was limited"}.`;
  }

  if (weakResolution && weakGrounding) {
    return `The response did not reliably move the user toward a safe or correct outcome. Confidence is ${confidence.level} because ${confidence.reasons[0]?.toLowerCase() || "multiple quality signals were weak"}.`;
  }

  if (weakResolution) {
    return `The answer had some useful content, but it did not fully resolve the user's request. Confidence is ${confidence.level} because ${confidence.reasons[0]?.toLowerCase() || "the transcript left important uncertainty"}.`;
  }

  if (weakGrounding) {
    return `The answer was partially helpful, but key claims were not grounded strongly enough to treat as fully reliable. Confidence is ${confidence.level} because ${confidence.reasons[0]?.toLowerCase() || "evidence for verification was limited"}.`;
  }

  return `The response was broadly serviceable with some remaining quality tradeoffs. Confidence is ${confidence.level} because ${confidence.reasons[0]?.toLowerCase() || "the evidence was mixed"}.`;
}

function deriveConfidenceLevel(
  input: ScoringInput,
  result: ScoringResult
): { level: "high" | "medium" | "low"; reasons: string[] } {
  const reasons: string[] = [];
  let penalty = 0;
  const strongAdvisoryAnswer = isStrongAdvisoryAnswer(input.messages);

  if (!input.knowledgeBaseContext?.length) {
    penalty += strongAdvisoryAnswer ? 0.5 : 1;
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
    penalty += strongAdvisoryAnswer ? 0.5 : 1;
    reasons.push("Several important claims could not be verified confidently.");
  }

  if (claims.length > 0 && verifiedClaims.length === 0) {
    penalty += strongAdvisoryAnswer ? 0.5 : 1;
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

  if (
    result.flags.includes("grounding_risk_without_tool_trace") ||
    result.flags.includes("limited_transcript_grounding")
  ) {
    penalty += strongAdvisoryAnswer ? 0.5 : 1;
    reasons.push("The transcript omitted some lookup or tool evidence, which limits verification confidence.");
  }

  if (penalty >= 3.5) {
    return { level: "low", reasons };
  }

  if (penalty >= 1.5) {
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
  const normalizedResult = downgradeUnsupportedOperationalFabrication(input, result);
  const strongAdvisoryAnswer = isStrongAdvisoryAnswer(input.messages);
  const adjusted = {
    ...normalizedResult,
    flags: [...normalizedResult.flags],
    prompt_improvements: [...normalizedResult.prompt_improvements],
    knowledge_gaps: [...normalizedResult.knowledge_gaps],
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

  if (fabricatedClaims.length === 0 && contradictedClaims.length === 0 && unverifiableClaims.length > 0) {
    adjusted.flags = removeMatchingFlags(adjusted.flags, /fabricat|hallucinat/i);
    pushUniqueFlag(adjusted.flags, "ungrounded_claims_require_review");
  }

  if (!input.knowledgeBaseContext?.length && unverifiableClaims.length >= 3) {
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

  if (hasOperationalRecordClaim(input.messages) && !hasTranscriptToolEvidence(input.messages)) {
    const unsupportedButHelpful = hasMissingToolEvidenceButHelpfulResponse(input.messages);
    pushUniqueFlag(adjusted.flags, unsupportedButHelpful ? "limited_verification_trace" : "tool_backed_claim_without_evidence");
    if (!unsupportedButHelpful) {
      pushUniqueFlag(adjusted.flags, "org_policy_gap_tool_verification");
      pushPromptImprovement(adjusted.prompt_improvements, {
        issue: "Agent makes record-specific claims without visible lookup evidence",
        current_behavior:
          "The agent referenced CRM or account state without showing a tool lookup or system result in the transcript.",
        recommended_prompt_change:
          "Add to the system prompt: 'Before making any claim about a deal, account, ticket, order, subscription, or internal record, perform the live lookup first. Only state record details after the lookup succeeds. If you cannot verify the record state with a live tool call, say explicitly that you cannot confirm it yet and ask permission to retry or escalate.'",
        expected_impact:
          "Reduces hallucinated operational claims and creates a reusable org-wide policy for tool-backed answers.",
        priority: "high",
      });
      pushKnowledgeGap(adjusted.knowledge_gaps, {
        topic: "Operational Tool Verification Policy",
        description:
          "The workspace needs a documented rule for how the agent should verify CRM or account state before making record-specific claims.",
        affected_conversations: 1,
        suggested_content:
          "Document an agent policy that any CRM, account, ticket, order, or subscription claim must come from a live lookup. Include the exact tool name, what fields can be stated after lookup, and the fallback response when the tool is unavailable.",
      });
    }

    if (unsupportedButHelpful && fabricatedClaims.length === 0 && contradictedClaims.length === 0) {
      adjusted.hallucination_score = 1;
      adjusted.accuracy_score = Math.max(adjusted.accuracy_score, strongAdvisoryAnswer ? 0.84 : 0.76);
      adjusted.resolution_score = Math.max(adjusted.resolution_score, strongAdvisoryAnswer ? 0.84 : adjusted.resolution_score);
      adjusted.hard_fail = false;
      adjusted.overall_decision = strongAdvisoryAnswer ? "pass" : adjusted.overall_decision === "fail" ? "borderline" : adjusted.overall_decision;
      adjusted.flags = removeMatchingFlags(
        adjusted.flags,
        /hard_fail_triggered|unsupported_crm_briefing|needed_escalation_for_data_access|potentially_fabricated|critical_time_sensitive_claim_ungrounded|specific_financial_figures_without_source|integration_missing_tool_trace|tool_backed_claim_without_evidence|org_policy_gap_tool_verification/i
      );
      adjusted.prompt_improvements = removePromptImprovementsByPattern(
        adjusted.prompt_improvements,
        /source attribution|timestamp|crm lookup tool|deal briefing access workflow|operational data.*source|tool capability to do so|record-specific claims without visible lookup evidence|live lookup first/i
      );
      adjusted.knowledge_gaps = removeKnowledgeGapsByPattern(
        adjusted.knowledge_gaps,
        /operational tool verification policy|crm deal briefing access workflow|score vs ml win probability/i
      );

      adjusted.summary = strongAdvisoryAnswer
        ? "The agent delivered a strong, actionable answer that appears useful and internally coherent. The main limitation is that the transcript did not include the lookup evidence needed to verify some record-level details, so this should be treated as a low-confidence review rather than a hallucination failure."
        : "The answer was directionally useful, but some record-level details could not be checked from the transcript alone. Treat it as helpful output with limited verification evidence.";
    }
  }

  if (
    customerRequestedGuidance(input.messages) &&
    hasSubstantiveAgentResponse(input.messages) &&
    !hasCustomerDissatisfaction(input.messages)
  ) {
    adjusted.resolution_score = Math.max(adjusted.resolution_score, 0.82);
    adjusted.tone_score = Math.max(adjusted.tone_score, 0.84);
    adjusted.sentiment_score = Math.max(adjusted.sentiment_score, 0.64);
  }

  if (
    customerAskedForAnalysis(input.messages) &&
    hasSubstantiveAgentResponse(input.messages) &&
    !hasCustomerDissatisfaction(input.messages)
  ) {
    adjusted.resolution_score = Math.max(adjusted.resolution_score, 0.8);
    adjusted.sentiment_score = Math.max(adjusted.sentiment_score, 0.62);
  }

  if (strongAdvisoryAnswer) {
    adjusted.resolution_score = Math.max(adjusted.resolution_score, 0.86);
    adjusted.tone_score = Math.max(adjusted.tone_score, 0.86);
    adjusted.sentiment_score = Math.max(adjusted.sentiment_score, 0.66);
  }

  if (
    unverifiableClaims.length > 0 &&
    fabricatedClaims.length === 0 &&
    contradictedClaims.length === 0 &&
    hasSubstantiveAgentResponse(input.messages)
  ) {
    adjusted.hallucination_score = 1;
    adjusted.accuracy_score = Math.max(adjusted.accuracy_score, strongAdvisoryAnswer ? 0.82 : 0.7);
    if (!hasNegativeAgentTone(input.messages)) {
      adjusted.tone_score = Math.max(adjusted.tone_score, 0.82);
    }
    pushUniqueFlag(adjusted.flags, "grounding_risk_review_recommended");
  }

  if (hasOnlyUnverifiableClaims(adjusted) && strongAdvisoryAnswer) {
    adjusted.prompt_improvements = removePromptImprovementsByPattern(
      adjusted.prompt_improvements,
      /lookup evidence|tool verification|source attribution|timestamp|crm lookup|escalate instead of guessing/i
    );
    adjusted.knowledge_gaps = removeKnowledgeGapsByPattern(
      adjusted.knowledge_gaps,
      /operational tool verification policy|crm deal briefing access workflow/i
    );
  }

  if (endsWithUnresolvedCustomerIntent(input.messages)) {
    adjusted.resolution_score = Math.min(adjusted.resolution_score, 0.4);
    adjusted.sentiment_score = Math.min(adjusted.sentiment_score, 0.4);
    pushUniqueFlag(adjusted.flags, "user_intent_left_unresolved");
  }

  if (
    customerRequestedAction(input.messages) &&
    agentAskedClarifyingQuestion(input.messages) &&
    !agentConfirmedAction(input.messages)
  ) {
    adjusted.resolution_score = Math.min(adjusted.resolution_score, 0.52);
    pushUniqueFlag(adjusted.flags, "action_request_stalled_after_clarification");
    pushUniqueFlag(adjusted.flags, "org_policy_gap_action_progression");
    pushPromptImprovement(adjusted.prompt_improvements, {
      issue: "Action requests stall after clarification instead of moving to the next step",
      current_behavior:
        "The agent asked a clarifying question but did not clearly advance the requested action or explain what would happen next.",
      recommended_prompt_change:
        "Add to the system prompt: 'When a customer asks you to create, update, cancel, delete, or change something, ask at most one focused clarifying question when needed, then state the next action you will take once clarified. Keep the request moving toward execution instead of ending on clarification alone.'",
      expected_impact:
        "Improves resolution rate for operational requests and creates a consistent org-wide action-handling policy.",
      priority: "medium",
    });
  }

  if (adjusted.hard_fail) {
    adjusted.overall_score = Math.min(adjusted.overall_score, 0.35);
    adjusted.accuracy_score = Math.min(adjusted.accuracy_score, 0.35);
    adjusted.hallucination_score = Math.min(adjusted.hallucination_score, 0.35);
    pushUniqueFlag(adjusted.flags, "hard_fail_triggered");
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

  if (
    confidence.level === "low" &&
    adjusted.flags.includes("grounding_risk_review_recommended") &&
    !adjusted.claim_analysis.some((claim) => claim.verdict === "fabricated" || claim.verdict === "contradicted")
  ) {
    adjusted.overall_score = Math.min(adjusted.overall_score, strongAdvisoryAnswer ? 0.79 : 0.72);
    if (adjusted.overall_decision === "pass") {
      adjusted.overall_decision = "borderline";
    }
  }

  adjusted.summary =
    adjusted.summary ||
    buildDefaultSummary(adjusted, confidence);

  return adjusted;
}
