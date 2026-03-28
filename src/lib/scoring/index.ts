/**
 * AgentGrade Scoring Pipeline Orchestrator
 *
 * Main entry point: scoreConversation(conversationId)
 *
 * Orchestrates the 3-pass evaluation pipeline:
 *   Pass 1: Structural Analysis  — local, zero API calls
 *   Pass 2: LLM Evaluation       — 1 model API call, all dimensions at once
 *   Pass 3: Pattern Detection    — local, runs after scoring is persisted
 *
 * Also handles:
 *   - KB context retrieval via pgvector semantic search
 *   - Persisting results to quality_scores table
 *   - Alert threshold checking post-scoring
 *   - Async pattern detection trigger
 */

import { analyzeStructure } from "./structural-analyzer";
import { evaluateWithJudge } from "./judge-scorer";
import { detectPatterns } from "./pattern-detector";
import { searchKnowledgeBase } from "@/lib/knowledge-base";
import { checkThresholds } from "@/lib/alerts";
import { supabaseAdmin } from "@/lib/supabase";
import type { Message, QualityScore } from "@/lib/db/types";
import { compactReplayArtifacts } from "@/lib/messages/transcript-normalizer";
import { SCORING_MODEL_VERSION } from "./version";
import { isManualCalibrationConversation } from "@/lib/calibration";
import { applyLearnedCalibration } from "./calibration-model";
import { buildDeterministicFallbackScore } from "./fallback";

function isLegacyQualityScoresColumnError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  if (error.code === "42703" || error.code === "PGRST204") return true;
  return typeof error.message === "string" && error.message.includes("quality_scores");
}

// Re-export individual passes for direct use by API routes
export { analyzeStructure } from "./structural-analyzer";
export { evaluateWithJudge, scoreConversation as evaluateMessages } from "./judge-scorer";
export { detectPatterns, aggregatePromptImprovements, aggregateKnowledgeGaps } from "./pattern-detector";

function shouldUseDeterministicPass(messages: Message[]) {
  const agentTurns = messages.filter((message) => message.role === "agent");
  if (agentTurns.length === 0) return true;

  const totalWords = agentTurns.reduce(
    (count, message) => count + message.content.trim().split(/\s+/).filter(Boolean).length,
    0
  );

  return messages.length <= 2 && totalWords <= 18;
}

// ─── Stateless Pipeline (backward compatible) ───────────────────────
/**
 * Runs the scoring pipeline on an in-memory message array.
 * Does NOT touch the database. Used by the manual score API and tests.
 *
 * For the full DB-integrated flow, use scoreConversation(conversationId).
 */
export interface ScorePipelineInput {
  messages: Message[];
  knowledgeBaseContext?: string[];
  workspaceId?: string;
}

