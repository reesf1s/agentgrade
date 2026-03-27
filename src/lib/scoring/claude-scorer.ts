/**
 * Pass 2: Deep Quality Evaluation — 1 Claude API call per conversation
 *
 * Single batched prompt evaluates ALL dimensions simultaneously.
 * Returns structured JSON with scores, claim verdicts, prompt improvement
 * recommendations, and knowledge gaps.
 *
 * Cost: ~$0.01–0.05 per conversation depending on length.
 * Rate limit handling: exponential backoff with jitter (up to 3 retries).
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  Message,
  ClaimAnalysis,
  PromptImprovement,
  KnowledgeGap,
  StructuralMetrics,
} from "@/lib/db/types";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ─── Pricing (claude-sonnet-4-6, per million tokens) ───────────────
const COST_PER_MILLION_INPUT_TOKENS = 3.0;   // $3.00 / 1M
const COST_PER_MILLION_OUTPUT_TOKENS = 15.0; // $15.00 / 1M

// ─── System Prompt ─────────────────────────────────────────────────
const SCORING_SYSTEM_PROMPT = `You are AgentGrade's quality evaluation engine. You assess AI agent conversations with surgical precision.

You will receive:
1. A conversation transcript between an AI agent and a customer
2. Structural analysis data (turn counts, extracted claims, sentiment)
3. Relevant knowledge base context (if available)

Evaluate the conversation across ALL dimensions in a SINGLE response. Be rigorous but fair. Base verdicts on evidence from the transcript, not assumptions.

## Scoring Rubric (0.0 to 1.0 scale for all dimensions)

### accuracy_score
- 1.0: Every factual claim is correct and verifiable
- 0.7–0.9: Mostly correct, minor inaccuracies that don't mislead
- 0.4–0.6: Mix of correct and incorrect information
- 0.0–0.3: Majority of claims are wrong or unverifiable

### hallucination_score (1.0 = ZERO hallucinations — higher is better)
- 1.0: Zero fabricated information, everything is grounded
- 0.7–0.9: Minor embellishments but nothing dangerous or consequential
- 0.4–0.6: Some fabricated claims, policies, or procedures
- 0.0–0.3: Significant fabrication — invented products, prices, policies, or links

### resolution_score
- 1.0: Customer's problem fully solved with correct action taken
- 0.7–0.9: Problem mostly resolved, minor gaps remain
- 0.4–0.6: Problem acknowledged but not properly resolved
- 0.0–0.3: Problem ignored, wrong solution given, or customer left worse off

### tone_score
- 1.0: Professional, empathetic, perfectly brand-appropriate throughout
- 0.7–0.9: Generally good tone with isolated lapses
- 0.4–0.6: Robotic, dismissive, formulaic, or slightly inappropriate
- 0.0–0.3: Rude, condescending, passive-aggressive, or severely off-brand

### sentiment_score (customer satisfaction estimate)
- 1.0: Customer clearly satisfied — positive language, thanks, explicit confirmation
- 0.7–0.9: Customer seems content, no complaints at close
- 0.4–0.6: Customer neutral, outcome unclear, or conversation ended abruptly
- 0.0–0.3: Customer left frustrated, angry, or explicitly dissatisfied

### edge_case_score (handling of unusual/unexpected queries)
- 1.0: Agent expertly handled edge cases, showed creative problem-solving
- 0.7–0.9: Edge cases mostly handled with only minor gaps
- 0.4–0.6: Some edge cases ignored, deflected, or poorly managed
- 0.0–0.3: Agent completely failed on unusual scenarios, gave generic non-answers
- NOTE: If there were no edge cases in this conversation, score 0.8 (neutral)

### escalation_score (appropriateness of escalation handling)
- 1.0: Escalation handled perfectly — right timing, warm handoff, context provided
- 0.7–0.9: Good escalation with minor friction (e.g., slight delay)
- 0.4–0.6: Escalation handled poorly — wrong timing, cold handoff, or ignored request
- 0.0–0.3: Escalation completely mishandled or missed when clearly needed
- NOTE: If no escalation occurred AND none was needed, score 0.85 (neutral)

### overall_score
Weighted composite: accuracy(0.20) + hallucination(0.25) + resolution(0.25) + tone(0.15) + sentiment(0.10) + edge_case(0.03) + escalation(0.02)

## Claim Analysis
For each extracted claim from the agent, determine:
- "verified": matches knowledge base or is clearly factually correct
- "unverifiable": cannot determine truth with available context
- "contradicted": claim conflicts with knowledge base or known facts
- "fabricated": claim is invented — no basis in reality or knowledge base

For each claim, also estimate severity if wrong:
- "low": minor inconvenience if incorrect
- "medium": meaningful customer impact
- "high": significant harm (wrong pricing, wrong policy, failed solution)
- "critical": legal/financial/safety implications

## Prompt Improvements
For every quality issue identified, recommend a SPECIFIC change to the agent's system prompt.
Be concrete — give the actual text they should add or modify. Do not give vague advice.

## Knowledge Gaps
Identify topics where the agent clearly lacked information that should be in the knowledge base.

Return ONLY valid JSON. No markdown fences, no explanation text outside the JSON.`;

// ─── Output Schema (shown to Claude as template) ───────────────────
const SCORING_OUTPUT_SCHEMA = `{
  "overall_score": <float 0-1>,
  "accuracy_score": <float 0-1>,
  "hallucination_score": <float 0-1>,
  "resolution_score": <float 0-1>,
  "tone_score": <float 0-1>,
  "sentiment_score": <float 0-1>,
  "edge_case_score": <float 0-1>,
  "escalation_score": <float 0-1>,
  "claim_analysis": [
    {
      "claim": "<the agent's exact factual claim>",
      "verdict": "verified|unverifiable|contradicted|fabricated",
      "evidence": "<why this verdict — cite specific transcript text or KB>",
      "kb_source": "<which KB doc was used, or null>",
      "severity": "low|medium|high|critical"
    }
  ],
  "flags": ["<descriptive flag like 'fabricated_pricing' or 'missed_escalation'>"],
  "summary": "<2-3 sentence overall quality assessment>",
  "prompt_improvements": [
    {
      "issue": "<what went wrong or could be better>",
      "current_behavior": "<what the agent actually did>",
      "recommended_prompt_change": "<exact text to add/change in system prompt>",
      "expected_impact": "<what this fix would improve>",
      "priority": "high|medium|low"
    }
  ],
  "knowledge_gaps": [
    {
      "topic": "<topic name>",
      "description": "<what specific information is missing>",
      "affected_conversations": 1,
      "suggested_content": "<draft content to add to the knowledge base>"
    }
  ]
}`;

// ─── Types ──────────────────────────────────────────────────────────
export interface ScoringInput {
  messages: Message[];
  structuralMetrics: StructuralMetrics;
  knowledgeBaseContext?: string[];
}

export interface ScoringResult {
  overall_score: number;
  accuracy_score: number;
  hallucination_score: number;
  resolution_score: number;
  tone_score: number;
  sentiment_score: number;
  edge_case_score: number;
  escalation_score: number;
  claim_analysis: ClaimAnalysis[];
  flags: string[];
  summary: string;
  prompt_improvements: PromptImprovement[];
  knowledge_gaps: KnowledgeGap[];
  // Metadata (not stored in DB, logged for cost monitoring)
  _meta?: {
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
    model: string;
  };
}

// ─── Exponential Backoff Retry ──────────────────────────────────────
/**
 * Retries an async operation with exponential backoff on rate limit errors.
 * Only retries on HTTP 429 (rate limit) and 529 (overloaded).
 * All other errors are thrown immediately.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000
): Promise<T> {
  let lastError: Error = new Error("Unknown error");

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Only retry on rate limit / overloaded responses
      if (error instanceof Anthropic.APIError) {
        if (error.status === 429 || error.status === 529) {
          const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500;
          console.warn(`Claude rate limited (attempt ${attempt + 1}/${maxRetries}), retrying in ${Math.round(delay)}ms`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }

      // Non-retriable error — throw immediately
      throw error;
    }
  }

  throw lastError;
}

// ─── Score Clamping ─────────────────────────────────────────────────
function clamp(value: unknown, fallback = 0.5): number {
  const n = typeof value === "number" ? value : parseFloat(String(value));
  if (isNaN(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

// ─── Main Evaluation Function ───────────────────────────────────────
/**
 * Calls Claude to evaluate a conversation across all quality dimensions.
 * Returns structured scoring result. One API call per conversation.
 */
