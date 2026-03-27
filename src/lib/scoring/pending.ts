import { supabaseAdmin } from "@/lib/supabase";
import { isConversationExplicitlyIncomplete } from "@/lib/ingest/completion";
import { scoreConversation } from "@/lib/scoring";

const QUIET_PERIOD_MS = 10 * 60 * 1000;
const MAX_PENDING_SCORE_BATCH = 10;

function toTimestamp(value?: string | null): number {
  if (!value) return NaN;
  return new Date(value).getTime();
}

export function hasQuietPeriodElapsed(
  conversation: { ended_at?: string | null; created_at?: string | null; metadata?: Record<string, unknown> | null }
): boolean {
  if (isConversationExplicitlyIncomplete(conversation.metadata || null)) {
    return false;
  }

  const referenceTime =
    toTimestamp(conversation.ended_at) || toTimestamp(conversation.created_at);

  if (Number.isNaN(referenceTime)) return false;
  return Date.now() - referenceTime >= QUIET_PERIOD_MS;
}

export function needsFreshScore(
  conversation: { ended_at?: string | null; created_at?: string | null },
  qualityScore?: { scored_at?: string | null } | null
): boolean {
  if (!qualityScore?.scored_at) return true;

  const conversationTimestamp =
    toTimestamp(conversation.ended_at) || toTimestamp(conversation.created_at);
  const scoredAt = toTimestamp(qualityScore.scored_at);

  if (Number.isNaN(conversationTimestamp) || Number.isNaN(scoredAt)) {
    return true;
  }

  return scoredAt + 500 < conversationTimestamp;
}

export async function queueEligibleConversationScores(workspaceId: string) {
  const { data: conversations, error } = await supabaseAdmin
    .from("conversations")
    .select("id, ended_at, created_at, metadata, quality_scores:quality_scores(scored_at), messages:messages!inner(role)")
    .eq("workspace_id", workspaceId)
    .in("messages.role", ["agent", "human_agent"])
    .order("ended_at", { ascending: false, nullsFirst: false })
    .limit(MAX_PENDING_SCORE_BATCH);

  if (error) {
    console.error("[pending-scoring] failed to load candidate conversations:", error);
    return;
  }

  const candidates = (conversations || []).filter((conversation) => {
    const qualityScore = Array.isArray(conversation.quality_scores)
      ? conversation.quality_scores[0] || null
      : conversation.quality_scores;

    return hasQuietPeriodElapsed(conversation) && needsFreshScore(conversation, qualityScore);
  });

  for (const conversation of candidates) {
    try {
      await scoreConversation(conversation.id as string);
    } catch (scoreError) {
      console.error(`[pending-scoring] failed for conversation ${conversation.id}:`, scoreError);
    }
  }
}
