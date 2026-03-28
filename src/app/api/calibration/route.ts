import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";
import { scoreConversation } from "@/lib/scoring";
import { CALIBRATION_DIMENSIONS, normalizeLabelScores, parseTranscriptText, SCORER_MODEL_INFO } from "@/lib/calibration";
import { SCORING_MODEL_VERSION } from "@/lib/scoring/version";

function originalScoreForDimension(
  qualityScore: Record<string, unknown>,
  dimension: string,
  fallback: number
) {
  const keyMap: Record<string, string> = {
    overall: "overall_score",
    accuracy: "accuracy_score",
    hallucination: "hallucination_score",
    resolution: "resolution_score",
    escalation: "escalation_score",
    tone: "tone_score",
    sentiment: "sentiment_score",
  };

  const mapped = keyMap[dimension];
  const raw = mapped ? qualityScore[mapped] : undefined;
  return typeof raw === "number" ? raw : fallback;
}

async function ensureQualityScore(conversationId: string) {
  const { data: existing } = await supabaseAdmin
    .from("quality_scores")
    .select("*")
    .eq("conversation_id", conversationId)
    .maybeSingle();

  if (existing) return existing;

  const { score } = await scoreConversation(conversationId);

  const { data: created } = await supabaseAdmin
    .from("quality_scores")
    .select("*")
    .eq("conversation_id", conversationId)
    .maybeSingle();

  return created || score;
}

export async function GET() {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [manualConversationsRes, overridesRes] = await Promise.all([
      supabaseAdmin
        .from("conversations")
        .select("id, customer_identifier, created_at, metadata")
        .eq("workspace_id", ctx.workspace.id)
        .order("created_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("quality_overrides")
        .select("id, quality_score_id, dimension, override_score, reason, overridden_by, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    const manualConversations = (manualConversationsRes.data || []).filter((conversation) =>
      Boolean((conversation.metadata as Record<string, unknown> | null)?.manual_calibration)
    );

    const qualityScoreIds = [...new Set((overridesRes.data || []).map((override) => override.quality_score_id))];
    const { data: qualityScores } = qualityScoreIds.length
      ? await supabaseAdmin
          .from("quality_scores")
          .select("id, conversation_id")
          .in("id", qualityScoreIds)
      : { data: [] as Array<{ id: string; conversation_id: string }> };

    const conversationIds = [...new Set((qualityScores || []).map((score) => score.conversation_id))];
    const { data: conversations } = conversationIds.length
      ? await supabaseAdmin
          .from("conversations")
          .select("id, workspace_id, customer_identifier, metadata, created_at")
          .in("id", conversationIds)
      : { data: [] as Array<{ id: string; workspace_id: string; customer_identifier?: string; metadata?: Record<string, unknown>; created_at: string }> };

    const qualityScoreMap = new Map((qualityScores || []).map((score) => [score.id, score.conversation_id]));
    const conversationMap = new Map(
      (conversations || [])
        .filter((conversation) => conversation.workspace_id === ctx.workspace.id)
        .map((conversation) => [conversation.id, conversation])
    );

    const recentLabels = (overridesRes.data || [])
      .map((override) => {
        const conversationId = qualityScoreMap.get(override.quality_score_id);
        const conversation = conversationId ? conversationMap.get(conversationId) : null;
        if (!conversation) return null;

        return {
          id: override.id,
          conversation_id: conversationId,
          customer_identifier: conversation.customer_identifier,
          dimension: override.dimension,
          override_score: override.override_score,
          reason: override.reason,
          created_at: override.created_at,
          source: (conversation.metadata as Record<string, unknown> | null)?.manual_calibration ? "pasted" : "existing",
        };
      })
      .filter(Boolean)
      .slice(0, 20);

    let repoEvalCaseCount = 0;
    try {
      const evalPath = path.join(process.cwd(), "evals", "scoring-golden.json");
      repoEvalCaseCount = JSON.parse(fs.readFileSync(evalPath, "utf8")).length;
    } catch {
      repoEvalCaseCount = 0;
    }

    return NextResponse.json({
      scorer: {
        ...SCORER_MODEL_INFO,
        scoring_model_version: SCORING_MODEL_VERSION,
        supported_dimensions: CALIBRATION_DIMENSIONS,
        repo_eval_cases: repoEvalCaseCount,
        labeled_examples: recentLabels.length,
        manual_calibration_conversations: manualConversations.length,
      },
      recent_labels: recentLabels,
      manual_examples: manualConversations.slice(0, 10),
    });
  } catch (error) {
    console.error("Calibration GET error:", error);
    return NextResponse.json({ error: "Failed to load calibration data" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const labels = normalizeLabelScores(body.labels || body);
    if (labels.length === 0) {
      return NextResponse.json({ error: "At least one labeled metric is required" }, { status: 400 });
    }

    let conversationId = body.conversation_id as string | null;

    if (conversationId) {
      const { data: conversation } = await supabaseAdmin
        .from("conversations")
        .select("id")
        .eq("id", conversationId)
        .eq("workspace_id", ctx.workspace.id)
        .maybeSingle();

      if (!conversation) {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
      }
    } else {
      const transcript = String(body.transcript || "").trim();
      const messages = parseTranscriptText(transcript);

      if (messages.length < 2) {
        return NextResponse.json(
          { error: "Transcript must include at least two labeled turns, such as 'Customer:' and 'AI Agent:'" },
          { status: 400 }
        );
      }

      const { data: createdConversation, error: conversationError } = await supabaseAdmin
        .from("conversations")
        .insert({
          workspace_id: ctx.workspace.id,
          platform: "custom",
          customer_identifier: body.title || "Manual calibration example",
          message_count: messages.length,
          was_escalated: messages.some((message) => message.role === "human_agent"),
          started_at: messages[0]?.timestamp,
          ended_at: messages[messages.length - 1]?.timestamp,
          metadata: {
            manual_calibration: true,
            calibration_title: body.title || null,
            calibration_notes: body.notes || null,
            calibration_source: "pasted_transcript",
          },
        })
        .select("id")
        .single();

      if (conversationError || !createdConversation) {
        return NextResponse.json({ error: "Failed to create calibration conversation" }, { status: 500 });
      }

      conversationId = createdConversation.id;

      const { error: messageError } = await supabaseAdmin.from("messages").insert(
        messages.map((message) => ({
          conversation_id: conversationId,
          ...message,
        }))
      );

      if (messageError) {
        return NextResponse.json({ error: "Failed to store calibration transcript" }, { status: 500 });
      }
    }

    const qualityScore = await ensureQualityScore(conversationId!);
    if (!qualityScore) {
      return NextResponse.json({ error: "Failed to score conversation before labeling" }, { status: 500 });
    }

    const rows = labels.map((label) => ({
      quality_score_id: qualityScore.id,
      dimension: label.dimension,
      original_score: originalScoreForDimension(qualityScore as Record<string, unknown>, label.dimension, label.score),
      override_score: label.score,
      reason: body.notes || body.reason || "Calibration label set",
      overridden_by: ctx.member.clerk_user_id,
    }));

    const { error: overrideError } = await supabaseAdmin.from("quality_overrides").insert(rows);
    if (overrideError) {
      console.error("Calibration override insert error:", overrideError);
      return NextResponse.json({ error: "Failed to save calibration labels" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      conversation_id: conversationId,
      label_count: rows.length,
      message: "Calibration labels saved.",
    });
  } catch (error) {
    console.error("Calibration POST error:", error);
    return NextResponse.json({ error: "Failed to save calibration labels" }, { status: 500 });
  }
}
