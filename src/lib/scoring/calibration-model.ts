import { supabaseAdmin } from "@/lib/supabase";
import type { QualityScore, StructuralMetrics } from "@/lib/db/types";
import {
  getCalibrationExampleKind,
  getCalibrationShareScope,
  isGoldSetConversation,
  type CalibrationExampleKind,
  type CalibrationShareScope,
} from "@/lib/calibration";

const CACHE_TTL_MS = 1000 * 60 * 5;
const MIN_DIMENSION_LABELS = 6;
const RIDGE_LAMBDA = 0.18;

type SupportedDimension =
  | "overall"
  | "accuracy"
  | "hallucination"
  | "resolution"
  | "escalation"
  | "tone"
  | "sentiment";

type CalibrationExample = {
  dimension: SupportedDimension;
  label: number;
  created_at: string;
  workspace_id: string;
  share_scope: CalibrationShareScope;
  example_kind: CalibrationExampleKind;
  features: number[];
};

type DimensionModel = {
  intercept: number;
  weights: number[];
  mae: number;
  label_count: number;
  blend_weight: number;
};

type ModelBundle = {
  dimensions: Partial<Record<SupportedDimension, DimensionModel>>;
  label_count: number;
  last_label_at?: string;
  mean_abs_error: number;
  trained_dimensions: SupportedDimension[];
};

type CacheEntry = {
  expiresAt: number;
  summary: LearnedCalibrationSummary;
  workspaceBundle: ModelBundle | null;
  globalBundle: ModelBundle | null;
};

const cache = new Map<string, CacheEntry>();

export interface LearnedCalibrationSummary {
  mode: "inactive" | "active";
  training_mode: "llm_judge_plus_calibration_model";
  workspace_private_labels: number;
  global_shared_labels: number;
  workspace_model: {
    active: boolean;
    label_count: number;
    trained_dimensions: SupportedDimension[];
    mean_abs_error?: number;
    last_label_at?: string;
  };
  global_model: {
    active: boolean;
    label_count: number;
    trained_dimensions: SupportedDimension[];
    mean_abs_error?: number;
    last_label_at?: string;
  };
}

type CalibratableScore = Pick<
  QualityScore,
  | "overall_score"
  | "accuracy_score"
  | "hallucination_score"
  | "resolution_score"
  | "tone_score"
  | "sentiment_score"
  | "edge_case_score"
  | "escalation_score"
  | "claim_analysis"
  | "flags"
  | "prompt_improvements"
  | "knowledge_gaps"
  | "confidence_level"
> & {
  structural_metrics?: StructuralMetrics;
};

export interface LearnedCalibrationApplication {
  adjusted: {
    overall_score: number;
    accuracy_score: number;
    hallucination_score: number;
    resolution_score: number;
    tone_score: number;
    sentiment_score: number;
    escalation_score: number;
  };
  metadata: {
    applied: boolean;
    workspace_model_applied: boolean;
    global_model_applied: boolean;
    workspace_private_labels: number;
    global_shared_labels: number;
  };
}

type CalibrationDataRow = {
  id: string;
  quality_score_id: string;
  dimension: string;
  override_score: number;
  created_at: string;
};

type ScoreRow = {
  id: string;
  conversation_id: string;
  overall_score: number;
  accuracy_score?: number | null;
  hallucination_score?: number | null;
  resolution_score?: number | null;
  tone_score?: number | null;
  sentiment_score?: number | null;
  edge_case_score?: number | null;
  escalation_score?: number | null;
  structural_metrics?: Record<string, unknown> | null;
  claim_analysis?: Array<Record<string, unknown>> | null;
  flags?: string[] | null;
  prompt_improvements?: Array<Record<string, unknown>> | null;
  knowledge_gaps?: Array<Record<string, unknown>> | null;
};

type ConversationRow = {
  id: string;
  workspace_id: string;
  metadata?: Record<string, unknown> | null;
};

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

function confidenceToNumber(score: CalibratableScore | ScoreRow) {
  const direct =
    "confidence_level" in score && typeof score.confidence_level === "string"
      ? score.confidence_level
      : undefined;
  const structural =
    typeof score.structural_metrics?.confidence_level === "string"
      ? String(score.structural_metrics.confidence_level)
      : undefined;
  const level = direct || structural;

  if (level === "high") return 1;
  if (level === "medium") return 0.66;
  return 0.33;
}

function rawScoreForDimension(score: CalibratableScore | ScoreRow, dimension: SupportedDimension) {
  switch (dimension) {
    case "overall":
      return score.overall_score;
    case "accuracy":
      return score.accuracy_score ?? score.overall_score;
    case "hallucination":
      return score.hallucination_score ?? score.overall_score;
    case "resolution":
      return score.resolution_score ?? score.overall_score;
    case "escalation":
      return score.escalation_score ?? 0.85;
    case "tone":
      return score.tone_score ?? score.overall_score;
    case "sentiment":
      return score.sentiment_score ?? 0.6;
    default:
      return score.overall_score;
  }
}

