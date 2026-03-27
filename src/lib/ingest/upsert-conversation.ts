import { supabaseAdmin } from "@/lib/supabase";

interface IngestMessage {
  role: "agent" | "customer" | "human_agent" | "system" | "tool";
  content: string;
  timestamp?: string;
}

interface IngestPayload {
  messages: IngestMessage[];
  externalId?: string | null;
  platform: string;
  customerIdentifier?: string | null;
  metadata?: Record<string, unknown>;
}

interface ConnectionContext {
  id: string;
  workspace_id: string;
}

function toIsoTimestamp(timestamp?: string): string {
  if (!timestamp) return new Date().toISOString();

  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function messageKey(message: { role: string; content: string; timestamp: string }): string {
  return `${message.role}::${message.timestamp}::${message.content.trim()}`;
}

export async function upsertConversationWithMessages(
  connection: ConnectionContext,
  payload: IngestPayload
): Promise<{
  conversationId: string;
  created: boolean;
  insertedMessages: number;
}> {
  const normalizedMessages = payload.messages.map((message) => ({
    role: message.role,
    content: message.content,
    timestamp: toIsoTimestamp(message.timestamp),
    metadata: {},
  }));

  const wasEscalated = normalizedMessages.some((message) => message.role === "human_agent");
  const timestamps = normalizedMessages
    .map((message) => new Date(message.timestamp).getTime())
    .filter((value) => !Number.isNaN(value))
    .sort((a, b) => a - b);

  const startedAt = timestamps.length > 0 ? new Date(timestamps[0]).toISOString() : null;
  const endedAt = timestamps.length > 0 ? new Date(timestamps[timestamps.length - 1]).toISOString() : null;

  if (payload.externalId) {
    const { data: existingConversation } = await supabaseAdmin
      .from("conversations")
      .select("id, started_at, ended_at")
      .eq("workspace_id", connection.workspace_id)
      .eq("external_id", payload.externalId)
      .maybeSingle();

    if (existingConversation) {
      const { data: existingMessages, error: existingMessagesError } = await supabaseAdmin
        .from("messages")
        .select("role, content, timestamp")
        .eq("conversation_id", existingConversation.id)
        .order("timestamp", { ascending: true });

      if (existingMessagesError) {
        throw new Error(`Failed to load existing messages: ${existingMessagesError.message}`);
      }

      const existingKeys = new Set(
        (existingMessages || []).map((message) =>
          messageKey({
            role: message.role,
            content: message.content,
            timestamp: message.timestamp,
          })
        )
      );

      const newMessages = normalizedMessages.filter(
        (message) =>
          !existingKeys.has(
            messageKey({
              role: message.role,
              content: message.content,
              timestamp: message.timestamp,
            })
          )
      );

      if (newMessages.length > 0) {
        const { error: insertMessagesError } = await supabaseAdmin.from("messages").insert(
          newMessages.map((message) => ({
            conversation_id: existingConversation.id,
            ...message,
          }))
        );

        if (insertMessagesError) {
          throw new Error(`Failed to append messages: ${insertMessagesError.message}`);
        }
      }

      const previousStartedAt = existingConversation.started_at
        ? new Date(existingConversation.started_at).getTime()
        : null;
      const previousEndedAt = existingConversation.ended_at
        ? new Date(existingConversation.ended_at).getTime()
        : null;

      const mergedStartedAt =
        previousStartedAt !== null && startedAt
          ? new Date(Math.min(previousStartedAt, new Date(startedAt).getTime())).toISOString()
          : existingConversation.started_at || startedAt;
      const mergedEndedAt =
        previousEndedAt !== null && endedAt
          ? new Date(Math.max(previousEndedAt, new Date(endedAt).getTime())).toISOString()
          : existingConversation.ended_at || endedAt;

      const { error: updateConversationError } = await supabaseAdmin
        .from("conversations")
        .update({
          platform: payload.platform,
          customer_identifier: payload.customerIdentifier || null,
          message_count: (existingMessages || []).length + newMessages.length,
          was_escalated: wasEscalated,
          started_at: mergedStartedAt,
          ended_at: mergedEndedAt,
          metadata: payload.metadata || {},
        })
        .eq("id", existingConversation.id);

      if (updateConversationError) {
        throw new Error(`Failed to update conversation: ${updateConversationError.message}`);
      }

      return {
        conversationId: existingConversation.id,
        created: false,
        insertedMessages: newMessages.length,
      };
    }
  }

  const { data: conversation, error: conversationError } = await supabaseAdmin
    .from("conversations")
    .insert({
      workspace_id: connection.workspace_id,
      agent_connection_id: connection.id,
      external_id: payload.externalId || null,
      platform: payload.platform,
      customer_identifier: payload.customerIdentifier || null,
      message_count: normalizedMessages.length,
      was_escalated: wasEscalated,
      started_at: startedAt,
      ended_at: endedAt,
      metadata: payload.metadata || {},
    })
    .select("id")
    .single();

  if (conversationError || !conversation) {
    throw new Error(`Failed to create conversation: ${conversationError?.message}`);
  }

  const { error: insertMessagesError } = await supabaseAdmin.from("messages").insert(
    normalizedMessages.map((message) => ({
      conversation_id: conversation.id,
      ...message,
    }))
  );

  if (insertMessagesError) {
    throw new Error(`Failed to insert messages: ${insertMessagesError.message}`);
  }

  return {
    conversationId: conversation.id,
    created: true,
    insertedMessages: normalizedMessages.length,
  };
}
