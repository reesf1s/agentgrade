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
      return { isFinal: true, hasExplicitSignal: true, status: "completed" };
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
      return { isFinal: true, hasExplicitSignal: true, status: normalized };
    }

    if (NON_FINAL_STATUSES.has(normalized)) {
      return { isFinal: false, hasExplicitSignal: true, status: normalized };
    }
  }

  return { isFinal: false, hasExplicitSignal: false, status };
}

export function stampCompletionMetadata(
  metadata: Record<string, unknown> | undefined,
  completion: CompletionState
): Record<string, unknown> {
  return {
    ...(metadata || {}),
    ...(completion.status ? { conversation_status: completion.status } : {}),
    ...(completion.hasExplicitSignal ? { is_final: completion.isFinal } : {}),
  };
}

export function isConversationExplicitlyIncomplete(
  metadata: Record<string, unknown> | null | undefined
): boolean {
  if (!metadata) return false;
  const completion = deriveCompletionState({ metadata });
  return completion.hasExplicitSignal && !completion.isFinal;
}