export async function runScoringPipeline(
  input: ScorePipelineInput
): Promise<Omit<QualityScore, "id" | "conversation_id" | "scored_at">> {
  const compactMessages = compactReplayArtifacts(input.messages);
  // Pass 1: Structural Analysis (zero API calls)
  const structuralMetrics = analyzeStructure(compactMessages);

  // Pass 2: Model Evaluation (1 API call)
  const evaluationResult = shouldUseDeterministicPass(compactMessages)
    ? buildDeterministicFallbackScore(
        {
          messages: compactMessages,
          structuralMetrics,
          knowledgeBaseContext: input.knowledgeBaseContext,
        },
        "low_complexity_fast_path"
      )
    : await evaluateWithJudge({
        messages: compactMessages,
        structuralMetrics,
        knowledgeBaseContext: input.knowledgeBaseContext,
      });

  let adjustedScores = {
    overall_score: evaluationResult.overall_score,
    accuracy_score: evaluationResult.accuracy_score,
    hallucination_score: evaluationResult.hallucination_score,
    resolution_score: evaluationResult.resolution_score,
    tone_score: evaluationResult.tone_score,
    sentiment_score: evaluationResult.sentiment_score,
    escalation_score: evaluationResult.escalation_score,
  };

  let learnedCalibrationInfo: Record<string, unknown> | undefined;

  if (input.workspaceId) {
    const calibration = await applyLearnedCalibration(input.workspaceId, {
      overall_score: evaluationResult.overall_score,
      accuracy_score: evaluationResult.accuracy_score,
      hallucination_score: evaluationResult.hallucination_score,
      resolution_score: evaluationResult.resolution_score,
      tone_score: evaluationResult.tone_score,
      sentiment_score: evaluationResult.sentiment_score,
      edge_case_score: evaluationResult.edge_case_score,
      escalation_score: evaluationResult.escalation_score,
      claim_analysis: evaluationResult.claim_analysis,
      flags: evaluationResult.flags,
      prompt_improvements: evaluationResult.prompt_improvements,
      knowledge_gaps: evaluationResult.knowledge_gaps,
      confidence_level: evaluationResult.confidence_level,
      structural_metrics: structuralMetrics,
    });

    adjustedScores = calibration.adjusted;
    learnedCalibrationInfo = calibration.metadata;
  }

  return {
    overall_score: adjustedScores.overall_score,
    accuracy_score: adjustedScores.accuracy_score,
    hallucination_score: adjustedScores.hallucination_score,
    resolution_score: adjustedScores.resolution_score,
    tone_score: adjustedScores.tone_score,
    sentiment_score: adjustedScores.sentiment_score,
    edge_case_score: evaluationResult.edge_case_score,
    escalation_score: adjustedScores.escalation_score,
    structural_metrics: {
      ...structuralMetrics,
      confidence_level: evaluationResult.confidence_level,
      evaluation_rubric: evaluationResult.rubric_scores,
      overall_decision: evaluationResult.overall_decision,
      hard_fail: evaluationResult.hard_fail,
      ...(learnedCalibrationInfo ? { learned_calibration: learnedCalibrationInfo } : {}),
    },
    claim_analysis: evaluationResult.claim_analysis,
    flags: evaluationResult.flags,
    summary: evaluationResult.summary,
    confidence_level: evaluationResult.confidence_level,
    prompt_improvements: evaluationResult.prompt_improvements,
    knowledge_gaps: evaluationResult.knowledge_gaps,
    scoring_model_version: SCORING_MODEL_VERSION,
  };
}

// ─── Full DB-Integrated Orchestrator ───────────────────────────────
/**
 * Main entry point for scoring a stored conversation.
 *
 * Loads the conversation from DB, runs all 3 passes, persists the score,
 * updates escalation status, checks alert thresholds, and refreshes
 * failure patterns.
 *
 * Returns the full score result and a flag indicating if scoring was partial
 * (i.e., the model API failed and defaults were used).
 */
