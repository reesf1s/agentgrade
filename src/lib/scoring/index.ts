/**
 * AgentGrade Scoring Pipeline
 *
 * Orchestrates the multi-pass evaluation:
 * Pass 1: Structural Analysis (local, zero API calls)
 * Pass 2: Deep Quality Evaluation (1 Claude API call)
 * Pass 3: Pattern Aggregation (local, zero API calls)
 */

export { analyzeStructure } from "./structural-analyzer";
export { scoreConversation } from "./claude-scorer";
export { detectPatterns, aggregatePromptImprovements, aggregateKnowledgeGaps } from "./pattern-detector";

import { analyzeStructure } from "./structural-analyzer";
import { scoreConversation } from "./claude-scorer";
import type { Message, QualityScore } from "@/lib/db/types";

interface ScorePipelineInput {
  messages: Message[];
  knowledgeBaseContext?: string[];
}

/**
 * Run the full scoring pipeline on a conversation.
 * Pass 1: Structural analysis (free)
 * Pass 2: Claude evaluation (1 API call)
 * Total: 1 API call per conversation
 */
export async function runScoringPipeline(
  input: ScorePipelineInput
): Promise<Omit<QualityScore, "id" | "conversation_id" | "scored_at">> {
  // Pass 1: Structural Analysis (zero API calls)
  const structuralMetrics = analyzeStructure(input.messages);

  // Pass 2: Deep Quality Evaluation (1 Claude API call)
  const scoringResult = await scoreConversation({
    messages: input.messages,
    structuralMetrics,
    knowledgeBaseContext: input.knowledgeBaseContext,
  });

  return {
    overall_score: scoringResult.overall_score,
    accuracy_score: scoringResult.accuracy_score,
    hallucination_score: scoringResult.hallucination_score,
    resolution_score: scoringResult.resolution_score,
    tone_score: scoringResult.tone_score,
    sentiment_score: scoringResult.sentiment_score,
    structural_metrics: structuralMetrics,
    claim_analysis: scoringResult.claim_analysis,
    flags: scoringResult.flags,
    summary: scoringResult.summary,
    prompt_improvements: scoringResult.prompt_improvements,
    knowledge_gaps: scoringResult.knowledge_gaps,
    scoring_model_version: "v1",
  };
}
