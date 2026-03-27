import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { runScoringPipeline } from "@/lib/scoring";

/**
 * Intercom webhook receiver.
 * Authenticate by linking your Intercom workspace to an AgentGrade agent_connection.
 * Include your webhook_secret in the X-AgentGrade-Secret header.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const topic = body.topic;

    // Intercom ping/test
    if (topic === "ping") {
      return NextResponse.json({ received: true });
    }

    // Only process closed conversations (fully scored)
    if (topic !== "conversation.admin.closed") {
      return NextResponse.json({ received: true, topic, note: "Event type not processed" });
    }

    const intercomConversation = body.data?.item;
    if (!intercomConversation) {
      return NextResponse.json({ error: "No conversation data" }, { status: 400 });
    }

    // Authenticate via secret header to find workspace
    const secret = request.headers.get("x-agentgrade-secret") || "";
    const { data: connections, error: connError } = await supabaseAdmin
      .from("ag_agent_connections")
      .select("id, workspace_id, is_active")
      .eq("webhook_secret", secret)
      .eq("platform", "intercom")
      .limit(1);

    const connection = connections?.[0] || null;

    if (connError || !connection) {
      return NextResponse.json({ error: "Invalid or missing X-AgentGrade-Secret" }, { status: 401 });
    }

    if (!connection.is_active) {
      return NextResponse.json({ error: "Agent connection is inactive" }, { status: 403 });
    }

    // Transform Intercom conversation format to our schema
    const externalId = String(intercomConversation.id);
    const customerEmail =
      intercomConversation.source?.author?.email ||
      intercomConversation.contacts?.contacts?.[0]?.external_id ||
      null;

    // Build messages from conversation parts
    const conversationParts: Array<{
      role: "agent" | "customer" | "human_agent" | "system";
      content: string;
      timestamp?: string;
    }> = [];

    // First message (customer's opening)
    if (intercomConversation.source?.body) {
      const text = stripHtml(intercomConversation.source.body);
      if (text) {
        conversationParts.push({
          role: "customer",
          content: text,
          timestamp: intercomConversation.source.created_at
            ? new Date(intercomConversation.source.created_at * 1000).toISOString()
            : undefined,
        });
      }
    }

    // Conversation parts (bot/admin replies + customer replies)
    const parts = intercomConversation.conversation_parts?.conversation_parts || [];
    for (const part of parts) {
      if (!part.body || part.part_type === "close" || part.part_type === "open") continue;
      const text = stripHtml(part.body);
      if (!text) continue;

      const authorType = part.author?.type;
      let role: "agent" | "customer" | "human_agent" | "system";
      if (authorType === "user" || authorType === "lead") {
        role = "customer";
      } else if (authorType === "bot") {
        role = "agent";
      } else if (authorType === "admin") {
        role = "human_agent";
      } else {
        role = "system";
      }

      conversationParts.push({
        role,
        content: text,
        timestamp: part.created_at
          ? new Date(part.created_at * 1000).toISOString()
          : undefined,
      });
    }

    if (conversationParts.length === 0) {
      return NextResponse.json({ received: true, note: "No processable messages found" });
    }

    const wasEscalated = conversationParts.some((m) => m.role === "human_agent");
    const timestamps = conversationParts
      .filter((m) => m.timestamp)
      .map((m) => new Date(m.timestamp!).getTime())
      .sort((a, b) => a - b);

    // Upsert conversation (idempotent by external_id + workspace)
    const { data: existing } = await supabaseAdmin
      .from("ag_conversations")
      .select("id")
      .eq("workspace_id", connection.workspace_id)
      .eq("external_id", externalId)
      .single();

    let conversationId: string;

    if (existing) {
      conversationId = existing.id;
    } else {
      const { data: conversation, error: convError } = await supabaseAdmin
        .from("ag_conversations")
        .insert({
          workspace_id: connection.workspace_id,
          agent_connection_id: connection.id,
          external_id: externalId,
          platform: "intercom",
          customer_identifier: customerEmail,
          message_count: conversationParts.length,
          was_escalated: wasEscalated,
          started_at: timestamps.length > 0 ? new Date(timestamps[0]).toISOString() : null,
          ended_at: timestamps.length > 0 ? new Date(timestamps[timestamps.length - 1]).toISOString() : null,
          metadata: {
            intercom_id: externalId,
            tags: intercomConversation.tags?.tags?.map((t: { name: string }) => t.name) || [],
          },
        })
        .select("id")
        .single();

      if (convError || !conversation) {
        console.error("Failed to insert Intercom conversation:", convError);
        return NextResponse.json({ error: "Failed to store conversation" }, { status: 500 });
      }

      conversationId = conversation.id;

      // Insert messages
      await supabaseAdmin.from("ag_messages").insert(
        conversationParts.map((msg) => ({
          conversation_id: conversationId,
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp || new Date().toISOString(),
          metadata: {},
        }))
      );
    }

    // Score asynchronously
    scoreIntercomConversationAsync(conversationId, conversationParts, connection.workspace_id);

    return NextResponse.json({ received: true, topic, conversation_id: conversationId });
  } catch (error) {
    console.error("Intercom webhook error:", error);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

async function scoreIntercomConversationAsync(
  conversationId: string,
  messages: Array<{ role: string; content: string; timestamp?: string }>,
  workspaceId: string
) {
  try {
    // Don't re-score if already scored
    const { data: existing } = await supabaseAdmin
      .from("ag_quality_scores")
      .select("id")
      .eq("conversation_id", conversationId)
      .single();

    if (existing) return;

    const { data: kbChunks } = await supabaseAdmin
      .from("knowledge_base")
      .select("content")
      .eq("workspace_id", workspaceId)
      .limit(5);

    const knowledgeBaseContext = kbChunks?.map((c) => c.content) || [];

    const scoreResult = await runScoringPipeline({
      messages: messages.map((m, i) => ({
        id: `msg-${i}`,
        conversation_id: conversationId,
        role: m.role as "agent" | "customer" | "human_agent" | "system",
        content: m.content,
        timestamp: m.timestamp || new Date().toISOString(),
        metadata: {},
      })),
      knowledgeBaseContext,
    });

    await supabaseAdmin.from("ag_quality_scores").insert({
      conversation_id: conversationId,
      ...scoreResult,
      scored_at: new Date().toISOString(),
    });

    console.log(`Scored Intercom conversation ${conversationId}: ${scoreResult.overall_score}`);
  } catch (error) {
    console.error(`Scoring failed for Intercom conversation ${conversationId}:`, error);
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}
