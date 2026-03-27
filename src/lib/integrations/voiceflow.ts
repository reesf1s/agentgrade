interface NormalizedVoiceflowMessage {
  role: "agent" | "customer" | "system" | "tool";
  content: string;
  timestamp?: string;
}

interface VoiceflowNormalizedPayload {
  conversationId: string;
  customerIdentifier: string | null;
  messages: NormalizedVoiceflowMessage[];
  metadata: Record<string, unknown>;
}

function normalizeRole(value: unknown): NormalizedVoiceflowMessage["role"] | null {
  const raw = String(value || "").toLowerCase();

  if (["customer", "user", "visitor", "end_user"].includes(raw)) return "customer";
  if (["agent", "assistant", "ai", "bot", "voiceflow"].includes(raw)) return "agent";
  if (["system"].includes(raw)) return "system";
  if (["tool", "function"].includes(raw)) return "tool";
  return null;
}

function coerceMessage(input: Record<string, unknown>): NormalizedVoiceflowMessage | null {
  const role =
    normalizeRole(input.role) ||
    normalizeRole(input.type) ||
    normalizeRole(input.speaker) ||
    normalizeRole(input.author);

  const content =
    typeof input.content === "string"
      ? input.content
      : typeof input.text === "string"
        ? input.text
        : typeof input.message === "string"
          ? input.message
          : "";

  if (!role || !content.trim()) return null;

  return {
    role,
    content: content.trim(),
    timestamp:
      typeof input.timestamp === "string"
        ? input.timestamp
        : typeof input.time === "string"
          ? input.time
          : undefined,
  };
}

function getRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function normalizeVoiceflowPayload(body: unknown): VoiceflowNormalizedPayload | null {
  const payload = getRecord(body);
  if (!payload) return null;

  const directMessages = Array.isArray(payload.messages)
    ? payload.messages
    : Array.isArray(payload.transcript)
      ? payload.transcript
      : Array.isArray(payload.turns)
        ? payload.turns
        : [];

  const messages = directMessages
    .map((entry) => getRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map(coerceMessage)
    .filter((entry): entry is NormalizedVoiceflowMessage => Boolean(entry));

  if (messages.length === 0) return null;

  const session = getRecord(payload.session);
  const state = getRecord(payload.state);
  const user = getRecord(payload.user);

  const conversationId =
    String(
      payload.conversation_id ||
        payload.conversationId ||
        payload.session_id ||
        session?.sessionID ||
        session?.id ||
        state?.session_id ||
        user?.id ||
        crypto.randomUUID()
    );

  const customerIdentifier =
    typeof payload.customer_identifier === "string"
      ? payload.customer_identifier
      : typeof payload.user_id === "string"
        ? payload.user_id
        : typeof user?.id === "string"
          ? user.id
          : typeof session?.userID === "string"
            ? session.userID
            : null;

  return {
    conversationId,
    customerIdentifier,
    messages,
    metadata: {
      source: "voiceflow",
      session: session || undefined,
      state: state || undefined,
    },
  };
}
