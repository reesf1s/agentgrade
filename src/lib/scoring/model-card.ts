import type { LearnedCalibrationSummary } from "./calibration-model";

export const AGENTGRADE_MODEL_CARD = {
  scorer_name: "AgentGrade Quality Scorer",
  version_family: "v3",
  base_evaluator: {
    provider: "openai",
    model: "gpt-5.4-mini",
    role: "Primary LLM judge for rubric scoring, claim checks, and intervention generation.",
  },
  learned_layers: [
    {
      name: "Deterministic guardrails",
      status: "live",
      purpose: "Correct obviously bad scorer outcomes, protect against false positives, and provide cheap fast-path scoring for low-complexity cases.",
    },
    {
      name: "Human-label calibration model",
      status: "live",
      purpose:
        "Train a lightweight supervised model on top of the LLM judge so scores can be corrected toward human ground truth by workspace and, when opted in, across organizations.",
    },
    {
      name: "Foundation model fine-tuning",
      status: "not_live",
      purpose:
        "Future path once enough high-quality labeled data, evaluation coverage, and data governance are in place.",
    },
  ],
  privacy: {
    workspace_private:
      "Workspace-private labels are used only to calibrate that organization's scoring behavior.",
    global_anonymous:
      "Global learning uses anonymized scorer features and labels only. Raw transcript text is not exported into the shared calibration model.",
  },
  strengths: [
    "Rubric-based evaluation rather than single opaque scores",
    "Claim-level verification and confidence-aware scoring",
    "Human overrides and gold-set labeling built into the product",
    "Cheap deterministic scoring path for obvious cases to protect margins",
  ],
  current_limitations: [
    "Base scoring is still LLM-as-a-judge, not an end-to-end fine-tuned proprietary model",
    "Calibration quality depends on label volume and label quality",
    "Global learning is only as strong as opted-in anonymized label coverage",
  ],
  active_improvements: [
    "High-value review queues push teams toward the most useful conversations to label first",
    "Workspace-private calibration builds a stronger scorer for each customer without leaking their data",
    "Optional shared learning uses anonymized score features so the global model improves without pooling raw transcript text",
    "Coverage health checks highlight weak score dimensions before they become blind spots in production",
  ],
  path_to_proprietary_model: [
    "Accumulate a high-quality gold set across task types, risk levels, and industries",
    "Track inter-rater agreement and benchmark scorer regressions continuously",
    "Train internal ranking or regression models for score prediction and confidence estimation",
    "Graduate to provider fine-tuning or an internal scoring model once coverage and governance are sufficient",
  ],
} as const;

export function inferTrainingStage(summary: LearnedCalibrationSummary) {
  const workspaceLabels = summary.workspace_private_labels;
  const globalLabels = summary.global_shared_labels;

  if (workspaceLabels >= 150 || globalLabels >= 1000) {
    return {
      key: "adaptive",
      label: "Adaptive calibration",
      description:
        "The scorer is meaningfully learning from human labels and has enough data to influence production scoring in a stable way.",
    } as const;
  }

  if (workspaceLabels >= 30 || globalLabels >= 250) {
    return {
      key: "calibrating",
      label: "Calibrating",
      description:
        "The calibration model is live and useful, but still building coverage across more scenarios.",
    } as const;
  }

  return {
    key: "bootstrapping",
    label: "Bootstrapping",
    description:
      "The scorer is primarily rubric- and guardrail-driven while it collects enough gold-set labels to learn reliably.",
    } as const;
}
