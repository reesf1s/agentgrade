import type { Message } from "@/lib/db/types";

const ROLE_ALIASES: Record<string, Message["role"]> = {
  user: "customer",
  customer: "customer",
  assistant: "agent",
  agent: "agent",
  bot: "agent",
  ai: "agent",
  human_agent: "human_agent",
  human: "human_agent",
  support: "human_agent",
  system: "system",
  tool: "tool",
};

export interface NormalizedIncomingMessage {
  role: Message["role"];
  content: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

interface RawToolInvocation {
  toolName?: string;
  args?: unknown;
  result?: unknown;
  state?: string;
  toolCallId?: string;
}

interface RawIncomingMessage {
  role?: string;
  content?: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
  parts?: Array<Record<string, unknown>>;
  toolInvocations?: RawToolInvocation[];
}

function extractTextFromParts(parts: Array<Record<string, unknown>> | undefined): string {
  if (!Array.isArray(parts)) return "";

  return parts
    .map((part) => {
      if (typeof part?.text === "string") return part.text;
      return "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

function stringifyValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizeRole(role?: string): Message["role"] | null {
  if (!role) return null;
  return ROLE_ALIASES[String(role).toLowerCase()] || null;
}

function normalizeToolInvocations(
  toolInvocations: RawToolInvocation[] | undefined,
  timestamp?: string
): NormalizedIncomingMessage[] {
  if (!Array.isArray(toolInvocations)) return [];

  return toolInvocations
    .map((invocation) => {
      const toolName = typeof invocation.toolName === "string" ? invocation.toolName : "tool_call";
      const argsText = stringifyValue(invocation.args);
      const resultText = stringifyValue(invocation.result);
      const content = resultText
        ? `${toolName}(${argsText || ""}) => ${resultText}`.trim()
        : `${toolName}(${argsText || ""})`.trim();

      return {
        role: "tool" as const,
        content,
        timestamp,
        metadata: {
          tool_name: toolName,
          tool_args: invocation.args ?? null,
          tool_result: invocation.result ?? null,
          tool_state: invocation.state ?? null,
          tool_call_id: invocation.toolCallId ?? null,
        },
      };
    })
    .filter((message) => message.content.length > 0);
}

export function normalizeIncomingMessages(messages: RawIncomingMessage[]): NormalizedIncomingMessage[] {
  const normalized: NormalizedIncomingMessage[] = [];

  for (const rawMessage of messages) {
    const role = normalizeRole(rawMessage.role);
    if (!role) continue;

    const content = (rawMessage.content || extractTextFromParts(rawMessage.parts)).trim();
    const metadata = {
      ...(rawMessage.metadata || {}),
      ...(Array.isArray(rawMessage.parts) ? { parts: rawMessage.parts } : {}),
    };

    const toolMessages =
      role === "agent"
        ? normalizeToolInvocations(rawMessage.toolInvocations, rawMessage.timestamp)
        : [];

    normalized.push(...toolMessages);

    if (content.length > 0) {
      normalized.push({
        role,
        content,
        timestamp: rawMessage.timestamp,
        metadata,
      });
    }
  }

  return normalized;
}
