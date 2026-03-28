import type { Message } from "@/lib/db/types";

export const CALIBRATION_DIMENSIONS = [
  { key: "overall", label: "Overall" },
  { key: "accuracy", label: "Accuracy" },
  { key: "hallucination", label: "Hallucination" },
  { key: "resolution", label: "Resolution" },
  { key: "escalation", label: "Escalation" },
  { key: "tone", label: "Tone" },
  { key: "sentiment", label: "Sentiment" },
] as const;

export const SCORER_MODEL_INFO = {
  evaluator_model: "claude-sonnet-4-6",
  evaluation_mode: "rubric + guardrails + human calibration",
  calibration_note:
    "Human labels are stored as calibration data for scorer tuning, evaluation regressions, and future rubric updates. They do not live-fine-tune the foundation model in real time.",
};

export function isManualCalibrationConversation(metadata?: Record<string, unknown> | null) {
  return Boolean(metadata?.manual_calibration);
}

const ROLE_PREFIXES: Array<{ prefix: string; role: Message["role"] }> = [
  { prefix: "customer:", role: "customer" },
  { prefix: "user:", role: "customer" },
  { prefix: "ai agent:", role: "agent" },
  { prefix: "assistant:", role: "agent" },
  { prefix: "agent:", role: "agent" },
  { prefix: "human agent:", role: "human_agent" },
  { prefix: "tool:", role: "tool" },
  { prefix: "system:", role: "system" },
];

export function parseTranscriptText(
  transcript: string
): Array<{ role: Message["role"]; content: string; timestamp: string; metadata: Record<string, unknown> }> {
  const lines = transcript
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

  const messages: Array<{ role: Message["role"]; content: string; timestamp: string; metadata: Record<string, unknown> }> = [];
  let currentRole: Message["role"] | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (!currentRole || buffer.length === 0) return;
    messages.push({
      role: currentRole,
      content: buffer.join("\n").trim(),
      timestamp: new Date(Date.now() + messages.length * 1000).toISOString(),
      metadata: {},
    });
    buffer = [];
  };

  for (const line of lines) {
    const match = ROLE_PREFIXES.find(({ prefix }) =>
      line.toLowerCase().startsWith(prefix)
    );

    if (match) {
      flush();
      currentRole = match.role;
      buffer.push(line.slice(match.prefix.length).trim());
      continue;
    }

    if (!currentRole) {
      currentRole = "customer";
    }
    buffer.push(line);
  }

  flush();
  return messages.filter((message) => message.content.length > 0);
}

export function normalizeLabelScores(input: Record<string, unknown>) {
  const labels: Array<{ dimension: string; score: number }> = [];

  for (const { key } of CALIBRATION_DIMENSIONS) {
    const raw = input[key];
    if (raw === undefined || raw === null || raw === "") continue;
    const numeric = typeof raw === "number" ? raw : Number(raw);
    if (Number.isNaN(numeric)) continue;
    labels.push({
      dimension: key,
      score: Math.max(0, Math.min(1, numeric > 1 ? numeric / 100 : numeric)),
    });
  }

  return labels;
}
