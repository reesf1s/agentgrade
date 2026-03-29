import type { FailurePattern, OrgRecommendation, QualityScore } from "@/lib/db/types";
import { isGroundingRiskOnlyScore } from "@/lib/scoring/quality-score-status";

interface ConversationWithScore {
  id: string;
  quality_score: QualityScore;
}

function priorityRank(priority: OrgRecommendation["priority"]): number {
  switch (priority) {
    case "high":
      return 3;
    case "medium":
      return 2;
    default:
      return 1;
  }
}

function buildRecommendation(
  key: string,
  partial: Omit<OrgRecommendation, "id" | "occurrence_count" | "affected_conversation_ids">
) {
  return {
    key,
    recommendation: partial,
    occurrence_count: 0,
    affected_conversation_ids: new Set<string>(),
  };
}

export function buildOrgRecommendations(
  conversations: ConversationWithScore[],
  patterns: FailurePattern[] = []
): OrgRecommendation[] {
  const aggregates = new Map<
    string,
    {
      key: string;
      recommendation: Omit<OrgRecommendation, "id" | "occurrence_count" | "affected_conversation_ids">;
      occurrence_count: number;
      affected_conversation_ids: Set<string>;
    }
  >();

  const addRecommendation = (
    key: string,
    conversationId: string,
    partial: Omit<OrgRecommendation, "id" | "occurrence_count" | "affected_conversation_ids">
  ) => {
    if (!aggregates.has(key)) {
      aggregates.set(key, buildRecommendation(key, partial));
    }

    const current = aggregates.get(key)!;
    current.occurrence_count += 1;
    current.affected_conversation_ids.add(conversationId);
  };

  for (const conversation of conversations) {
    const score = conversation.quality_score;
    if (isGroundingRiskOnlyScore(score) && score.confidence_level === "low") {
      continue;
    }
    const flags = score.flags || [];
    const promptSignals = (score.prompt_improvements || []).map((improvement) =>
      `${improvement.issue} ${improvement.recommended_prompt_change}`.toLowerCase()
    );
    const gapSignals = (score.knowledge_gaps || []).map((gap) =>
      `${gap.topic} ${gap.description} ${gap.suggested_content}`.toLowerCase()
    );
    const combinedSignals = [...promptSignals, ...gapSignals, ...flags.map((flag) => flag.toLowerCase())].join(" ");

    if (
      flags.includes("tool_backed_claim_without_evidence") ||
      /crm|deal|ticket|account|subscription|lookup|tool verification|pipeline/.test(combinedSignals)
    ) {
      addRecommendation("tool-verification-policy", conversation.id, {
        title: "Require live lookup evidence before record-specific claims",
        category: "tooling_policy",
        priority: "high",
        rationale:
          "Multiple conversations show the agent stating CRM or account facts without clear tool evidence in the transcript, which creates hallucination risk.",
        recommended_change:
          "Roll out an org-wide prompt policy: any claim about deals, accounts, tickets, orders, or subscriptions must be grounded in a live tool lookup. If the tool cannot be used, the agent must say it cannot verify the record state yet.",
        expected_impact:
          "Cuts repeated operational hallucinations and makes account-specific answers auditable across the org.",
      });
    }

    if (
      flags.includes("integration_missing_tool_trace") ||
      /tool trace|tool result|lookup evidence|grounding|transcript omitted/.test(combinedSignals)
    ) {
      addRecommendation("integration-instrumentation-policy", conversation.id, {
        title: "Send tool traces into AgentGrade for trustworthy evaluations",
        category: "tooling_policy",
        priority: "high",
        rationale:
          "Several conversations appear helpful but cannot be verified properly because the ingest payload includes the final answer without the underlying tool or retrieval evidence.",
        recommended_change:
          "Update every client integration to send tool messages or lookup metadata alongside assistant responses. Include the tool name, high-level result, and any record identifiers needed to explain how the answer was grounded.",
        expected_impact:
          "Improves scoring accuracy, reduces false hallucination alarms, and gives the org clearer evidence for recurring workflow issues.",
      });
    }

    if (
      flags.includes("action_request_stalled_after_clarification") ||
      /clarifying question|keep the request moving|next action|unresolved/.test(combinedSignals)
    ) {
      addRecommendation("action-progression-policy", conversation.id, {
        title: "Keep action-oriented requests moving after clarification",
        category: "resolution_policy",
        priority: "medium",
        rationale:
          "Several conversations are slowing down on clarification instead of taking or clearly teeing up the next action for the customer.",
        recommended_change:
          "Add a shared prompt rule that action requests should end with an explicit next step: either execute the action, confirm what will happen next, or escalate with context if execution is blocked.",
        expected_impact:
          "Improves resolution rates and reduces conversations that end in limbo after a clarifying question.",
      });
    }

    if (
      flags.includes("limited_grounding_context") ||
      /knowledge base|missing workflow|policy|help center|documentation/.test(combinedSignals)
    ) {
      addRecommendation("grounding-coverage-policy", conversation.id, {
        title: "Expand authoritative grounding for recurring support topics",
        category: "knowledge_policy",
        priority: "medium",
        rationale:
          "Recurring weak spots are appearing where the agent lacks authoritative policy or workflow context to ground its answers.",
        recommended_change:
          "Add or sync documentation for the most repeated weak topics, and make the agent prefer grounded answers over plausible guesses whenever KB coverage is thin.",
        expected_impact:
          "Raises accuracy and confidence while reducing unverifiable answers across the workspace.",
      });
    }
  }

  for (const pattern of patterns) {
    const signal = `${pattern.title} ${pattern.description} ${pattern.recommendation || ""} ${pattern.prompt_fix || ""} ${pattern.knowledge_base_suggestion || ""}`.toLowerCase();

    if (/hallucination|fabricated|lookup|crm|deal|account|ticket/.test(signal)) {
      addRecommendation("tool-verification-policy", pattern.id, {
        title: "Require live lookup evidence before record-specific claims",
        category: "tooling_policy",
        priority: "high",
        rationale:
          "Pattern analysis shows a repeatable operational truthfulness issue rather than a one-off bad answer.",
        recommended_change:
          "Adopt a single organization-wide tool verification policy and include it in the shared system prompt for every support agent.",
        expected_impact:
          "Eliminates the same class of hallucination across multiple conversations instead of patching them one by one.",
      });
    }

    if (/resolution|unresolved|clarif|next step/.test(signal)) {
      addRecommendation("action-progression-policy", pattern.id, {
        title: "Keep action-oriented requests moving after clarification",
        category: "resolution_policy",
        priority: "medium",
        rationale:
          "Patterns indicate that operational requests are repeatedly stalling before execution or clear handoff.",
        recommended_change:
          "Update shared prompt guidance so action requests always move toward execution, confirmation, or escalation with context.",
        expected_impact:
          "Improves consistency and throughput on create, update, cancel, and similar workflow requests.",
      });
    }
  }

  return [...aggregates.values()]
    .sort((left, right) => {
      const priorityDelta =
        priorityRank(right.recommendation.priority) - priorityRank(left.recommendation.priority);
      if (priorityDelta !== 0) return priorityDelta;
      return right.occurrence_count - left.occurrence_count;
    })
    .slice(0, 5)
    .map((item) => ({
      id: item.key,
      ...item.recommendation,
      occurrence_count: item.occurrence_count,
      affected_conversation_ids: [...item.affected_conversation_ids],
    }));
}
