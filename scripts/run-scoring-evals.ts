import fs from "node:fs";
import path from "node:path";
import { runScoringPipeline } from "@/lib/scoring";
import type { Message, QualityScore } from "@/lib/db/types";

type EvalExpectation = {
  overall_min?: number;
  overall_max?: number;
  accuracy_min?: number;
  accuracy_max?: number;
  hallucination_min?: number;
  hallucination_max?: number;
  resolution_min?: number;
  resolution_max?: number;
  escalation_min?: number;
  escalation_max?: number;
  confidence?: "high" | "medium" | "low";
  required_flags?: string[];
  forbidden_flags?: string[];
};

type EvalCase = {
  id: string;
  description: string;
  knowledgeBaseContext?: string[];
  messages: Array<{
    role: Message["role"];
    content: string;
    timestamp?: string;
    metadata?: Record<string, unknown>;
  }>;
  expected: EvalExpectation;
};

type EvalResult = {
  id: string;
  passed: boolean;
  failures: string[];
  score: Omit<QualityScore, "id" | "conversation_id" | "scored_at">;
};

function asMessage(message: EvalCase["messages"][number], index: number): Message {
  return {
    id: `${index + 1}`,
    conversation_id: "eval",
    role: message.role,
    content: message.content,
    timestamp: message.timestamp || new Date(Date.UTC(2026, 2, 28, 10, index, 0)).toISOString(),
    metadata: message.metadata || {},
  };
}

function withinMin(label: string, actual: number | undefined, expected?: number): string | null {
  if (expected === undefined || actual === undefined) return null;
  return actual >= expected ? null : `${label} ${actual.toFixed(2)} < min ${expected.toFixed(2)}`;
}

function withinMax(label: string, actual: number | undefined, expected?: number): string | null {
  if (expected === undefined || actual === undefined) return null;
  return actual <= expected ? null : `${label} ${actual.toFixed(2)} > max ${expected.toFixed(2)}`;
}

function evaluateExpectations(
  result: Omit<QualityScore, "id" | "conversation_id" | "scored_at">,
  expected: EvalExpectation
): string[] {
  const failures = [
    withinMin("overall", result.overall_score, expected.overall_min),
    withinMax("overall", result.overall_score, expected.overall_max),
    withinMin("accuracy", result.accuracy_score, expected.accuracy_min),
    withinMax("accuracy", result.accuracy_score, expected.accuracy_max),
    withinMin("hallucination", result.hallucination_score, expected.hallucination_min),
    withinMax("hallucination", result.hallucination_score, expected.hallucination_max),
    withinMin("resolution", result.resolution_score, expected.resolution_min),
    withinMax("resolution", result.resolution_score, expected.resolution_max),
    withinMin("escalation", result.escalation_score, expected.escalation_min),
    withinMax("escalation", result.escalation_score, expected.escalation_max),
  ].filter((value): value is string => Boolean(value));

  if (expected.confidence && result.confidence_level !== expected.confidence) {
    failures.push(
      `confidence ${result.confidence_level || "missing"} !== expected ${expected.confidence}`
    );
  }

  for (const flag of expected.required_flags || []) {
    if (!(result.flags || []).includes(flag)) {
      failures.push(`missing required flag: ${flag}`);
    }
  }

  for (const flag of expected.forbidden_flags || []) {
    if ((result.flags || []).includes(flag)) {
      failures.push(`forbidden flag present: ${flag}`);
    }
  }

  return failures;
}

async function main() {
  const datasetPath = path.join(process.cwd(), "evals", "scoring-golden.json");
  const cases = JSON.parse(fs.readFileSync(datasetPath, "utf8")) as EvalCase[];

  const results: EvalResult[] = [];
  for (const testCase of cases) {
    const score = await runScoringPipeline({
      messages: testCase.messages.map(asMessage),
      knowledgeBaseContext: testCase.knowledgeBaseContext,
    });

    const failures = evaluateExpectations(score, testCase.expected);
    results.push({
      id: testCase.id,
      passed: failures.length === 0,
      failures,
      score,
    });
  }

  const lines = [
    "AgentGrade scoring evals",
    "",
    "| Case | Result | Overall | Accuracy | Hallucination | Resolution | Confidence |",
    "| --- | --- | ---: | ---: | ---: | ---: | --- |",
    ...results.map(
      (result) =>
        `| ${result.id} | ${result.passed ? "PASS" : "FAIL"} | ${(result.score.overall_score * 100).toFixed(0)} | ${((result.score.accuracy_score || 0) * 100).toFixed(0)} | ${((result.score.hallucination_score || 0) * 100).toFixed(0)} | ${((result.score.resolution_score || 0) * 100).toFixed(0)} | ${result.score.confidence_level || "—"} |`
    ),
  ];

  console.log(lines.join("\n"));

  const failed = results.filter((result) => !result.passed);
  if (failed.length > 0) {
    console.log("\nFailures:");
    for (const result of failed) {
      console.log(`\n- ${result.id}`);
      for (const failure of result.failures) {
        console.log(`  - ${failure}`);
      }
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
