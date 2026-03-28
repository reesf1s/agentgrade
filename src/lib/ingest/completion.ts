type JsonRecord = Record<string, unknown>;

const FINAL_STATUSES = new Set([
  "closed",
  "complete",
  "completed",
  "done",
  "ended",
  "finished",
  "resolved",
]);

const NON_FINAL_STATUSES = new Set([
  "active",
  "in_progress",
  "open",
  "pending",
  "streaming",
]);

function getRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function getBooleanSignal(record: JsonRecord | null, key: string): boolean | undefined {
  if (!record || !(key in record)) return undefined;
  const value = record[key];
  return typeof value === "boolean" ? value : undefined;
}

function getStringSignal(record: JsonRecord | null, key: string): string | undefined {
  if (!record || !(key in record)) return undefined;
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export interface CompletionState {
  isFinal: boolean;
  hasExplicitSignal: boolean;
  status?: string;
  inferred?: boolean;
  reason?: string;
}

export function deriveCompletionState(payload: unknown): CompletionState {
  const record = getRecord(payload);
  const metadata = getRecord(record?.metadata);

  const booleanSignals = [
    getBooleanSignal(record, "completed"),
    getBooleanSignal(record, "is_final"),
    getBooleanSignal(record, "isFinal"),
    getBooleanSignal(record, "final"),
    getBooleanSignal(metadata, "completed"),
    getBooleanSignal(metadata, "is_final"),
    getBooleanSignal(metadata, "isFinal"),
    getBooleanSignal(metadata, "final"),
  ];

  for (const signal of booleanSignals) {
    if (signal === true) {
      return { isFinal: true, hasExplicitSignal: true, status: "completed", reason: "explicit_boolean" };
    }
    if (signal === false) {
      return { isFinal: false, hasExplicitSignal: true, status: "open", reason: "explicit_boolean" };
    }
  }

  const status =
    getStringSignal(record, "status") ||
    getStringSignal(record, "conversation_status") ||
    getStringSignal(record, "state") ||
    getStringSignal(metadata, "status") ||
    getStringSignal(metadata, "conversation_status") ||
    getStringSignal(metadata, "state");

  if (status) {
    const normalized = status.toLowerCase();
    if (FINAL_STATUSES.has(normalized)) {
      return { isFinal: true, hasExplicitSignal: true, status: normalized, reason: "explicit_status" };
    }

    if (NON_FINAL_STATUSES.has(normalized)) {
      return { isFinal: false, hasExplicitSignal: true, status: normalized, reason: "explicit_status" };
    }
  }

  return { isFinal: false, hasExplicitSignal: false, status };
}

function hasCloseOutQuestion(content: string) {
  return /(anything else|want me to|would you like me to|shall i|if you'd like|let me know|need anything else|can i help with anything else)/i.test(
    content
  );
}

function hasOpenFollowUpQuestion(content: string) {
  if (!/\?/.test(content)) return false;
  return !hasCloseOutQuestion(content);
}

export function inferCompletionFromMessages(
  messages: Array<{ role: string; content: string; metadata?: Record<string, unknown> }>
): CompletionState {
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage) {
    return { isFinal: false, hasExplicitSignal: false, inferred: false, reason: "no_messages" };
  }

  const scorableAgentTurn = messages.some((message) => message.role === "agent" || message.role === "human_agent");
  if (!scorableAgentTurn) {
    return { isFinal: false, hasExplicitSignal: false, inferred: false, reason: "no_agent_turn" };
  }

  if (lastMessage.role === "customer" || lastMessage.role === "tool" || lastMessage.role === "system") {
    return { isFinal: false, hasExplicitSignal: false, inferred: true, reason: "awaiting_agent" };
  }

  const content = String(lastMessage.content || "").trim();
  if (!content) {
    return { isFinal: false, hasExplicitSignal: false, inferred: true, reason: "empty_agent_turn" };
  }

  const explicitStreamingState = String(lastMessage.metadata?.tool_state || "").toLowerCase();
  if (explicitStreamingState === "partial" || explicitStreamingState === "streaming") {
    return { isFinal: false, hasExplicitSignal: false, inferred: true, reason: "streaming" };
  }

  if (hasOpenFollowUpQuestion(content)) {
    return { isFinal: false, hasExplicitSignal: false, inferred: true, reason: "open_question" };
  }

  return {
    isFinal: true,
    hasExplicitSignal: false,
    inferred: true,
    status: "completed",
    reason: hasCloseOutQuestion(content) ? "close_out_question" : "agent_final_turn",
  };
}

export function stampCompletionMetadata(
  metadata: Record<string, unknown> | undefined,
  completion: CompletionState
): Record<string, unknown> {
  return {
    ...(metadata || {}),
    ...(completion.status ? { conversation_status: completion.status } : {}),
    ...((completion.hasExplicitSignal || completion.inferred) ? { is_final: completion.isFinal } : {}),
    ...(completion.inferred ? { completion_inferred: true } : {}),
    ...(completion.reason ? { completion_reason: completion.reason } : {}),
  };
}

export function isConversationExplicitlyIncomplete(
  metadata: Record<string, unknown> | null | undefined
): boolean {
  if (!metadata) return false;
  const completion = deriveCompletionState({ metadata });
  return completion.hasExplicitSignal && !completion.isFinal;
}