export async function scoreConversation(conversationId: string): Promise<{
  score: Omit<QualityScore, "id" | "scored_at">;
  isPartial: boolean;
}> {
  // ── Load conversation + messages from DB ────────────────────────
  const [convResult, msgResult] = await Promise.all([
    supabaseAdmin
      .from("conversations")
      .select("*")
      .eq("id", conversationId)
      .single(),
    supabaseAdmin
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("timestamp", { ascending: true }),
  ]);

  if (convResult.error || !convResult.data) {
    throw new Error(
      `Conversation ${conversationId} not found: ${convResult.error?.message}`
    );
  }

  const conversation = convResult.data;
  const messages = compactReplayArtifacts((msgResult.data || []) as Message[]);
  const workspaceId = conversation.workspace_id as string;
  const isManualCalibration = isManualCalibrationConversation(
    (conversation.metadata as Record<string, unknown> | null) || null
  );

  if (messages.length === 0) {
    throw new Error(`Conversation ${conversationId} has no messages`);
  }

  // ── Pass 1: Structural Analysis (zero API calls) ────────────────
  const structuralMetrics = analyzeStructure(messages);

  // ── Fetch KB context via pgvector semantic search ───────────────
  // Build a topic query from the first few messages (captures the subject)
  const topicQuery = messages
    .slice(0, 6)
    .map((m) => m.content)
    .join(" ")
    .slice(0, 600); // keep the embedding query concise

  let knowledgeBaseContext: string[] = [];
  try {
    const kbItems = await searchKnowledgeBase(workspaceId, topicQuery, 5);
    knowledgeBaseContext = kbItems.map((item) => `[${item.title}]\n${item.content}`);

    if (kbItems.length > 0) {
      console.log(
        `[scoring] KB search returned ${kbItems.length} relevant docs for conversation ${conversationId}`
      );
    }
  } catch (e) {
    // KB search is optional — scoring degrades gracefully without it
    console.warn("[scoring] KB search failed, proceeding without context:", e);
  }

  // ── Pass 2: LLM Evaluation (1 API call) ─────────────────────────
  let evaluationResult;
  let isPartial = false;

  try {
    evaluationResult = shouldUseDeterministicPass(messages)
      ? buildDeterministicFallbackScore(
          {
            messages,
            structuralMetrics,
            knowledgeBaseContext,
          },
          "low_complexity_fast_path"
        )
      : await evaluateWithJudge({
          messages,
          structuralMetrics,
          knowledgeBaseContext,
        });
  } catch (e) {
    console.error(`[scoring] Model evaluation failed for ${conversationId}:`, e);
    isPartial = true;
    // Use conservative defaults — flag for manual review
    evaluationResult = {
      overall_score: 0.5,
      accuracy_score: 0.5,
      hallucination_score: 0.5,
      resolution_score: 0.5,
      tone_score: 0.5,
      sentiment_score: 0.5,
      edge_case_score: 0.8,
      escalation_score: 0.85,
      claim_analysis: [] as QualityScore["claim_analysis"],
      flags: ["scoring_error"] as string[],
      summary: "Automated scoring failed. Manual review recommended.",
      confidence_level: "low" as const,
      prompt_improvements: [] as QualityScore["prompt_improvements"],
      knowledge_gaps: [] as QualityScore["knowledge_gaps"],
    };
  }

  // ── Build the final score object ────────────────────────────────
  const scoreData: Omit<QualityScore, "id" | "scored_at"> = {
    conversation_id: conversationId,
    overall_score: evaluationResult.overall_score,
    accuracy_score: evaluationResult.accuracy_score,
    hallucination_score: evaluationResult.hallucination_score,
    resolution_score: evaluationResult.resolution_score,
    tone_score: evaluationResult.tone_score,
    sentiment_score: evaluationResult.sentiment_score,
    edge_case_score: evaluationResult.edge_case_score,
    escalation_score: evaluationResult.escalation_score,
    structural_metrics: {
      ...structuralMetrics,
      confidence_level: evaluationResult.confidence_level,
      evaluation_rubric: evaluationResult.rubric_scores,
      overall_decision: evaluationResult.overall_decision,
      hard_fail: evaluationResult.hard_fail,
    },
    claim_analysis: evaluationResult.claim_analysis,
    flags: evaluationResult.flags,
    summary: evaluationResult.summary,
    confidence_level: evaluationResult.confidence_level,
    prompt_improvements: evaluationResult.prompt_improvements,
    knowledge_gaps: evaluationResult.knowledge_gaps,
    scoring_model_version: SCORING_MODEL_VERSION,
  };

  const calibration = await applyLearnedCalibration(workspaceId, {
    overall_score: scoreData.overall_score,
    accuracy_score: scoreData.accuracy_score,
    hallucination_score: scoreData.hallucination_score,
    resolution_score: scoreData.resolution_score,
    tone_score: scoreData.tone_score,
    sentiment_score: scoreData.sentiment_score,
    edge_case_score: scoreData.edge_case_score,
    escalation_score: scoreData.escalation_score,
    claim_analysis: scoreData.claim_analysis,
    flags: scoreData.flags,
    prompt_improvements: scoreData.prompt_improvements,
    knowledge_gaps: scoreData.knowledge_gaps,
    confidence_level: scoreData.confidence_level,
    structural_metrics: scoreData.structural_metrics,
  });

  scoreData.overall_score = calibration.adjusted.overall_score;
  scoreData.accuracy_score = calibration.adjusted.accuracy_score;
  scoreData.hallucination_score = calibration.adjusted.hallucination_score;
  scoreData.resolution_score = calibration.adjusted.resolution_score;
  scoreData.tone_score = calibration.adjusted.tone_score;
  scoreData.sentiment_score = calibration.adjusted.sentiment_score;
  scoreData.escalation_score = calibration.adjusted.escalation_score;
  scoreData.structural_metrics = {
    ...scoreData.structural_metrics,
    learned_calibration: calibration.metadata,
  };

  // ── Persist score to DB ─────────────────────────────────────────
  const scoredAt = new Date().toISOString();
  const fullRecord = {
    ...scoreData,
    scored_at: scoredAt,
  };
  const legacyRecord = {
    conversation_id: conversationId,
    overall_score: scoreData.overall_score,
    accuracy_score: scoreData.accuracy_score,
    hallucination_score: scoreData.hallucination_score,
    resolution_score: scoreData.resolution_score,
    tone_score: scoreData.tone_score,
    sentiment_score: scoreData.sentiment_score,
    structural_metrics: {
      ...structuralMetrics,
      confidence_level: evaluationResult.confidence_level,
      learned_calibration: calibration.metadata,
    },
    claim_analysis: evaluationResult.claim_analysis,
    flags: evaluationResult.flags,
    summary: evaluationResult.summary,
    prompt_improvements: evaluationResult.prompt_improvements,
    knowledge_gaps: evaluationResult.knowledge_gaps,
    scoring_model_version: SCORING_MODEL_VERSION,
    scored_at: scoredAt,
  };

  let upsertError;

  // Upsert so re-scoring overwrites the previous result
  ({ error: upsertError } = await supabaseAdmin
    .from("quality_scores")
    .upsert(fullRecord, { onConflict: "conversation_id" }));

  if (isLegacyQualityScoresColumnError(upsertError)) {
    ({ error: upsertError } = await supabaseAdmin
      .from("quality_scores")
      .upsert(legacyRecord, { onConflict: "conversation_id" }));
  }

  if (upsertError) {
    // Log but don't throw — the score is computed and can still be returned
    console.error(`[scoring] Failed to persist score for ${conversationId}:`, upsertError);
  }

  // ── Update conversation escalation flag ─────────────────────────
  // Structural analysis determines escalation — sync it back to the conversation row
  if (structuralMetrics.escalation_turn !== undefined) {
    await supabaseAdmin
      .from("conversations")
      .update({ was_escalated: true })
      .eq("id", conversationId);
  }

  // ── Check alert thresholds ──────────────────────────────────────
  if (!isManualCalibration) {
    try {
      await checkThresholds(workspaceId, scoreData);
    } catch (e) {
      console.warn("[scoring] Alert threshold check failed:", e);
    }
  }

  // ── Pass 3: Pattern Detection ───────────────────────────────────
  if (!isManualCalibration) {
    try {
      await runPatternDetectionAsync(workspaceId);
    } catch (e) {
      console.warn("[scoring] Pattern detection failed:", e);
    }
  }

  console.log(
    `[scoring] Scored ${conversationId}: overall=${scoreData.overall_score.toFixed(2)} ` +
    `| hallucination=${scoreData.hallucination_score?.toFixed(2)} ` +
    `| resolution=${scoreData.resolution_score?.toFixed(2)} ` +
    `| partial=${isPartial}`
  );

  return { score: scoreData, isPartial };
}

