/**
 * Pass 2: Deep Quality Evaluation — 1 Claude API call per conversation
 *
 * Single batched prompt evaluates ALL dimensions at once.
 * Returns structured JSON with scores, claim verdicts, and actionable
 * prompt improvement recommendations.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { Message, ClaimAnalysis, PromptImprovement, KnowledgeGap, StructuralMetrics } from "@/lib/db/types";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SCORING_SYSTEM_PROMPT = `You are AgentGrade's quality evaluation engine. You assess AI agent conversations with surgical precision.

You will receive:
1. A conversation transcript between an AI agent and a customer
2. Structural analysis data (turn counts, extracted claims, sentiment)
3. Relevant knowledge base context (if available)

You must evaluate the conversation across ALL dimensions in a SINGLE response. Be rigorous but fair.

## Scoring Rubric (0.0 to 1.0 scale)

### Accuracy (0-1)
- 1.0: Every factual claim is correct and verifiable
- 0.7-0.9: Mostly correct, minor inaccuracies
- 0.4-0.6: Mix of correct and incorrect information
- 0.0-0.3: Majority of claims are wrong

### Hallucination (0-1, where 1.0 = NO hallucinations)
- 1.0: Zero fabricated information
- 0.7-0.9: Minor embellishments but nothing dangerous
- 0.4-0.6: Some fabricated claims or policies
- 0.0-0.3: Significant fabrication of information

### Resolution (0-1)
- 1.0: Problem fully solved with correct action taken
- 0.7-0.9: Problem mostly solved, minor gaps
- 0.4-0.6: Problem acknowledged but not properly resolved
- 0.0-0.3: Problem not addressed or wrong solution given

### Tone (0-1)
- 1.0: Professional, empathetic, perfectly appropriate
- 0.7-0.9: Generally good tone with minor issues
- 0.4-0.6: Robotic, dismissive, or slightly inappropriate
- 0.0-0.3: Rude, condescending, or severely off-brand

### Sentiment Impact (0-1, where 1.0 = customer left satisfied)
- 1.0: Customer clearly satisfied, positive closing
- 0.7-0.9: Customer seems content
- 0.4-0.6: Customer neutral or unclear satisfaction
- 0.0-0.3: Customer left frustrated or angry

## Claim Analysis
For each extracted claim, determine:
- "verified": claim matches knowledge base / is clearly factual
- "unverifiable": cannot determine truth with available context
- "contradicted": claim conflicts with knowledge base
- "fabricated": claim is invented (no basis in reality or KB)

## Prompt Improvements
This is CRITICAL. For every issue you identify, recommend a SPECIFIC prompt improvement the customer should make to their AI agent's system prompt. Be concrete — give the actual text they should add/change.

## Knowledge Base Gaps
Identify topics where the agent struggled because information was missing from the knowledge base.

Return ONLY valid JSON matching the schema below. No markdown, no explanation.`;

const SCORING_OUTPUT_SCHEMA = `{
  "overall_score": <float 0-1>,
  "accuracy_score": <float 0-1>,
  "hallucination_score": <float 0-1>,
  "resolution_score": <float 0-1>,
  "tone_score": <float 0-1>,
  "sentiment_score": <float 0-1>,
  "claim_analysis": [
    {
      "claim": "<the agent's factual claim>",
      "verdict": "verified|unverifiable|contradicted|fabricated",
      "evidence": "<why this verdict>",
      "kb_source": "<which KB doc, if any>"
    }
  ],
  "flags": ["<flag1>", "<flag2>"],
  "summary": "<2-3 sentence quality summary>",
  "prompt_improvements": [
    {
      "issue": "<what went wrong>",
      "current_behavior": "<what the agent did>",
      "recommended_prompt_change": "<exact text to add to system prompt>",
      "expected_impact": "<what this fix would improve>",
      "priority": "high|medium|low"
    }
  ],
  "knowledge_gaps": [
    {
      "topic": "<topic name>",
      "description": "<what info is missing>",
      "affected_conversations": 1,
      "suggested_content": "<what to add to KB>"
    }
  ]
}`;

interface ScoringInput {
  messages: Message[];
  structuralMetrics: StructuralMetrics;
  knowledgeBaseContext?: string[];
}

interface ScoringResult {
  overall_score: number;
  accuracy_score: number;
  hallucination_score: number;
  resolution_score: number;
  tone_score: number;
  sentiment_score: number;
  claim_analysis: ClaimAnalysis[];
  flags: string[];
  summary: string;
  prompt_improvements: PromptImprovement[];
  knowledge_gaps: KnowledgeGap[];
}

export async function scoreConversation(input: ScoringInput): Promise<ScoringResult> {
  const { messages, structuralMetrics, knowledgeBaseContext } = input;

  // Format conversation transcript
  const transcript = messages
    .map((m) => `[${m.role.toUpperCase()}]: ${m.content}`)
    .join("\n\n");

  // Build the user message
  let userMessage = `## Conversation Transcript\n\n${transcript}\n\n`;

  userMessage += `## Structural Analysis\n`;
  userMessage += `- Turn count: ${structuralMetrics.turn_count}\n`;
  userMessage += `- Agent turns: ${structuralMetrics.agent_turns}\n`;
  userMessage += `- Customer turns: ${structuralMetrics.customer_turns}\n`;
  userMessage += `- Conversation type: ${structuralMetrics.conversation_type}\n`;
  userMessage += `- Escalation detected: ${structuralMetrics.escalation_turn !== undefined ? `Yes (turn ${structuralMetrics.escalation_turn})` : "No"}\n`;
  userMessage += `- Agent repetitions: ${structuralMetrics.repetition_count}\n`;
  userMessage += `- Extracted claims to verify: ${structuralMetrics.extracted_claims.length}\n\n`;

  if (structuralMetrics.extracted_claims.length > 0) {
    userMessage += `## Claims to Evaluate\n`;
    structuralMetrics.extracted_claims.forEach((claim, i) => {
      userMessage += `${i + 1}. "${claim}"\n`;
    });
    userMessage += "\n";
  }

  if (knowledgeBaseContext && knowledgeBaseContext.length > 0) {
    userMessage += `## Knowledge Base Context\n`;
    knowledgeBaseContext.forEach((chunk, i) => {
      userMessage += `[KB Doc ${i + 1}]: ${chunk}\n\n`;
    });
  } else {
    userMessage += `## Knowledge Base Context\nNo knowledge base provided. Score accuracy/hallucination based on general plausibility.\n\n`;
  }

  userMessage += `## Required Output Format\n${SCORING_OUTPUT_SCHEMA}\n\nReturn ONLY the JSON object. No other text.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: SCORING_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";

    // Parse JSON from response (handle potential markdown wrapping)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in scoring response");
    }

    const result = JSON.parse(jsonMatch[0]) as ScoringResult;

    // Validate score ranges
    const clamp = (v: number) => Math.max(0, Math.min(1, v));
    result.overall_score = clamp(result.overall_score);
    result.accuracy_score = clamp(result.accuracy_score);
    result.hallucination_score = clamp(result.hallucination_score);
    result.resolution_score = clamp(result.resolution_score);
    result.tone_score = clamp(result.tone_score);
    result.sentiment_score = clamp(result.sentiment_score);

    return result;
  } catch (error) {
    console.error("Scoring error:", error);
    // Return conservative default scores on error
    return {
      overall_score: 0.5,
      accuracy_score: 0.5,
      hallucination_score: 0.5,
      resolution_score: 0.5,
      tone_score: 0.5,
      sentiment_score: 0.5,
      claim_analysis: [],
      flags: ["scoring_error"],
      summary: "Scoring encountered an error. Manual review recommended.",
      prompt_improvements: [],
      knowledge_gaps: [],
    };
  }
}
