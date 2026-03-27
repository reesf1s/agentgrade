import { after, NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { scoreConversation } from "@/lib/scoring";

const VALID_ROLES = ["agent", "customer", "human_agent", "system"] as const;
type MessageRole = typeof VALID_ROLES[number];

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
      .from("ag_agent_connections")
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

    // Validate messages
    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json(
        { error: "messages array is required and must not be empty" },
        { status: 400 }
      );
    }

    for (const msg of body.messages) {
      if (!msg.role || !msg.content) {
        return NextResponse.json(
          { error: "Each message must have 'role' and 'content'" },
          { status: 400 }
        );
      }
      if (!VALID_ROLES.includes(msg.role)) {
        return NextResponse.json(
          { error: `Invalid role '${msg.role}'. Must be: ${VALID_ROLES.join(", ")}` },
          { status: 400 }
        );
      }
    }

    const messages = body.messages as Array<{ role: MessageRole; content: string; timestamp?: string }>;
    const externalId: string | null = body.conversation_id || null;

    // Idempotency check
    if (externalId) {
      const { data: existing } = await supabaseAdmin
        .from("ag_conversations")
        .select("id")
        .eq("workspace_id", connection.workspace_id)
        .eq("external_id", externalId)
        .single();
      if (existing) {
        return NextResponse.json({
          success: true,
          conversation_id: existing.id,
          message: "Conversation already exists (idempotent).",
        });
      }
    }

    const wasEscalated = messages.some((m) => m.role === "human_agent");
    const timestamps = messages
      .filter((m) => m.timestamp)
      .map((m) => new Date(m.timestamp!).getTime())
      .filter((t) => !isNaN(t))
      .sort((a, b) => a - b);

    // Insert conversation
    const { data: conversation, error: convError } = await supabaseAdmin
      .from("ag_conversations")
      .insert({
        workspace_id: connection.workspace_id,
        agent_connection_id: connection.id,
        external_id: externalId,
        platform: body.platform || connection.platform || "custom",
        customer_identifier: body.customer_identifier || null,
        message_count: messages.length,
        was_escalated: wasEscalated,
        started_at: timestamps.length > 0 ? new Date(timestamps[0]).toISOString() : null,
        ended_at: timestamps.length > 0 ? new Date(timestamps[timestamps.length - 1]).toISOString() : null,
        metadata: body.metadata || {},
      })
      .select("id")
      .single();

    if (convError || !conversation) {
      console.error("Failed to insert conversation:", convError);
      return NextResponse.json({ error: "Failed to store conversation" }, { status: 500 });
    }

    // Insert messages
    await supabaseAdmin.from("ag_messages").insert(
      messages.map((msg) => ({
        conversation_id: conversation.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp ? new Date(msg.timestamp).toISOString() : new Date().toISOString(),
        metadata: {},
      }))
    );

    // Optionally score synchronously if ?score=sync is set
    const scoreMode = new URL(request.url).searchParams.get("score");

    if (scoreMode === "sync") {
      const { score, isPartial } = await scoreConversation(conversation.id);

      return NextResponse.json({
        success: true,
        conversation_id: conversation.id,
        score,
        is_partial: isPartial,
        message: isPartial
          ? "Conversation ingested. Scoring completed with fallback safeguards."
          : "Conversation ingested and scored.",
      });
    }

    after(async () => {
      try {
        await scoreConversation(conversation.id);
      } catch (scoreError) {
        console.error(`Async scoring failed for ${conversation.id}:`, scoreError);
      }
    });

    return NextResponse.json({
      success: true,
      conversation_id: conversation.id,
      message: "Conversation ingested. Scoring in progress.",
    });
  } catch (error) {
    console.error("Ingest REST API error:", error);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