// ─── Async Pattern Detection ────────────────────────────────────────
/**
 * Fetches recent scored conversations and runs pattern detection.
 * Stores newly detected patterns in failure_patterns table.
 * Called async after each conversation is scored — does not block scoring.
 */
async function runPatternDetectionAsync(workspaceId: string): Promise<void> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: convs } = await supabaseAdmin
    .from("conversations")
    .select("id, created_at, platform, quality_scores:quality_scores(*)")
    .eq("workspace_id", workspaceId)
    .gte("created_at", thirtyDaysAgo.toISOString())
    .not("quality_scores", "is", null)
    .order("created_at", { ascending: false })
    .limit(200); // cap to avoid processing huge datasets

  if (!convs || convs.length < 3) return; // not enough data for patterns

  // Shape into the format detectPatterns expects
  const scoredConversations = convs
    .filter((c) => c.quality_scores)
    .map((c) => {
      // Supabase returns quality_scores as nested object
      const qs = c.quality_scores as unknown as QualityScore;
      return {
        id: c.id as string,
        created_at: c.created_at as string,
        platform: c.platform as string,
        quality_score: qs,
      };
    });

  if (scoredConversations.length < 3) return;

  const newPatterns = detectPatterns(scoredConversations);

  // Persist each new pattern (skip if title already exists and is unresolved)
  for (const pattern of newPatterns) {
    const { data: existing } = await supabaseAdmin
      .from("failure_patterns")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("title", pattern.title)
      .eq("is_resolved", false)
      .maybeSingle();

    if (!existing) {
      await supabaseAdmin.from("failure_patterns").insert({
        workspace_id: workspaceId,
        pattern_type: pattern.pattern_type,
        title: pattern.title,
        description: pattern.description,
        affected_conversation_ids: pattern.affected_conversation_ids,
        severity: pattern.severity,
        recommendation: pattern.recommendation,
        prompt_fix: pattern.prompt_fix,
        knowledge_base_suggestion: pattern.knowledge_base_suggestion,
      });
    }
  }

  if (newPatterns.length > 0) {
    console.log(
      `[scoring] Pattern detection found ${newPatterns.length} new pattern(s) for workspace ${workspaceId}`
    );
  }
}
