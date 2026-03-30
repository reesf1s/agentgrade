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
const SCORING_SYSTEM_PROMPT = `You are AgentGrade's quality evaluation engine. Assess AI agent conversations rigorously but fairly. Base verdicts on transcript evidence.

You receive: (1) conversation transcript, (2) structural analysis, (3) optional knowledge base context.

## Core Evaluation Principles
- Infer user's actual intent; judge whether agent moved user toward a real outcome.
- Distinguish knowledge problems vs prompt problems vs missing tool/system access. Flag missing integrations explicitly.
- Operational claims (CRM, tickets, accounts, subscriptions) require tool/system evidence. Without it, prefer "unverifiable" over "verified".
- Separate helpfulness from grounding: a response can be useful but weakly evidenced. Keep resolution distinct from accuracy/hallucination.
- Unverifiable claims alone should NOT lower accuracy or hallucination scores. Reduce confidence and flag grounding risk instead, unless there is contradiction, fabrication, or internal inconsistency.
- For helpful-but-unverified answers: prefer mid/high hallucination scores with low confidence over treating as fabrication.
- Missing tool traces are a trust/observability issue, not automatic failure if the user received a coherent, useful answer.
- For advisory/analytical questions, reward concrete reasoning even without live source traces.
- Cite exact turn numbers in claim evidence and prompt improvement reasoning.
- Phrase prompt improvements as org-wide policy changes, not one-off fixes.
- Also evaluate against: instruction_following, factual_accuracy, groundedness, completeness, helpfulness, calibration, safety (1-5 rubric each).
- hard_fail=true ONLY for: dangerous factual errors, fabricated citations, major instruction misses, severe hallucination as fact, or policy/safety violations.
- Summary: lead with answer quality judgment, mention uncertainty briefly as qualifier.

## Scoring Rubric (0.0–1.0)
- accuracy_score: 1.0=all claims correct/verifiable, 0.7-0.9=mostly correct, 0.4-0.6=mixed, 0.0-0.3=majority wrong/fabricated
- hallucination_score (higher=better): 1.0=zero fabrication, 0.7-0.9=minor embellishments, 0.4-0.6=some fabricated claims, 0.0-0.3=significant fabrication
- resolution_score: 1.0=fully solved, 0.7-0.9=mostly resolved, 0.4-0.6=acknowledged not resolved, 0.0-0.3=ignored/wrong solution
- tone_score: 1.0=professional/empathetic, 0.7-0.9=good with isolated lapses, 0.4-0.6=robotic/dismissive, 0.0-0.3=rude/condescending
- sentiment_score (satisfaction): 1.0=clearly satisfied, 0.7-0.9=content, 0.4-0.6=neutral/unclear, 0.0-0.3=frustrated/dissatisfied
- edge_case_score: 1.0=expertly handled, 0.4-0.6=poorly managed, 0.0-0.3=failed. Default 0.8 if no edge cases.
- escalation_score: 1.0=perfect handoff, 0.4-0.6=poor timing/cold handoff, 0.0-0.3=missed. Default 0.85 if no escalation needed.
- overall_score: weighted composite — accuracy(0.20)+hallucination(0.25)+resolution(0.25)+tone(0.15)+sentiment(0.10)+edge_case(0.03)+escalation(0.02)

## Claim Analysis
Verdict per claim: verified | unverifiable | contradicted | fabricated
Severity per claim: low (minor) | medium (meaningful impact) | high (wrong pricing/policy) | critical (legal/financial/safety)

## Prompt Improvements
For each quality issue, give SPECIFIC prompt text to add/modify. Include: intent clarification, anti-hallucination rules, escalation triggers, tool usage rules, missing integrations, when to admit lack of access.

## Knowledge Gaps
Identify missing KB topics. For missing operational capabilities, describe the workflow/integration/tool requirement in suggested_content.

Return ONLY valid JSON. No markdown fences, no explanation text outside the JSON.`;

// ─── Output Schema (shown to the judge model as template) ──────────
const SCORING_OUTPUT_SCHEMA = `{
  "overall_score": <0-1>, "accuracy_score": <0-1>, "hallucination_score": <0-1>,
  "resolution_score": <0-1>, "tone_score": <0-1>, "sentiment_score": <0-1>,
  "edge_case_score": <0-1>, "escalation_score": <0-1>,
  "claim_analysis": [{"claim":"<text>","verdict":"verified|unverifiable|contradicted|fabricated","evidence":"<cite turns/KB>","kb_source":"<doc or null>","severity":"low|medium|high|critical"}],
  "flags": ["<e.g. fabricated_pricing, missed_escalation>"],
  "summary": "<2-3 sentence quality judgment, lead with assessment not uncertainty>",
  "prompt_improvements": [{"issue":"<problem>","current_behavior":"<what agent did>","recommended_prompt_change":"<exact text>","expected_impact":"<improvement>","priority":"high|medium|low"}],
  "knowledge_gaps": [{"topic":"<name>","description":"<missing info>","affected_conversations":1,"suggested_content":"<draft KB content>"}],
  "rubric_scores": {"instruction_following":{"score":<1-5>,"rationale":""},"factual_accuracy":{"score":<1-5>,"rationale":""},"groundedness":{"score":<1-5>,"rationale":""},"completeness":{"score":<1-5>,"rationale":""},"helpfulness":{"score":<1-5>,"rationale":""},"calibration":{"score":<1-5>,"rationale":""},"safety":{"score":<1-5>,"rationale":""}},
  "hard_fail": <boolean>, "overall_decision": "pass|borderline|fail"
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

function resolveDimensionScore(rawValue: unknown, rubricValue: number, fallback = 0.6): number {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return clamp(rubricValue, fallback);
  }

  const raw = clamp(rawValue, fallback);
  const gap = Math.abs(raw - rubricValue);

  if (gap <= 0.15) {
    return clamp((raw + rubricValue) / 2, fallback);
  }

  if (gap >= 0.45) {
    return clamp(rubricValue, fallback);
  }

  return clamp(rubricValue * 0.7 + raw * 0.3, fallback);
}

// ─── Main Evaluation Function ───────────────────────────────────────
/**
 * Calls the configured model to evaluate a conversation across all quality dimensions.
 * Returns structured scoring result. One API call per conversation.
 */
export async function evaluateWithJudge(input: ScoringInput): Promise<ScoringResult> {
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
    userMessage += `## Knowledge Base Context\nNone provided. Use transcript evidence and internal consistency to judge grounding. Missing knowledge base context should lower confidence, but it should not automatically be treated as hallucination unless claims are clearly contradictory, fabricated, or implausibly specific.\n\n`;
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
    const resolvedAccuracy = resolveDimensionScore(raw.accuracy_score, factualAccuracy, 0.6);
    const resolvedGroundedness = resolveDimensionScore(raw.hallucination_score, groundedness, 0.6);
    const resolvedOverall = resolveDimensionScore(raw.overall_score, derivedOverall, 0.62);

    const result: ScoringResult = {
      overall_score: resolvedOverall,
      accuracy_score: resolvedAccuracy,
      hallucination_score: resolvedGroundedness,
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
export { evaluateWithJudge as scoreConversation };
