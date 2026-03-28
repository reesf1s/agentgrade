/**
 * Pass 2: Deep Quality Evaluation — 1 model API call per conversation
 *
 * Single batched prompt evaluates ALL dimensions simultaneously.
 * Returns structured JSON with scores, claim verdicts, prompt improvement
 * recommendations, and knowledge gaps.
 *
 * Cost: ~$0.01–0.05 per conversation depending on length.
 * Rate limit handling: exponential backoff with jitter (up to 3 retries).
 */

import OpenAI from "openai";
import type {
  Message,
  ClaimAnalysis,
  PromptImprovement,
  KnowledgeGap,
  StructuralMetrics,
} from "@/lib/db/types";
import { applyScoringGuardrails } from "./score-postprocessing";
import { buildDeterministicFallbackScore } from "./fallback";
import { getScoringModel, getScoringProvider } from "./config";

// ─── Pricing (defaults tuned for gpt-5.4-mini; override via env if needed) ───
const COST_PER_MILLION_INPUT_TOKENS = Number(process.env.SCORING_INPUT_COST_PER_MILLION || "0.6");
const COST_PER_MILLION_OUTPUT_TOKENS = Number(process.env.SCORING_OUTPUT_COST_PER_MILLION || "2.4");

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

// ─── System Prompt ─────────────────────────────────────────────────
const SCORING_SYSTEM_PROMPT = `You are AgentGrade's quality evaluation engine. You assess AI agent conversations with surgical precision.

You will receive:
1. A conversation transcript between an AI agent and a customer
2. Structural analysis data (turn counts, extracted claims, sentiment)
3. Relevant knowledge base context (if available)

Evaluate the conversation across ALL dimensions in a SINGLE response. Be rigorous but fair. Base verdicts on evidence from the transcript, not assumptions.

Your evaluation standard:
- Infer the user's actual intent, not just the literal last question.
- Judge whether the agent moved the user toward a real outcome, not whether it sounded polished.
- Distinguish between knowledge problems, prompt problems, and missing tool/system access.
- If the agent likely needed a missing integration, missing tool, or missing backend permission to succeed, call that out explicitly in flags, prompt improvements, or knowledge gaps.
- For operational claims about CRM, tickets, accounts, deals, subscriptions, or internal records, treat live tool/system evidence as required grounding. If the transcript does not show that evidence, prefer "unverifiable" over "verified".
- If the transcript contains a substantive agent answer, never describe the conversation as having "no response" or "no answer". Score the answer that is actually present.
- Separate helpfulness from grounding. A response can be useful and directionally strong while still having weak evidence. Reflect that by keeping resolution distinct from accuracy and hallucination.
- When tool-backed claims look plausible but the transcript does not include the lookup result, reduce confidence and mark the claims as unsupported or unverifiable before escalating to "fabricated", unless the details are clearly invented, contradicted, or implausibly specific.
- Do not lower accuracy_score or hallucination_score solely because a claim is unverifiable in the transcript. Lack of evidence should primarily lower confidence and raise a grounding risk unless there is contradiction, fabrication, or a strong internal inconsistency.
- For CRM, sales, support, or back-office answers that are concrete, coherent, and operationally useful, missing visible lookup evidence should usually result in medium/high hallucination scores with low confidence rather than low hallucination scores, unless the content is clearly self-contradictory or invented.
- If the agent answered the user's question well but grounding is missing, prefer scores that reflect "helpful but unverified" over scores that imply "failed response".
- Cite exact transcript turn numbers in claim evidence and in the reasoning for major prompt improvements whenever possible.
- If the same issue reflects a repeatable policy problem, phrase the prompt improvement so it can be rolled out across the organization, not just this one conversation.
- Internally evaluate the response against these seven rubric dimensions as well: instruction_following, factual_accuracy, groundedness, completeness, helpfulness, calibration, safety.
- Use hard_fail=true only when there is a dangerous factual error, fabricated citation/source/quote, major instruction miss, severe hallucination presented as fact, or a policy/safety violation.
- Distinguish unsupported but plausible content from clearly false content. Unsupported content primarily hurts groundedness and calibration unless stronger evidence shows factual error.
- In the summary, lead with the best judgment about answer quality and user outcome first. Mention uncertainty or confidence briefly as a qualifier, not as the whole summary.

## Scoring Rubric (0.0 to 1.0 scale for all dimensions)

### accuracy_score
- 1.0: Every factual claim is correct and verifiable
- 0.7–0.9: Mostly correct, minor inaccuracies that don't mislead
- 0.4–0.6: Mix of correct and incorrect information
- 0.0–0.3: Majority of claims are wrong, contradicted, or clearly fabricated
- Unverifiable claims alone should not force a low accuracy score. Use them to reduce confidence unless there is stronger evidence of error.

### hallucination_score (1.0 = ZERO hallucinations — higher is better)
- 1.0: Zero fabricated information, everything is grounded
- 0.7–0.9: Minor embellishments but nothing dangerous or consequential
- 0.4–0.6: Some fabricated claims, policies, or procedures
- 0.0–0.3: Significant fabrication — invented products, prices, policies, or links
- If the answer appears operationally useful but visible grounding is missing, prefer a mid/high score with lower confidence and a grounding-risk flag over treating it as proven fabrication.

### resolution_score
- 1.0: Customer's problem fully solved with correct action taken
- 0.7–0.9: Problem mostly resolved, minor gaps remain
- 0.4–0.6: Problem acknowledged but not properly resolved
- 0.0–0.3: Problem ignored, wrong solution given, or customer left worse off
- If the user asked for advice, prioritization, or recommended next steps and the agent provided a concrete, relevant action plan, resolution should not be near zero solely because the answer lacks visible tool evidence.

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
When relevant, recommendations may also include:
- better intent clarification
- stricter anti-hallucination rules
- clearer escalation triggers
- tool usage rules
- missing system access / integration requirements
- when to admit lack of access instead of bluffing

## Knowledge Gaps
Identify topics where the agent clearly lacked information that should be in the knowledge base.
If the issue is not knowledge but missing operational capability, use "suggested_content" to describe the missing workflow, integration, or tool requirement that the team should add.

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
      "evidence": "<why this verdict — cite specific transcript turn numbers, text, or KB>",
      "kb_source": "<which KB doc was used, or null>",
      "severity": "low|medium|high|critical"
    }
  ],
  "flags": ["<descriptive flag like 'fabricated_pricing' or 'missed_escalation'>"],
  "summary": "<2-3 sentence overall quality assessment that starts with the actual judgment, not just uncertainty language>",
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
  ],
  "rubric_scores": {
    "instruction_following": { "score": <1-5>, "rationale": "<string>" },
    "factual_accuracy": { "score": <1-5>, "rationale": "<string>" },
    "groundedness": { "score": <1-5>, "rationale": "<string>" },
    "completeness": { "score": <1-5>, "rationale": "<string>" },
    "helpfulness": { "score": <1-5>, "rationale": "<string>" },
    "calibration": { "score": <1-5>, "rationale": "<string>" },
    "safety": { "score": <1-5>, "rationale": "<string>" }
  },
  "hard_fail": <boolean>,
  "overall_decision": "pass|borderline|fail"
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
  confidence_level?: "high" | "medium" | "low";
  prompt_improvements: PromptImprovement[];
  knowledge_gaps: KnowledgeGap[];
  rubric_scores?: Record<string, { score: number; rationale: string }>;
  hard_fail?: boolean;
  overall_decision?: "pass" | "borderline" | "fail";
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
 * Retries an async operation with exponential backoff on transient provider errors.
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
      const status =
        typeof error === "object" && error && "status" in error
          ? Number((error as { status?: number }).status)
          : undefined;

      if ([429, 500, 502, 503, 504, 529].includes(status || 0)) {
        const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500;
        console.warn(
          `Scoring model rate limited/unavailable (attempt ${attempt + 1}/${maxRetries}), retrying in ${Math.round(delay)}ms`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
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

function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
}

function normalizeFivePointScore(value: unknown, fallback = 3): number {
  const n = typeof value === "number" ? value : parseFloat(String(value));
  if (Number.isNaN(n)) return fallback;
  return Math.max(1, Math.min(5, n));
}

function toZeroOneFromFivePoint(value: unknown, fallback = 0.6): number {
  const five = normalizeFivePointScore(value, fallback * 5);
  return (five - 1) / 4;
}

// ─── Main Evaluation Function ───────────────────────────────────────
/**
 * Calls the configured model to evaluate a conversation across all quality dimensions.
 * Returns structured scoring result. One API call per conversation.
 */
export async function evaluateWithClaude(input: ScoringInput): Promise<ScoringResult> {
  const { messages, structuralMetrics, knowledgeBaseContext } = input;
  const model = getScoringModel();
  const provider = getScoringProvider();

  // ── Build transcript ────────────────────────────────────────────
  const transcript = messages
    .map((m, index) => `[TURN ${index + 1}][${m.role.toUpperCase()}]: ${truncateText(m.content, 1200)}`)
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
  userMessage += `- Tool/system evidence turns: ${messages.filter((message) => message.role === "tool" || message.role === "system").length}\n\n`;

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
      userMessage += `[KB Doc ${i + 1}]:\n${truncateText(chunk, 1800)}\n\n`;
    });
  } else {
    userMessage += `## Knowledge Base Context\nNone provided. Score accuracy and hallucination based on general plausibility and internal consistency.\n\n`;
  }

  userMessage += `## Required Output\n${SCORING_OUTPUT_SCHEMA}\n\nReturn ONLY the JSON object. No other text.`;

  if (!process.env.OPENAI_API_KEY) {
    return applyScoringGuardrails(input, buildDeterministicFallbackScore(input, "missing_openai_api_key"));
  }

  const openai = getOpenAIClient();
  if (!openai) {
    return applyScoringGuardrails(input, buildDeterministicFallbackScore(input, "missing_openai_client"));
  }

  // ── Call model with retry ───────────────────────────────────────
  try {
    const response = await withRetry(() =>
      openai.responses.create({
        model,
        reasoning: { effort: "medium" },
        text: { verbosity: "medium" },
        input: [
          { role: "system", content: SCORING_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      })
    );

    const text = response.output_text || "";

    // Parse JSON — handle occasional markdown fences from the model
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`No JSON found in scoring response. Raw: ${text.slice(0, 200)}`);
    }

    const raw = JSON.parse(jsonMatch[0]);
    const rubricScores = typeof raw.rubric_scores === "object" && raw.rubric_scores
      ? raw.rubric_scores as Record<string, { score?: number; rationale?: string }>
      : {};

    const instructionFollowing = toZeroOneFromFivePoint(rubricScores.instruction_following?.score, 0.6);
    const factualAccuracy = toZeroOneFromFivePoint(rubricScores.factual_accuracy?.score, raw.accuracy_score ?? 0.6);
    const groundedness = toZeroOneFromFivePoint(rubricScores.groundedness?.score, raw.hallucination_score ?? 0.6);
    const completeness = toZeroOneFromFivePoint(rubricScores.completeness?.score, raw.resolution_score ?? 0.6);
    const helpfulness = toZeroOneFromFivePoint(rubricScores.helpfulness?.score, raw.resolution_score ?? 0.6);
    const calibration = toZeroOneFromFivePoint(rubricScores.calibration?.score, 0.6);
    const safety = toZeroOneFromFivePoint(rubricScores.safety?.score, 0.85);

    const derivedOverall =
      instructionFollowing * 0.2 +
      factualAccuracy * 0.2 +
      groundedness * 0.2 +
      completeness * 0.15 +
      helpfulness * 0.15 +
      calibration * 0.05 +
      safety * 0.05;

    // ── Compute cost ──────────────────────────────────────────────
    const inputTokens = response.usage?.input_tokens || 0;
    const outputTokens = response.usage?.output_tokens || 0;
    const costUsd =
      (inputTokens / 1_000_000) * COST_PER_MILLION_INPUT_TOKENS +
      (outputTokens / 1_000_000) * COST_PER_MILLION_OUTPUT_TOKENS;

    console.log(
      `[scoring-model] provider=${provider} model=${model} | tokens: ${inputTokens}in / ${outputTokens}out | cost: $${costUsd.toFixed(4)}`
    );

    // ── Validate and sanitize scores ──────────────────────────────
    const result: ScoringResult = {
      overall_score: clamp(raw.overall_score ?? derivedOverall),
      accuracy_score: clamp(raw.accuracy_score ?? factualAccuracy),
      hallucination_score: clamp(raw.hallucination_score ?? groundedness),
      resolution_score: clamp(
        raw.resolution_score ??
          (instructionFollowing * 0.35 + completeness * 0.3 + helpfulness * 0.35)
      ),
      tone_score: clamp(raw.tone_score),
      sentiment_score: clamp(raw.sentiment_score),
      edge_case_score: clamp(raw.edge_case_score, 0.8),   // default neutral if missing
      escalation_score: clamp(raw.escalation_score, 0.85), // default neutral if no escalation
      claim_analysis: Array.isArray(raw.claim_analysis)
        ? raw.claim_analysis
        : Array.isArray(raw.claim_checks)
          ? raw.claim_checks.map((item: Record<string, unknown>) => ({
              claim: String(item.claim || ""),
              verdict: String(item.status || "unverifiable"),
              evidence: typeof item.evidence === "string" ? item.evidence : undefined,
            }))
          : [],
      flags: Array.isArray(raw.flags) ? raw.flags : [],
      summary: typeof raw.summary === "string" ? raw.summary : "Evaluation complete.",
      prompt_improvements: Array.isArray(raw.prompt_improvements) ? raw.prompt_improvements : [],
      knowledge_gaps: Array.isArray(raw.knowledge_gaps) ? raw.knowledge_gaps : [],
      rubric_scores: Object.fromEntries(
        Object.entries(rubricScores).map(([key, value]) => [
          key,
          {
            score: normalizeFivePointScore(value?.score),
            rationale: typeof value?.rationale === "string" ? value.rationale : "",
          },
        ])
      ),
      hard_fail: Boolean(raw.hard_fail),
      overall_decision:
        raw.overall_decision === "pass" || raw.overall_decision === "borderline" || raw.overall_decision === "fail"
          ? raw.overall_decision
          : undefined,
      _meta: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: costUsd,
        model: `${provider}:${model}`,
      },
    };

    return applyScoringGuardrails(input, result);
  } catch (error) {
    console.error("[scoring-model] Evaluation failed:", error);
    return applyScoringGuardrails(input, buildDeterministicFallbackScore(input, "model_error"));
  }
}

// Backward-compatible alias (previously exported as scoreConversation)
export { evaluateWithClaude as scoreConversation };
