import type { Message, QualityScore } from "@/lib/db/types";
import type { ScoringInput, ScoringResult } from "./claude-scorer";

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

function hasToolEvidence(messages: Message[]) {
  return messages.some(
    (message) =>
      message.role === "tool" ||
      message.role === "system" ||
      Boolean(message.metadata?.tool_name) ||
      Boolean(message.metadata?.tool_result)
  );
}

function hasOperationalClaims(messages: Message[]) {
  return messages.some(
    (message) =>
      message.role === "agent" &&
      /(deal|pipeline|crm|ticket|account|subscription|contact|close date|probability|score|stage|value|owner|record)/i.test(
        message.content
      )
  );
}

function hasNoAgentResponse(messages: Message[]) {
  return !messages.some((message) => message.role === "agent" || message.role === "human_agent");
}

function hasHelpfulAnswer(messages: Message[]) {
  return messages.some((message) => {
    if (message.role !== "agent") return false;
    const words = message.content.trim().split(/\s+/).filter(Boolean).length;
    return words >= 20;
  });
}

function endsWithOpenQuestion(messages: Message[]) {
  const lastAgent = [...messages].reverse().find((message) => message.role === "agent");
  if (!lastAgent) return false;
  if (!/\?/.test(lastAgent.content)) return false;

  return !/(anything else|want me to|would you like me to|shall i|if you'd like|let me know)/i.test(
    lastAgent.content
  );
}

function customerSeemsDissatisfied(messages: Message[]) {
  return messages.some(
    (message) =>
      message.role === "customer" &&
      /(wrong|not helpful|frustrated|angry|still|doesn't help|didn't help|that is wrong|this is wrong)/i.test(
        message.content
      )
  );
}

export function buildDeterministicFallbackScore(
  input: ScoringInput,
  reason: string
): ScoringResult {
  const { messages, structuralMetrics } = input;

  if (hasNoAgentResponse(messages)) {
    return {
      overall_score: 0.134,
      accuracy_score: 0,
      hallucination_score: 0,
      resolution_score: 0,
      tone_score: 0.5,
      sentiment_score: 0.3,
      edge_case_score: 0.8,
      escalation_score: 0.85,
      claim_analysis: [],
      flags: [
        "scoring_fallback_used",
        "no_agent_response",
      ],
      summary:
        "The transcript contains no agent response, so the conversation cannot be treated as resolved. This was scored with deterministic fallback logic.",
      confidence_level: "medium",
      prompt_improvements: [
        {
          issue: "No agent response was captured for the conversation",
          current_behavior: "The customer asked a question, but no AI response was present in the stored transcript.",
          recommended_prompt_change:
            "Ensure the agent always returns a visible user-facing response, even when tools fail or data is unavailable. Never end a customer turn silently.",
          expected_impact:
            "Prevents complete resolution failures and makes missing responses immediately actionable.",
          priority: "high",
        },
      ],
      knowledge_gaps: [],
    };
  }

  const helpful = hasHelpfulAnswer(messages);
  const grounded = hasToolEvidence(messages);
  const operational = hasOperationalClaims(messages);
  const dissatisfied = customerSeemsDissatisfied(messages);
  const openQuestion = endsWithOpenQuestion(messages);

  const accuracy = grounded ? 0.84 : operational ? 0.72 : 0.78;
  const hallucination = grounded ? 0.9 : operational ? 0.78 : 0.85;
  const resolution = helpful ? (openQuestion ? 0.68 : 0.8) : 0.45;
  const tone = dissatisfied ? 0.7 : 0.84;
  const sentiment = dissatisfied ? 0.35 : helpful ? 0.64 : 0.5;

  const flags = ["scoring_fallback_used"];
  if (!grounded && operational) {
    flags.push("tool_backed_claim_without_evidence", "limited_transcript_grounding");
  }
  if (openQuestion) {
    flags.push("conversation_may_still_be_open");
  }

  const overall = clamp(
    accuracy * 0.2 +
      hallucination * 0.25 +
      resolution * 0.25 +
      tone * 0.15 +
      sentiment * 0.1 +
      0.8 * 0.03 +
      0.85 * 0.02
  );

  const summary = !grounded && operational
    ? "The agent gave a useful operational answer, but the transcript did not include the tool or system evidence needed to fully verify it. This fallback score treats the result as helpful but low-confidence."
    : "The transcript was scored with deterministic fallback logic because the full model evaluation did not complete cleanly.";

  const prompt_improvements: QualityScore["prompt_improvements"] = [];
  if (!grounded && operational) {
    prompt_improvements.push({
      issue: "Operational claims were made without visible tool evidence",
      current_behavior:
        "The transcript contains CRM or operational assertions, but no explicit lookup result or system evidence was captured.",
      recommended_prompt_change:
        "Before making any claim about a record, score, stage, value, close date, or account state, perform the live lookup first and include the result in the response context. If lookup evidence is unavailable, say explicitly that the answer is based on incomplete grounding.",
      expected_impact:
        "Improves trust, reduces unverifiable claims, and gives the scorer grounded evidence to work with.",
      priority: "high",
    });
  }

  return {
    overall_score: overall,
    accuracy_score: accuracy,
    hallucination_score: hallucination,
    resolution_score: resolution,
    tone_score: tone,
    sentiment_score: sentiment,
    edge_case_score: 0.8,
    escalation_score: 0.85,
    claim_analysis: [],
    flags,
    summary,
    confidence_level: grounded ? "medium" : "low",
    prompt_improvements,
    knowledge_gaps: [],
    rubric_scores: {
      instruction_following: { score: helpful ? 4 : 2, rationale: helpful ? "The answer addressed the request." : "The answer only partially addressed the request." },
      factual_accuracy: { score: grounded ? 4 : operational ? 3 : 4, rationale: grounded ? "The transcript includes grounding evidence." : "The answer is plausible but not fully evidenced in the transcript." },
      groundedness: { score: grounded ? 5 : operational ? 3 : 4, rationale: grounded ? "Tool or system evidence was present." : "Grounding evidence was limited." },
      completeness: { score: helpful ? 4 : 2, rationale: helpful ? "The response covered the main user need." : "The response omitted important parts." },
      helpfulness: { score: helpful ? 4 : 2, rationale: helpful ? "The response was action-oriented and useful." : "The response provided limited utility." },
      calibration: { score: grounded ? 4 : 3, rationale: grounded ? "Confidence appears proportional to evidence." : "The answer would benefit from clearer uncertainty handling." },
      safety: { score: 5, rationale: "No safety issue was detected in the transcript." },
    },
    hard_fail: false,
    overall_decision: overall >= 0.75 ? "pass" : overall >= 0.55 ? "borderline" : "fail",
    _meta: {
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: 0,
      model: `deterministic-fallback:${reason}:${structuralMetrics.conversation_type}`,
    },
  };
}
