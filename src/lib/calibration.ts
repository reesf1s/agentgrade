import type { Message } from "@/lib/db/types";
import { getScoringModel, getScoringProvider } from "@/lib/scoring/config";

export const CALIBRATION_SHARE_SCOPES = [
  {
    key: "workspace_private",
    label: "Private to this workspace",
    description: "Use this label set only to calibrate scoring for your own organization.",
  },
  {
    key: "global_anonymous",
    label: "Contribute anonymized features globally",
    description:
      "Share only anonymized scorer features and human labels across customers. Raw transcript text stays private.",
  },
] as const;

export const CALIBRATION_EXAMPLE_KINDS = [
  {
    key: "real",
    label: "Real customer conversation",
    description: "A real production or staging conversation from your organization.",
  },
  {
    key: "synthetic",
    label: "Synthetic or fake test case",
    description: "A crafted example used to cover edge cases, regressions, or policy tests.",
  },
] as const;

export type CalibrationShareScope = (typeof CALIBRATION_SHARE_SCOPES)[number]["key"];
export type CalibrationExampleKind = (typeof CALIBRATION_EXAMPLE_KINDS)[number]["key"];

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
  evaluator_model: getScoringModel(),
  evaluator_provider: getScoringProvider(),
  evaluation_mode: "Base evaluator + guardrails + learned corrections",
  calibration_note:
    "Human reviews help the scorer get smarter over time. Private labels stay inside your workspace. Shared learning uses anonymized scoring features and labels, not raw transcript text. The foundation model itself is not being live fine-tuned in real time.",
};

export function isManualCalibrationConversation(metadata?: Record<string, unknown> | null) {
  return Boolean(metadata?.manual_calibration);
}

export function getCalibrationShareScope(
  metadata?: Record<string, unknown> | null
): CalibrationShareScope {
  return metadata?.calibration_share_scope === "global_anonymous"
    ? "global_anonymous"
    : "workspace_private";
}

export function getCalibrationExampleKind(
  metadata?: Record<string, unknown> | null
): CalibrationExampleKind {
  return metadata?.calibration_example_kind === "synthetic" ? "synthetic" : "real";
}

export function isGoldSetConversation(metadata?: Record<string, unknown> | null) {
  return Boolean(metadata?.calibration_is_gold_set);
}

export function buildCalibrationMetadataPatch(input: {
  existing?: Record<string, unknown> | null;
  title?: string | null;
  notes?: string | null;
  share_scope?: CalibrationShareScope | null;
  example_kind?: CalibrationExampleKind | null;
  source?: "pasted_transcript" | "existing_conversation";
}) {
  return {
    ...(input.existing || {}),
    calibration_is_gold_set: true,
    calibration_title: input.title ?? (input.existing?.calibration_title as string | null) ?? null,
    calibration_notes: input.notes ?? (input.existing?.calibration_notes as string | null) ?? null,
    calibration_share_scope:
      input.share_scope || getCalibrationShareScope(input.existing || null),
    calibration_example_kind:
      input.example_kind || getCalibrationExampleKind(input.existing || null),
    calibration_source:
      input.source || ((input.existing?.calibration_source as string | null) ?? "existing_conversation"),
    calibration_last_labeled_at: new Date().toISOString(),
  };
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
