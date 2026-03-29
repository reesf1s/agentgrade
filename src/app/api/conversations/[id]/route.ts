import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";
import { compactReplayArtifacts } from "@/lib/messages/transcript-normalizer";
import { isConversationExplicitlyIncomplete } from "@/lib/ingest/completion";
import type { PromptImprovement, QualityScore } from "@/lib/db/types";

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

    return NextResponse.json(
      {
        ...convRes.data,
        message_count: compactedMessages.length,
        messages: compactedMessages,
        quality_score: conversationIncomplete ? null : sanitizedQualityScore,
        score_status: conversationIncomplete
          ? "waiting_for_completion"
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
