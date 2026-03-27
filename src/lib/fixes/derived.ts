import type { FailurePattern, SuggestedFix } from "@/lib/db/types";

export function classifyInterventionType(pattern: {
  pattern_type?: string;
  title?: string;
  description?: string;
  prompt_fix?: string | null;
  knowledge_base_suggestion?: string | null;
  recommendation?: string | null;
}): SuggestedFix["intervention_type"] {
  const signal = [
    pattern.pattern_type,
    pattern.title,
    pattern.description,
    pattern.recommendation,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (pattern.knowledge_base_suggestion) {
    return "knowledge_fix";
  }

  if (signal.includes("escalat")) {
    return "escalation_policy_fix";
  }

  if (signal.includes("coverage") || signal.includes("missing topic") || signal.includes("topic cluster")) {
    return "coverage_gap";
  }

  if (pattern.prompt_fix || signal.includes("prompt") || signal.includes("retrieval")) {
    return "retrieval_or_prompt_fix";
  }

  return "manual_review_required";
}

export function buildDerivedFixFromPattern(
  pattern: FailurePattern,
  workspaceId: string
): SuggestedFix {
  const interventionType = classifyInterventionType(pattern);
  const recommendedChange =
    pattern.prompt_fix ||
    pattern.knowledge_base_suggestion ||
    pattern.recommendation ||
    "Manual review required to determine the right remediation.";

  return {
    id: `pattern-${pattern.id}`,
    workspace_id: workspaceId,
    pattern_id: pattern.id,
    fix_type:
      interventionType === "knowledge_fix" || interventionType === "coverage_gap"
        ? "knowledge_gap"
        : "prompt_improvement",
    intervention_type: interventionType,
    title: pattern.title,
    description: pattern.description,
    current_behavior: pattern.description,
    recommended_change: recommendedChange,
    expected_impact: pattern.recommendation || undefined,
    priority:
      pattern.severity === "critical" || pattern.severity === "high"
        ? "high"
        : pattern.severity === "medium"
          ? "medium"
          : "low",
    source_conversation_ids: pattern.affected_conversation_ids || [],
    occurrence_count: pattern.affected_conversation_ids?.length || 0,
    status: "draft",
    created_at: pattern.detected_at,
    updated_at: pattern.detected_at,
  };
}