export async function evaluateWithClaude(input: ScoringInput): Promise<ScoringResult> {
  const { messages, structuralMetrics, knowledgeBaseContext } = input;

  // ── Build transcript ────────────────────────────────────────────
  const transcript = messages
    .map((m) => `[${m.role.toUpperCase()}]: ${m.content}`)
    .join("\n\n");

  // ── Build user message ──────────────────────────────────────────
  let userMessage = `## Conversation Transcript\n\n${transcript}\n\n`;

  userMessage += `## Structural Analysis\n`;
  userMessage += `- Turn count: ${structuralMetrics.turn_count}\n`;
  userMessage += `- Agent turns: ${structuralMetrics.agent_turns}\n`;
  userMessage += `- Customer turns: ${structuralMetrics.customer_turns}\n`;
  userMessage += `- Conversation type: ${structuralMetrics.conversation_type}\n`;
  userMessage += `- Escalation detected: ${
    structuralMetrics.escalation_turn !== undefined
      ? `Yes (turn ${structuralMetrics.escalation_turn})`
      : "No"
  }\n`;
  userMessage += `- Agent repetitions detected: ${structuralMetrics.repetition_count}\n`;
  userMessage += `- Claims to verify: ${structuralMetrics.extracted_claims.length}\n\n`;

  if (structuralMetrics.extracted_claims.length > 0) {
    userMessage += `## Claims to Evaluate\n`;
    structuralMetrics.extracted_claims.slice(0, 20).forEach((claim, i) => {
      // Cap at 20 claims to keep prompt manageable
      userMessage += `${i + 1}. "${claim}"\n`;
    });
    userMessage += "\n";
  }

  if (knowledgeBaseContext && knowledgeBaseContext.length > 0) {
    userMessage += `## Knowledge Base Context\n`;
    userMessage += `(Use this to verify agent claims and score accuracy/hallucination)\n\n`;
    knowledgeBaseContext.forEach((chunk, i) => {
      userMessage += `[KB Doc ${i + 1}]:\n${chunk}\n\n`;
    });
  } else {
    userMessage += `## Knowledge Base Context\nNone provided. Score accuracy and hallucination based on general plausibility and internal consistency.\n\n`;
  }

  userMessage += `## Required Output\n${SCORING_OUTPUT_SCHEMA}\n\nReturn ONLY the JSON object. No other text.`;

  // ── Call Claude with retry ──────────────────────────────────────
  try {
    const response = await withRetry(() =>
      anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2500,
        system: SCORING_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      })
    );

    const text = response.content[0].type === "text" ? response.content[0].text : "";

    // Parse JSON — handle occasional markdown fences from the model
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`No JSON found in scoring response. Raw: ${text.slice(0, 200)}`);
    }

    const raw = JSON.parse(jsonMatch[0]);

    // ── Compute cost ──────────────────────────────────────────────
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const costUsd =
      (inputTokens / 1_000_000) * COST_PER_MILLION_INPUT_TOKENS +
      (outputTokens / 1_000_000) * COST_PER_MILLION_OUTPUT_TOKENS;

    console.log(
      `[claude-scorer] tokens: ${inputTokens}in / ${outputTokens}out | cost: $${costUsd.toFixed(4)}`
    );

    // ── Validate and sanitize scores ──────────────────────────────
    const result: ScoringResult = {
      overall_score: clamp(raw.overall_score),
      accuracy_score: clamp(raw.accuracy_score),
      hallucination_score: clamp(raw.hallucination_score),
      resolution_score: clamp(raw.resolution_score),
      tone_score: clamp(raw.tone_score),
      sentiment_score: clamp(raw.sentiment_score),
      edge_case_score: clamp(raw.edge_case_score, 0.8),   // default neutral if missing
      escalation_score: clamp(raw.escalation_score, 0.85), // default neutral if no escalation
      claim_analysis: Array.isArray(raw.claim_analysis) ? raw.claim_analysis : [],
      flags: Array.isArray(raw.flags) ? raw.flags : [],
      summary: typeof raw.summary === "string" ? raw.summary : "Evaluation complete.",
      prompt_improvements: Array.isArray(raw.prompt_improvements) ? raw.prompt_improvements : [],
      knowledge_gaps: Array.isArray(raw.knowledge_gaps) ? raw.knowledge_gaps : [],
      _meta: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: costUsd,
        model: "claude-sonnet-4-6",
      },
    };

    // Recompute overall_score using the canonical weights in case Claude
    // deviated from the formula. This guarantees consistency.
    result.overall_score = clamp(
      result.accuracy_score * 0.20 +
      result.hallucination_score * 0.25 +
      result.resolution_score * 0.25 +
      result.tone_score * 0.15 +
      result.sentiment_score * 0.10 +
      result.edge_case_score * 0.03 +
      result.escalation_score * 0.02
    );

    return result;
  } catch (error) {
    console.error("[claude-scorer] Evaluation failed:", error);

    // Return conservative default scores — flag for manual review
    return {
      overall_score: 0.5,
      accuracy_score: 0.5,
      hallucination_score: 0.5,
      resolution_score: 0.5,
      tone_score: 0.5,
      sentiment_score: 0.5,
      edge_case_score: 0.8,
      escalation_score: 0.85,
      claim_analysis: [],
      flags: ["scoring_error"],
      summary: "Automated scoring failed. Manual review recommended.",
      prompt_improvements: [],
      knowledge_gaps: [],
    };
  }
}

// Backward-compatible alias (previously exported as scoreConversation)
export { evaluateWithClaude as scoreConversation };
