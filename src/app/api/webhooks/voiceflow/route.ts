import { after, NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { scoreConversation } from "@/lib/scoring";
import { upsertConversationWithMessages } from "@/lib/ingest/upsert-conversation";
import { deriveCompletionState, inferCompletionFromMessages, stampCompletionMetadata } from "@/lib/ingest/completion";
import { normalizeVoiceflowPayload } from "@/lib/integrations/voiceflow";

function hasScorableAgentTurn(messages: Array<{ role: "agent" | "customer" | "system" | "tool" }>) {
  return messages.some((message) => message.role === "agent");
}

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
      .from("ag_agent_connections")
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
    const explicitCompletion = deriveCompletionState(body);
    const normalized = normalizeVoiceflowPayload(body);

    if (!normalized) {
      return NextResponse.json(
        {
          error: "Could not normalize Voiceflow payload. Include a transcript/messages array with user and assistant turns.",
        },
        { status: 400 }
      );
    }

    const completion = explicitCompletion.hasExplicitSignal
      ? explicitCompletion
      : inferCompletionFromMessages(normalized.messages);

    const ingestionResult = await upsertConversationWithMessages(connection, {
      messages: normalized.messages,
      externalId: normalized.conversationId,
      platform: "voiceflow",
      customerIdentifier: normalized.customerIdentifier,
      metadata: stampCompletionMetadata(normalized.metadata, completion),
    });

    const shouldScore = hasScorableAgentTurn(normalized.messages) && completion.isFinal;

    if (shouldScore) {
      after(async () => {
        try {
          await scoreConversation(ingestionResult.conversationId);
        } catch (scoreError) {
          console.error(`Scoring failed for Voiceflow conversation ${ingestionResult.conversationId}:`, scoreError);
        }
      });
    }

    return NextResponse.json({
      success: true,
      conversation_id: ingestionResult.conversationId,
      inserted_messages: ingestionResult.insertedMessages,
      message: ingestionResult.created
        ? shouldScore
          ? "Voiceflow conversation ingested. Scoring in progress."
          : completion.hasExplicitSignal && !completion.isFinal
            ? "Voiceflow conversation ingested. Waiting for the conversation to be marked complete before scoring."
            : "Voiceflow conversation ingested. Stored as in-progress because the server inferred the session is still open."
        : ingestionResult.insertedMessages > 0
          ? shouldScore
            ? "Voiceflow conversation updated and queued for re-scoring."
            : completion.hasExplicitSignal && !completion.isFinal
              ? "Voiceflow conversation updated. Waiting for the conversation to be marked complete before scoring."
              : "Voiceflow conversation updated. Still waiting because the server inferred the session is open."
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
      "To score the whole conversation only after it ends, include completed=true or status='completed' on the final send.",
      "If you do not send a final flag, AgentGrade will infer completion from the transcript and re-score when the last turn looks terminal.",
    ],
    accepted_payload_shapes: [
      "{ messages: [{ role, content, timestamp? }] }",
      "{ transcript: [{ type, text, time? }] }",
      "{ turns: [{ speaker, message, timestamp? }] }",
    ],
  });
}
