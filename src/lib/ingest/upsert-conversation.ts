import { supabaseAdmin } from "@/lib/supabase";
import { prepareMessagesForInsert } from "@/lib/messages/transcript-normalizer";

interface IngestMessage {
  role: "agent" | "customer" | "human_agent" | "system" | "tool";
  content: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
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
    content: message.content.trim(),
    timestamp: message.timestamp,
    metadata: message.metadata || {},
  }));

  const wasEscalated = normalizedMessages.some((message) => message.role === "human_agent");

  if (payload.externalId) {
    const { data: existingConversation } = await supabaseAdmin
      .from("ag_conversations")
      .select("id, started_at, ended_at, metadata")
      .eq("workspace_id", connection.workspace_id)
      .eq("external_id", payload.externalId)
      .maybeSingle();

    if (existingConversation) {
      const { data: existingMessages, error: existingMessagesError } = await supabaseAdmin
        .from("ag_messages")
        .select("role, content, timestamp")
        .eq("conversation_id", existingConversation.id)
        .order("timestamp", { ascending: true });

      if (existingMessagesError) {
        throw new Error(`Failed to load existing messages: ${existingMessagesError.message}`);
      }

      const newMessages = prepareMessagesForInsert(existingMessages || [], normalizedMessages);

      if (newMessages.length > 0) {
        const { error: insertMessagesError } = await supabaseAdmin.from("ag_messages").insert(
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
      const effectiveMessages = [...(existingMessages || []), ...newMessages];
      const timestamps = effectiveMessages
        .map((message) => new Date(message.timestamp).getTime())
        .filter((value) => !Number.isNaN(value))
        .sort((a, b) => a - b);
      const startedAt = timestamps.length > 0 ? new Date(timestamps[0]).toISOString() : null;
      const endedAt = timestamps.length > 0 ? new Date(timestamps[timestamps.length - 1]).toISOString() : null;

      const mergedStartedAt =
        previousStartedAt !== null && startedAt
          ? new Date(Math.min(previousStartedAt, new Date(startedAt).getTime())).toISOString()
          : existingConversation.started_at || startedAt;
      const mergedEndedAt =
        previousEndedAt !== null && endedAt
          ? new Date(Math.max(previousEndedAt, new Date(endedAt).getTime())).toISOString()
          : existingConversation.ended_at || endedAt;

      const { error: updateConversationError } = await supabaseAdmin
        .from("ag_conversations")
        .update({
          platform: payload.platform,
          customer_identifier: payload.customerIdentifier || null,
          message_count: (existingMessages || []).length + newMessages.length,
          was_escalated: wasEscalated,
          started_at: mergedStartedAt,
          ended_at: mergedEndedAt,
          metadata: {
            ...((existingConversation.metadata as Record<string, unknown> | null) || {}),
            ...(payload.metadata || {}),
          },
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

  const preparedMessages = prepareMessagesForInsert([], normalizedMessages);
  const timestamps = preparedMessages
    .map((message) => new Date(message.timestamp).getTime())
    .filter((value) => !Number.isNaN(value))
    .sort((a, b) => a - b);
  const startedAt = timestamps.length > 0 ? new Date(timestamps[0]).toISOString() : null;
  const endedAt = timestamps.length > 0 ? new Date(timestamps[timestamps.length - 1]).toISOString() : null;

  const { data: conversation, error: conversationError } = await supabaseAdmin
    .from("ag_conversations")
    .insert({
      workspace_id: connection.workspace_id,
      agent_connection_id: connection.id,
      external_id: payload.externalId || null,
      platform: payload.platform,
      customer_identifier: payload.customerIdentifier || null,
      message_count: preparedMessages.length,
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

  const { error: insertMessagesError } = await supabaseAdmin.from("ag_messages").insert(
    preparedMessages.map((message) => ({
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
    insertedMessages: preparedMessages.length,
  };
}