function featureVector(score: CalibratableScore | ScoreRow, dimension: SupportedDimension) {
  const flags = Array.isArray(score.flags) ? score.flags : [];
  const claims = Array.isArray(score.claim_analysis) ? score.claim_analysis : [];
  const promptImprovements = Array.isArray(score.prompt_improvements) ? score.prompt_improvements : [];
  const knowledgeGaps = Array.isArray(score.knowledge_gaps) ? score.knowledge_gaps : [];
  const hardFail = score.structural_metrics?.hard_fail ? 1 : 0;

  return [
    1,
    rawScoreForDimension(score, dimension),
    score.overall_score,
    score.accuracy_score ?? score.overall_score,
    score.hallucination_score ?? score.overall_score,
    score.resolution_score ?? score.overall_score,
    score.tone_score ?? score.overall_score,
    score.sentiment_score ?? 0.6,
    score.edge_case_score ?? 0.8,
    score.escalation_score ?? 0.85,
    confidenceToNumber(score),
    Math.min(flags.length / 10, 1),
    Math.min(claims.length / 8, 1),
    Math.min(promptImprovements.length / 6, 1),
    Math.min(knowledgeGaps.length / 6, 1),
    hardFail,
  ];
}

function solveLinearSystem(matrix: number[][], vector: number[]) {
  const size = vector.length;
  const a = matrix.map((row, rowIndex) => [...row, vector[rowIndex]]);

  for (let pivot = 0; pivot < size; pivot += 1) {
    let maxRow = pivot;
    for (let candidate = pivot + 1; candidate < size; candidate += 1) {
      if (Math.abs(a[candidate][pivot]) > Math.abs(a[maxRow][pivot])) {
        maxRow = candidate;
      }
    }

    if (Math.abs(a[maxRow][pivot]) < 1e-8) {
      continue;
    }

    if (maxRow !== pivot) {
      const temp = a[pivot];
      a[pivot] = a[maxRow];
      a[maxRow] = temp;
    }

    const pivotValue = a[pivot][pivot];
    for (let col = pivot; col <= size; col += 1) {
      a[pivot][col] /= pivotValue;
    }

    for (let row = 0; row < size; row += 1) {
      if (row === pivot) continue;
      const factor = a[row][pivot];
      if (factor === 0) continue;
      for (let col = pivot; col <= size; col += 1) {
        a[row][col] -= factor * a[pivot][col];
      }
    }
  }

  return a.map((row) => row[size] ?? 0);
}

function trainDimensionModel(examples: CalibrationExample[]): DimensionModel | null {
  if (examples.length < MIN_DIMENSION_LABELS) {
    return null;
  }

  const ordered = [...examples].sort((left, right) => left.created_at.localeCompare(right.created_at));
  const holdoutSize = ordered.length >= 10 ? Math.max(2, Math.floor(ordered.length * 0.2)) : 0;
  const trainSet = holdoutSize > 0 ? ordered.slice(0, -holdoutSize) : ordered;
  const holdoutSet = holdoutSize > 0 ? ordered.slice(-holdoutSize) : ordered;

  const featureCount = trainSet[0]?.features.length || 0;
  if (!featureCount) return null;

  const xtx = Array.from({ length: featureCount }, () => Array(featureCount).fill(0));
  const xty = Array(featureCount).fill(0);

  for (const example of trainSet) {
    for (let row = 0; row < featureCount; row += 1) {
      xty[row] += example.features[row] * example.label;
      for (let col = 0; col < featureCount; col += 1) {
        xtx[row][col] += example.features[row] * example.features[col];
      }
    }
  }

  for (let index = 0; index < featureCount; index += 1) {
    xtx[index][index] += RIDGE_LAMBDA;
  }

  const coefficients = solveLinearSystem(xtx, xty);
  const intercept = coefficients[0] ?? 0;
  const weights = coefficients.slice(1);

  const mae =
    holdoutSet.reduce((total, example) => {
      const prediction = predictWithWeights(example.features, intercept, weights);
      return total + Math.abs(prediction - example.label);
    }, 0) / Math.max(holdoutSet.length, 1);

  const reliability = clamp(1 - mae);
  const sampleStrength = clamp((examples.length - MIN_DIMENSION_LABELS + 1) / 24);
  const blendWeight = clamp(0.18 + reliability * 0.22 + sampleStrength * 0.18);

  return {
    intercept,
    weights,
    mae,
    label_count: examples.length,
    blend_weight: Math.min(blendWeight, 0.55),
  };
}

