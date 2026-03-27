import { after, NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";
import { compactReplayArtifacts } from "@/lib/messages/transcript-normalizer";
import { scoreConversation } from "@/lib/scoring";
import { isConversationExplicitlyIncomplete } from "@/lib/ingest/completion";
import { hasQuietPeriodElapsed } from "@/lib/scoring/pending";
import type { PromptImprovement, QualityScore } from "@/lib/db/types";
import { SCORING_MODEL_VERSION } from "@/lib/scoring/version";

function sanitizeReplayArtifactSignals(
  qualityScore: (QualityScore & { flags?: string[]; prompt_improvements?: PromptImprovement[] }) | null,
  hadReplayArtifacts: boolean
) {
  if (!qualityScore || !hadReplayArtifacts) return qualityScore;

  const replayFlagPatterns = [
    /^duplicate_/i,
    /^repetitive_agent_behavior$/i,
  ];

  const promptImprovements = Array.isArray(qualityScore.prompt_improvements)
    ? qualityScore.prompt_improvements.filter((improvement: { issue?: string }) => {
        const issue = (improvement.issue || "").toLowerCase();
        return !issue.includes("duplicate") && !issue.includes("sent the same message twice");
      })
    : [];

  return {
    ...qualityScore,
    flags: Array.isArray(qualityScore.flags)
      ? qualityScore.flags.filter(
          (flag: string) => !replayFlagPatterns.some((pattern) => pattern.test(flag))
        )
      : [],
    prompt_improvements: promptImprovements,
  };
}

function getLatestMessageTimestamp(messages: Array<{ timestamp?: string }>): number | null {
  const timestamps = messages
    .map((message) => (message.timestamp ? new Date(message.timestamp).getTime() : NaN))
    .filter((value) => !Number.isNaN(value));

  if (timestamps.length === 0) return null;
  return Math.max(...timestamps);
}

function isStaleQualityScore(
  qualityScore: (QualityScore & { flags?: string[]; prompt_improvements?: PromptImprovement[] }) | null,
  messageCount: number,
  latestMessageTimestamp: number | null
): boolean {
  if (!qualityScore) return true;
  if ((qualityScore.flags || []).includes("scoring_error")) return true;
  if (qualityScore.scoring_model_version !== SCORING_MODEL_VERSION) return true;

  const scoredAt = qualityScore.scored_at ? new Date(qualityScore.scored_at).getTime() : NaN;
  const scoredTurnCount = qualityScore.structural_metrics?.turn_count;

  if (typeof scoredTurnCount === "number" && scoredTurnCount !== messageCount) {
    return true;
  }

  if (latestMessageTimestamp !== null && !Number.isNaN(scoredAt) && scoredAt + 500 < latestMessageTimestamp) {
    return true;
  }

  return false;
}

/**
 * GET /api/conversations/:id
 * Returns a single conversation with messages and quality score.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const [convRes, messagesRes, scoreRes] = await Promise.all([
      supabaseAdmin
        .from("conversations")
        .select("*")
        .eq("id", id)
        .eq("workspace_id", ctx.workspace.id)
        .single(),

      supabaseAdmin
        .from("messages")
        .select("*")
        .eq("conversation_id", id)
        .order("timestamp", { ascending: true }),

      supabaseAdmin
        .from("quality_scores")
        .select("*")
        .eq("conversation_id", id)
        .single(),
    ]);

    if (convRes.error || !convRes.data) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const rawMessages = messagesRes.data || [];
    const compactedMessages = compactReplayArtifacts(rawMessages);
    const hadReplayArtifacts = compactedMessages.length < rawMessages.length;
    const conversationIncomplete = isConversationExplicitlyIncomplete(
      (convRes.data.metadata as Record<string, unknown> | null) || null
    );
    const quietPeriodElapsed = hasQuietPeriodElapsed({
      ended_at: convRes.data.ended_at,
      created_at: convRes.data.created_at,
      metadata: (convRes.data.metadata as Record<string, unknown> | null) || null,
    });

    const qualityScore = scoreRes.data
      ? {
          ...scoreRes.data,
          confidence_level:
            scoreRes.data.confidence_level ||
            scoreRes.data.structural_metrics?.confidence_level ||
            undefined,
        }
      : null;
    const sanitizedQualityScore = sanitizeReplayArtifactSignals(qualityScore, hadReplayArtifacts);
    const latestMessageTimestamp = getLatestMessageTimestamp(compactedMessages);
    const scoreIsStale = conversationIncomplete
      ? false
      : isStaleQualityScore(sanitizedQualityScore, compactedMessages.length, latestMessageTimestamp);

    if (hadReplayArtifacts || (scoreIsStale && quietPeriodElapsed)) {
      after(async () => {
        try {
          await scoreConversation(id);
        } catch (error) {
          console.error(`Replay-artifact rescore failed for conversation ${id}:`, error);
        }
      });
    }

    return NextResponse.json(
      {
        ...convRes.data,
        message_count: compactedMessages.length,
        messages: compactedMessages,
        quality_score:
          conversationIncomplete || (scoreIsStale && quietPeriodElapsed) ? null : sanitizedQualityScore,
        score_status: conversationIncomplete
          ? "waiting_for_completion"
          : scoreIsStale && !quietPeriodElapsed
            ? "waiting_for_quiet_period"
          : scoreIsStale
            ? "refreshing"
            : sanitizedQualityScore
              ? "ready"
              : "pending",
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("Conversation detail API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
