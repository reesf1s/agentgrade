import fs from "node:fs";
import path from "node:path";
import { supabaseAdmin } from "@/lib/supabase";

type OverrideRow = {
  id: string;
  quality_score_id: string;
  dimension: string;
  original_score: number;
  override_score: number;
  reason?: string | null;
  created_at: string;
  overridden_by: string;
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
  flags?: string[] | null;
  scoring_model_version?: string | null;
};

type ConversationRow = {
  id: string;
  workspace_id: string;
  customer_identifier?: string | null;
  platform: string;
  created_at: string;
  metadata?: Record<string, unknown> | null;
};

async function main() {
  const scope = process.argv.includes("--all") ? "all" : "shared-only";
  const outputArg = process.argv.find((arg) => arg.startsWith("--out="));
  const outputPath =
    outputArg?.split("=")[1] ||
    path.join(process.cwd(), "evals", "generated", `calibration-${scope}.json`);

  const overridesRes = await supabaseAdmin
    .from("quality_overrides")
    .select("id, quality_score_id, dimension, original_score, override_score, reason, created_at, overridden_by")
    .order("created_at", { ascending: false })
    .limit(5000);

  if (overridesRes.error) {
    throw new Error(`Failed to load overrides: ${overridesRes.error.message}`);
  }

  const overrides = (overridesRes.data || []) as OverrideRow[];
  const qualityScoreIds = [...new Set(overrides.map((row) => row.quality_score_id))];

  const scoresRes = await supabaseAdmin
    .from("quality_scores")
    .select(
      "id, conversation_id, overall_score, accuracy_score, hallucination_score, resolution_score, tone_score, sentiment_score, edge_case_score, escalation_score, structural_metrics, flags, scoring_model_version"
    )
    .in("id", qualityScoreIds);

  if (scoresRes.error) {
    throw new Error(`Failed to load quality scores: ${scoresRes.error.message}`);
  }

  const scores = (scoresRes.data || []) as ScoreRow[];
  const scoreMap = new Map(scores.map((row) => [row.id, row]));

  const conversationIds = [...new Set(scores.map((row) => row.conversation_id))];
  const conversationsRes = await supabaseAdmin
    .from("conversations")
    .select("id, workspace_id, customer_identifier, platform, created_at, metadata")
    .in("id", conversationIds);

  if (conversationsRes.error) {
    throw new Error(`Failed to load conversations: ${conversationsRes.error.message}`);
  }

  const conversations = (conversationsRes.data || []) as ConversationRow[];
  const conversationMap = new Map(conversations.map((row) => [row.id, row]));

  const dataset = overrides
    .map((override) => {
      const score = scoreMap.get(override.quality_score_id);
      if (!score) return null;

      const conversation = conversationMap.get(score.conversation_id);
      if (!conversation) return null;

      const metadata = conversation.metadata || {};
      const shareScope =
        metadata.calibration_share_scope === "global_anonymous"
          ? "global_anonymous"
          : "workspace_private";

      if (scope !== "all" && shareScope !== "global_anonymous") {
        return null;
      }

      return {
        item_id: override.id,
        dimension: override.dimension,
        label: override.override_score,
        original_score: override.original_score,
        reason: override.reason || null,
        created_at: override.created_at,
        scoring_model_version: score.scoring_model_version || null,
        share_scope: shareScope,
        example_kind:
          metadata.calibration_example_kind === "synthetic" ? "synthetic" : "real",
        workspace_hash: `ws_${conversation.workspace_id.slice(0, 8)}`,
        conversation: {
          platform: conversation.platform,
          created_at: conversation.created_at,
          manual_calibration: Boolean(metadata.manual_calibration),
        },
        scorer_features: {
          overall_score: score.overall_score,
          accuracy_score: score.accuracy_score ?? null,
          hallucination_score: score.hallucination_score ?? null,
          resolution_score: score.resolution_score ?? null,
          tone_score: score.tone_score ?? null,
          sentiment_score: score.sentiment_score ?? null,
          edge_case_score: score.edge_case_score ?? null,
          escalation_score: score.escalation_score ?? null,
          confidence_level:
            score.structural_metrics?.confidence_level ||
            score.structural_metrics?.confidence ||
            null,
          hard_fail: Boolean(score.structural_metrics?.hard_fail),
          flags: score.flags || [],
        },
      };
    })
    .filter(Boolean);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(dataset, null, 2));

  console.log(
    JSON.stringify(
      {
        ok: true,
        scope,
        output: outputPath,
        records: dataset.length,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
