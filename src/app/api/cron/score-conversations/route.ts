import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { scoreConversation } from "@/lib/scoring";

const QUIET_PERIOD_MINUTES = 10;
const MAX_BATCH_SIZE = 20;

function isAuthorized(request: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    return { ok: false, status: 500, message: "CRON_SECRET is not configured" };
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${expectedSecret}`) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }

  return { ok: true as const };
}

function toTimestamp(value?: string | null): number {
  if (!value) return NaN;
  return new Date(value).getTime();
}

export async function GET(request: NextRequest) {
  const auth = isAuthorized(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const cutoffIso = new Date(Date.now() - QUIET_PERIOD_MINUTES * 60_000).toISOString();

  const { data: conversations, error: conversationsError } = await supabaseAdmin
    .from("conversations")
    .select("id, ended_at, created_at, message_count")
    .not("ended_at", "is", null)
    .lte("ended_at", cutoffIso)
    .order("ended_at", { ascending: true })
    .limit(MAX_BATCH_SIZE * 3);

  if (conversationsError) {
    console.error("[cron/score-conversations] failed to load conversations:", conversationsError);
    return NextResponse.json({ error: "Failed to load conversations" }, { status: 500 });
  }

  const conversationIds = (conversations || []).map((conversation) => conversation.id);
  if (conversationIds.length === 0) {
    return NextResponse.json({
      success: true,
      quiet_period_minutes: QUIET_PERIOD_MINUTES,
      queued: 0,
      scored: 0,
      skipped: 0,
    });
  }

  const [{ data: scores, error: scoresError }, { data: agentMessages, error: messagesError }] =
    await Promise.all([
      supabaseAdmin
        .from("quality_scores")
        .select("conversation_id, scored_at, structural_metrics")
        .in("conversation_id", conversationIds),
      supabaseAdmin
        .from("messages")
        .select("conversation_id, role")
        .in("conversation_id", conversationIds)
        .in("role", ["agent", "human_agent"]),
    ]);

  if (scoresError || messagesError) {
    console.error("[cron/score-conversations] failed to load score state:", scoresError || messagesError);
    return NextResponse.json({ error: "Failed to load scoring state" }, { status: 500 });
  }

  const scoreByConversation = new Map(
    (scores || []).map((score) => [score.conversation_id as string, score])
  );
  const scorableConversationIds = new Set(
    (agentMessages || []).map((message) => message.conversation_id as string)
  );

  const candidates = (conversations || [])
    .filter((conversation) => scorableConversationIds.has(conversation.id))
    .filter((conversation) => {
      const existingScore = scoreByConversation.get(conversation.id);
      if (!existingScore) return true;

      const latestConversationTimestamp =
        toTimestamp(conversation.ended_at) || toTimestamp(conversation.created_at);
      const scoredAt = toTimestamp(existingScore.scored_at as string | null | undefined);

      return Number.isNaN(scoredAt) || scoredAt + 500 < latestConversationTimestamp;
    })
    .slice(0, MAX_BATCH_SIZE);

  let scored = 0;
  const failures: Array<{ conversation_id: string; error: string }> = [];

  for (const conversation of candidates) {
    try {
      await scoreConversation(conversation.id);
      scored += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown scoring error";
      console.error(`[cron/score-conversations] failed for ${conversation.id}:`, error);
      failures.push({ conversation_id: conversation.id, error: message });
    }
  }

  return NextResponse.json({
    success: true,
    quiet_period_minutes: QUIET_PERIOD_MINUTES,
    queued: candidates.length,
    scored,
    skipped: conversationIds.length - candidates.length,
    failures,
  });
}
