import type { FailurePattern, QualityScore } from "@/lib/db/types";

type ScoreLike = {
  overall_score?: number;
  flags?: string[] | null;
  claim_analysis?: QualityScore["claim_analysis"];
};

function normalizedFlags(score?: ScoreLike | null): string[] {
  return Array.isArray(score?.flags) ? score!.flags as string[] : [];
}

export function isScoringErrorScore(score?: ScoreLike | null): boolean {
  return normalizedFlags(score).includes("scoring_error");
}

export function isAnalyticsEligibleScore(score?: ScoreLike | null): boolean {
  if (!score) return false;
  if (typeof score.overall_score !== "number") return false;
  if (isScoringErrorScore(score)) return false;
  return true;
}

export function isGroundingRiskOnlyScore(score?: ScoreLike | null): boolean {
  if (!score) return false;
  const flags = normalizedFlags(score);
  const claimAnalysis = Array.isArray(score.claim_analysis) ? score.claim_analysis : [];
  const hasFabricatedOrContradicted = claimAnalysis.some(
    (claim) => claim.verdict === "fabricated" || claim.verdict === "contradicted"
  );

  if (hasFabricatedOrContradicted) return false;

  const groundingFlags = flags.filter((flag) =>
    /(grounding|tool_backed|verification|trace|ungrounded|unverified|limited_grounding_context|limited_transcript_grounding)/i.test(flag)
  );

  return groundingFlags.length > 0;
}

export async function filterPatternsWithUsableScores(
  patterns: FailurePattern[],
  loadScores: (conversationIds: string[]) => Promise<Map<string, boolean>>
): Promise<FailurePattern[]> {
  const affectedConversationIds = [...new Set(
    patterns.flatMap((pattern) => pattern.affected_conversation_ids || [])
  )];

  if (affectedConversationIds.length === 0) {
    return patterns;
  }

  const usabilityMap = await loadScores(affectedConversationIds);

  return patterns.filter((pattern) => {
    if (!pattern.affected_conversation_ids || pattern.affected_conversation_ids.length === 0) {
      return true;
    }

    const usableCount = pattern.affected_conversation_ids.filter(
      (conversationId) => usabilityMap.get(conversationId)
    ).length;

    return usableCount >= 2;
  });
}