function predictWithWeights(features: number[], intercept: number, weights: number[]) {
  let total = intercept;
  for (let index = 1; index < features.length; index += 1) {
    total += (weights[index - 1] ?? 0) * features[index];
  }
  return clamp(total);
}

function buildModelBundle(examples: CalibrationExample[]) {
  if (examples.length === 0) return null;

  const dimensions = {} as Partial<Record<SupportedDimension, DimensionModel>>;

  const trainedDimensions = Array.from(
    new Set(examples.map((example) => example.dimension))
  ) as SupportedDimension[];

  for (const dimension of trainedDimensions) {
    const model = trainDimensionModel(examples.filter((example) => example.dimension === dimension));
    if (model) {
      dimensions[dimension] = model;
    }
  }

  const activeDimensions = Object.keys(dimensions) as SupportedDimension[];
  if (activeDimensions.length === 0) {
    return null;
  }

  const meanAbsError =
    activeDimensions.reduce((total, dimension) => total + (dimensions[dimension]?.mae ?? 0), 0) /
    activeDimensions.length;

  return {
    dimensions,
    label_count: examples.length,
    mean_abs_error: meanAbsError,
    trained_dimensions: activeDimensions,
    last_label_at: [...examples]
      .sort((left, right) => right.created_at.localeCompare(left.created_at))[0]?.created_at,
  } satisfies ModelBundle;
}

async function loadCalibrationExamples(workspaceId: string) {
  const overridesQuery = await supabaseAdmin
    .from("quality_overrides")
    .select("id, quality_score_id, dimension, override_score, created_at")
    .order("created_at", { ascending: false })
    .limit(4000);

  const overrideRows = (overridesQuery.data || []) as CalibrationDataRow[];
  if (overrideRows.length === 0) {
    return {
      workspaceExamples: [] as CalibrationExample[],
      globalExamples: [] as CalibrationExample[],
    };
  }

  const qualityScoreIds = [...new Set(overrideRows.map((row) => row.quality_score_id))];
  const scoresQuery = await supabaseAdmin
    .from("quality_scores")
    .select(
      "id, conversation_id, overall_score, accuracy_score, hallucination_score, resolution_score, tone_score, sentiment_score, edge_case_score, escalation_score, structural_metrics, claim_analysis, flags, prompt_improvements, knowledge_gaps"
    )
    .in("id", qualityScoreIds);
  const scoreRows = (scoresQuery.data || []) as ScoreRow[];
  const scoreMap = new Map(scoreRows.map((row) => [row.id, row]));

  const conversationIds = [...new Set(scoreRows.map((row) => row.conversation_id))];
  const conversationsQuery = await supabaseAdmin
    .from("conversations")
    .select("id, workspace_id, metadata")
    .in("id", conversationIds);
  const conversationRows = (conversationsQuery.data || []) as ConversationRow[];
  const conversationMap = new Map(conversationRows.map((row) => [row.id, row]));

  const workspaceExamples: CalibrationExample[] = [];
  const globalExamples: CalibrationExample[] = [];

  for (const row of overrideRows) {
    const dimension = row.dimension as SupportedDimension;
    if (!["overall", "accuracy", "hallucination", "resolution", "escalation", "tone", "sentiment"].includes(dimension)) {
      continue;
    }

    const score = scoreMap.get(row.quality_score_id);
    if (!score) continue;

    const conversation = conversationMap.get(score.conversation_id);
    if (!conversation) continue;

    const metadata = conversation.metadata || {};
    if (!isGoldSetConversation(metadata) && !metadata.manual_calibration) {
      continue;
    }

    const example: CalibrationExample = {
      dimension,
      label: clamp(row.override_score),
      created_at: row.created_at,
      workspace_id: conversation.workspace_id,
      share_scope: getCalibrationShareScope(metadata),
      example_kind: getCalibrationExampleKind(metadata),
      features: featureVector(score, dimension),
    };

    if (conversation.workspace_id === workspaceId) {
      workspaceExamples.push(example);
    }

    if (example.share_scope === "global_anonymous") {
      globalExamples.push(example);
    }
  }

  return { workspaceExamples, globalExamples };
}

