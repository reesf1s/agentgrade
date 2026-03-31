import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";
import { compactReplayArtifacts } from "@/lib/messages/transcript-normalizer";
import { isConversationExplicitlyIncomplete } from "@/lib/ingest/completion";
import type { PromptImprovement, QualityScore } from "@/lib/db/types";
import {
  isQueueWorkflowState,
  isReviewDisposition,
  type QueueWorkflowState,
  type ReviewDisposition,
} from "@/lib/review-workflow";

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

/**
 * PATCH /api/conversations/:id
 * Persists lightweight workflow state into conversation metadata.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = (await request.json()) as {
      disposition?: ReviewDisposition;
      queue_state?: QueueWorkflowState;
    };
    const disposition = body.disposition;
    const queueState = body.queue_state;

    if (disposition !== undefined && !isReviewDisposition(disposition)) {
      return NextResponse.json({ error: "Invalid disposition" }, { status: 400 });
    }

    if (queueState !== undefined && !isQueueWorkflowState(queueState)) {
      return NextResponse.json({ error: "Invalid queue state" }, { status: 400 });
    }

    if (disposition === undefined && queueState === undefined) {
      return NextResponse.json({ error: "No workflow update provided" }, { status: 400 });
    }

    const { data: conversation, error: fetchError } = await supabaseAdmin
      .from("conversations")
      .select("id, metadata")
      .eq("id", id)
      .eq("workspace_id", ctx.workspace.id)
      .single();

    if (fetchError || !conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const currentMetadata = (conversation.metadata as Record<string, unknown> | null) || {};
    const currentWorkflow =
      currentMetadata.review_workflow && typeof currentMetadata.review_workflow === "object"
        ? (currentMetadata.review_workflow as Record<string, unknown>)
        : {};

    const nextMetadata = {
      ...currentMetadata,
      review_workflow: {
        ...currentWorkflow,
        ...(disposition ? { disposition } : {}),
        ...(queueState ? { queue_state: queueState } : {}),
        updated_at: new Date().toISOString(),
      },
    };

    const updatePayload: Record<string, unknown> = {
      metadata: nextMetadata,
    };

    if (disposition === "escalate_issue" || queueState === "escalated") {
      updatePayload.was_escalated = true;
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("conversations")
      .update(updatePayload)
      .eq("id", id)
      .eq("workspace_id", ctx.workspace.id)
      .select("id, metadata, was_escalated")
      .single();

    if (updateError || !updated) {
      console.error("Conversation workflow update failed:", updateError);
      return NextResponse.json({ error: "Failed to update review state" }, { status: 500 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Conversation workflow PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
