import { after, NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { scoreConversation } from "@/lib/scoring";
import { upsertConversationWithMessages } from "@/lib/ingest/upsert-conversation";
import { normalizeVoiceflowPayload } from "@/lib/integrations/voiceflow";

/**
 * Voiceflow-specific webhook ingest.
 * Uses the same Bearer secret model as the generic webhook, but accepts
 * Voiceflow-shaped payloads and normalizes them into the internal transcript model.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const webhookSecret = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;

    if (!webhookSecret) {
      return NextResponse.json(
        { error: "Authorization: Bearer <webhook_secret> header required" },
        { status: 401 }
      );
    }

    const { data: connections, error: connError } = await supabaseAdmin
      .from("agent_connections")
      .select("id, workspace_id, platform, is_active")
      .eq("webhook_secret", webhookSecret)
      .eq("platform", "voiceflow")
      .limit(1);

    const connection = connections?.[0] || null;

    if (connError || !connection) {
      return NextResponse.json({ error: "Invalid Voiceflow webhook secret" }, { status: 401 });
    }

    if (!connection.is_active) {
      return NextResponse.json({ error: "Agent connection is inactive" }, { status: 403 });
    }

    const body = await request.json();
    const normalized = normalizeVoiceflowPayload(body);

    if (!normalized) {
      return NextResponse.json(
        {
          error: "Could not normalize Voiceflow payload. Include a transcript/messages array with user and assistant turns.",
        },
        { status: 400 }
      );
    }

    const ingestionResult = await upsertConversationWithMessages(connection, {
      messages: normalized.messages,
      externalId: normalized.conversationId,
      platform: "voiceflow",
      customerIdentifier: normalized.customerIdentifier,
      metadata: normalized.metadata,
    });

    after(async () => {
      try {
        await scoreConversation(ingestionResult.conversationId);
      } catch (scoreError) {
        console.error(`Scoring failed for Voiceflow conversation ${ingestionResult.conversationId}:`, scoreError);
      }
    });

    return NextResponse.json({
      success: true,
      conversation_id: ingestionResult.conversationId,
      inserted_messages: ingestionResult.insertedMessages,
      message: ingestionResult.created
        ? "Voiceflow conversation ingested. Scoring in progress."
        : ingestionResult.insertedMessages > 0
          ? "Voiceflow conversation updated and queued for re-scoring."
          : "Voiceflow conversation already up to date.",
    });
  } catch (error) {
    console.error("Voiceflow webhook error:", error);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({
    service: "AgentGrade Voiceflow Webhook",
    auth: "Authorization: Bearer <voiceflow webhook secret>",
    notes: [
      "Use this endpoint for Voiceflow custom actions or transcript webhooks.",
      "Send the running transcript after each assistant reply or when the session closes.",
      "AgentGrade will append new turns for the same conversation_id and re-score automatically.",
    ],
    accepted_payload_shapes: [
      "{ messages: [{ role, content, timestamp? }] }",
      "{ transcript: [{ type, text, time? }] }",
      "{ turns: [{ speaker, message, timestamp? }] }",
    ],
  });
}