async function loadBundles(workspaceId: string) {
  const cached = cache.get(workspaceId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached;
  }

  const { workspaceExamples, globalExamples } = await loadCalibrationExamples(workspaceId);
  const workspaceBundle = buildModelBundle(workspaceExamples);
  const globalBundle = buildModelBundle(globalExamples);

  const summary: LearnedCalibrationSummary = {
    mode: workspaceBundle || globalBundle ? "active" : "inactive",
    training_mode: "llm_judge_plus_calibration_model",
    workspace_private_labels: workspaceExamples.length,
    global_shared_labels: globalExamples.length,
    workspace_model: {
      active: Boolean(workspaceBundle),
      label_count: workspaceBundle?.label_count || 0,
      trained_dimensions: workspaceBundle?.trained_dimensions || [],
      mean_abs_error: workspaceBundle?.mean_abs_error,
      last_label_at: workspaceBundle?.last_label_at,
    },
    global_model: {
      active: Boolean(globalBundle),
      label_count: globalBundle?.label_count || 0,
      trained_dimensions: globalBundle?.trained_dimensions || [],
      mean_abs_error: globalBundle?.mean_abs_error,
      last_label_at: globalBundle?.last_label_at,
    },
  };

  const entry: CacheEntry = {
    expiresAt: Date.now() + CACHE_TTL_MS,
    summary,
    workspaceBundle,
    globalBundle,
  };

  cache.set(workspaceId, entry);
  return entry;
}

function calibrateDimension(
  dimension: SupportedDimension,
  score: CalibratableScore,
  workspaceBundle: ModelBundle | null,
  globalBundle: ModelBundle | null
) {
  const raw = rawScoreForDimension(score, dimension);
  const features = featureVector(score, dimension);
  let totalWeight = 0;
  let blended = raw;
  let workspaceApplied = false;
  let globalApplied = false;

  const workspaceModel = workspaceBundle?.dimensions[dimension];
  if (workspaceModel) {
    const predicted = predictWithWeights(features, workspaceModel.intercept, workspaceModel.weights);
    const weight = workspaceModel.blend_weight * 0.65;
    blended = blended * (1 - weight) + predicted * weight;
    totalWeight += weight;
    workspaceApplied = true;
  }

  const globalModel = globalBundle?.dimensions[dimension];
  if (globalModel) {
    const predicted = predictWithWeights(features, globalModel.intercept, globalModel.weights);
    const remainingWeight = Math.max(0, 0.68 - totalWeight);
    const weight = Math.min(globalModel.blend_weight * 0.35, remainingWeight);
    blended = blended * (1 - weight) + predicted * weight;
    globalApplied = weight > 0;
  }

  return {
    score: clamp(blended),
    workspaceApplied,
    globalApplied,
  };
}

export async function getLearnedCalibrationSummary(workspaceId: string) {
  const bundles = await loadBundles(workspaceId);
  return bundles.summary;
}

export async function applyLearnedCalibration(
  workspaceId: string,
  score: CalibratableScore
): Promise<LearnedCalibrationApplication> {
  const bundles = await loadBundles(workspaceId);
  const dimensions: SupportedDimension[] = [
    "accuracy",
    "hallucination",
    "resolution",
    "tone",
    "sentiment",
    "escalation",
  ];

  const adjustedScores = {
    overall_score: score.overall_score,
    accuracy_score: score.accuracy_score ?? score.overall_score,
    hallucination_score: score.hallucination_score ?? score.overall_score,
    resolution_score: score.resolution_score ?? score.overall_score,
    tone_score: score.tone_score ?? score.overall_score,
    sentiment_score: score.sentiment_score ?? 0.6,
    escalation_score: score.escalation_score ?? 0.85,
  };

  let workspaceApplied = false;
  let globalApplied = false;

  for (const dimension of dimensions) {
    const result = calibrateDimension(dimension, score, bundles.workspaceBundle, bundles.globalBundle);
    adjustedScores[`${dimension}_score` as keyof typeof adjustedScores] = result.score;
    workspaceApplied = workspaceApplied || result.workspaceApplied;
    globalApplied = globalApplied || result.globalApplied;
  }

  const overallResult = calibrateDimension("overall", score, bundles.workspaceBundle, bundles.globalBundle);
  adjustedScores.overall_score = clamp(
    overallResult.score * 0.35 +
      (adjustedScores.accuracy_score * 0.2 +
        adjustedScores.hallucination_score * 0.25 +
        adjustedScores.resolution_score * 0.25 +
        adjustedScores.tone_score * 0.15 +
        adjustedScores.sentiment_score * 0.1 +
        (score.edge_case_score ?? 0.8) * 0.03 +
        adjustedScores.escalation_score * 0.02) *
        0.65
  );
  workspaceApplied = workspaceApplied || overallResult.workspaceApplied;
  globalApplied = globalApplied || overallResult.globalApplied;

  return {
    adjusted: adjustedScores,
    metadata: {
      applied: workspaceApplied || globalApplied,
      workspace_model_applied: workspaceApplied,
      global_model_applied: globalApplied,
      workspace_private_labels: bundles.summary.workspace_private_labels,
      global_shared_labels: bundles.summary.global_shared_labels,
    },
  };
}
