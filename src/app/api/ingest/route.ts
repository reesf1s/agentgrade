import { after, NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { scoreConversation } from "@/lib/scoring";
import { upsertConversationWithMessages } from "@/lib/ingest/upsert-conversation";
import { deriveCompletionState, stampCompletionMetadata } from "@/lib/ingest/completion";
import { normalizeIncomingMessages } from "@/lib/ingest/normalize-incoming";

const VALID_ROLES = ["agent", "customer", "human_agent", "system", "tool"] as const;
type MessageRole = typeof VALID_ROLES[number];

function hasScorableAgentTurn(messages: Array<{ role: MessageRole }>) {
  return messages.some((message) => message.role === "agent" || message.role === "human_agent");
}

/**
 * POST /api/ingest
 * REST API endpoint for sending conversations to AgentGrade.
 * Authenticates via X-AgentGrade-API-Key header (the connection's webhook_secret).
 *
 * This is functionally identical to /api/webhooks/ingest but uses a different
 * auth header convention (API key vs Bearer token) for SDK ergonomics.
 *
 * Body: same as /api/webhooks/ingest
 */
export async function POST(request: NextRequest) {
  try {
    // Support both X-AgentGrade-API-Key and Authorization: Bearer
    const apiKey =
      request.headers.get("x-agentgrade-api-key") ||
      (() => {
        const auth = request.headers.get("authorization") || "";
        return auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
      })();

    if (!apiKey) {
      return NextResponse.json(
        { error: "X-AgentGrade-API-Key header required" },
        { status: 401 }
      );
    }

    // Look up the connection by webhook_secret (the API key IS the webhook secret)
    const { data: connections } = await supabaseAdmin
      .from("agent_connections")
      .select("id, workspace_id, platform, is_active")
      .eq("webhook_secret", apiKey)
      .limit(1);

    const connection = connections?.[0] || null;

    if (!connection) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }
    if (!connection.is_active) {
      return NextResponse.json({ error: "Connection is inactive" }, { status: 403 });
    }

    const body = await request.json();
    const completion = deriveCompletionState(body);

    // Validate messages
    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json(
        { error: "messages array is required and must not be empty" },
        { status: 400 }
      );
    }

    for (const msg of body.messages) {
      if (!msg.role || (!msg.content && !msg.parts && !msg.toolInvocations)) {
        return NextResponse.json(
          { error: "Each message must have 'role' and either 'content', 'parts', or 'toolInvocations'" },
          { status: 400 }
        );
      }
      if (!VALID_ROLES.includes(msg.role) && !["user", "assistant", "bot", "human", "support", "ai"].includes(msg.role)) {
        return NextResponse.json(
          { error: `Invalid role '${msg.role}'. Must be: ${VALID_ROLES.join(", ")}` },
          { status: 400 }
        );
      }
    }

    const messages = normalizeIncomingMessages(body.messages);
    if (messages.length === 0) {
      return NextResponse.json(
        { error: "No valid messages were found after normalization" },
        { status: 400 }
      );
    }
    const externalId: string | null = body.conversation_id || null;
    const shouldScore = hasScorableAgentTurn(messages) && completion.isFinal;

    const ingestionResult = await upsertConversationWithMessages(connection, {
      messages,
      externalId,
      platform: body.platform || connection.platform || "custom",
      customerIdentifier: body.customer_identifier || null,
      metadata: stampCompletionMetadata(body.metadata || {}, completion),
    });

    // Optionally score synchronously if ?score=sync is set
    const scoreMode = new URL(request.url).searchParams.get("score");

    if (scoreMode === "sync" && shouldScore) {
      const { score, isPartial } = await scoreConversation(ingestionResult.conversationId);

      return NextResponse.json({
        success: true,
        conversation_id: ingestionResult.conversationId,
        score,
        is_partial: isPartial,
        message: isPartial
          ? "Conversation ingested. Scoring completed with fallback safeguards."
          : ingestionResult.created
            ? "Conversation ingested and scored."
            : "Conversation updated and re-scored.",
      });
    }

    if (shouldScore) {
      after(async () => {
        try {
          await scoreConversation(ingestionResult.conversationId);
        } catch (scoreError) {
          console.error(`Async scoring failed for ${ingestionResult.conversationId}:`, scoreError);
        }
      });
    }

    return NextResponse.json({
      success: true,
      conversation_id: ingestionResult.conversationId,
      inserted_messages: ingestionResult.insertedMessages,
      message:
        ingestionResult.created
          ? shouldScore
            ? "Conversation ingested. Scoring in progress."
            : completion.hasExplicitSignal && !completion.isFinal
              ? "Conversation ingested. Waiting for the conversation to be marked complete before scoring."
              : "Conversation ingested. Waiting for the 10-minute quiet period before scoring."
          : ingestionResult.insertedMessages > 0
            ? shouldScore
              ? "Conversation updated with new messages. Re-scoring in progress."
              : completion.hasExplicitSignal && !completion.isFinal
                ? "Conversation updated with new messages. Waiting for the conversation to be marked complete before scoring."
                : "Conversation updated with new messages. Waiting for the 10-minute quiet period before scoring."
            : "Conversation already up to date.",
    });
  } catch (error) {
    console.error("Ingest REST API error:", error);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
