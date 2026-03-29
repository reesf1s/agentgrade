import { after, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";
import { detectPatterns } from "@/lib/scoring";
import type { FailurePattern, QualityScore } from "@/lib/db/types";
import {
  dedupeFailurePatterns,
} from "@/lib/patterns/normalize";
import {
  filterPatternsWithUsableScores,
  isAggregateEligibleScore,
} from "@/lib/scoring/quality-score-status";
import { syncFailurePatterns } from "@/lib/patterns/store";

async function loadUsableScoreMap(conversationIds: string[]) {
  const { data } = await supabaseAdmin
    .from("quality_scores")
    .select("conversation_id, overall_score, flags, claim_analysis, confidence_level, structural_metrics, scoring_model_version")
    .in("conversation_id", conversationIds);

  const map = new Map<string, boolean>();

  for (const row of data || []) {
    map.set(
      row.conversation_id as string,
      isAggregateEligibleScore(
        row as {
          overall_score?: number;
          flags?: string[] | null;
          claim_analysis?: QualityScore["claim_analysis"];
          confidence_level?: "high" | "medium" | "low";
          scoring_model_version?: string | null;
          structural_metrics?: { confidence_level?: "high" | "medium" | "low" };
        }
      )
    );
  }

  return map;
}

/**
 * GET /api/patterns
 * Returns failure patterns. If none exist yet, schedule a refresh without blocking the response.
 */
export async function GET() {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = ctx.workspace.id;

    // Return existing unresolved patterns
    const { data: patterns, error } = await supabaseAdmin
      .from("failure_patterns")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("is_resolved", false)
      .order("detected_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: "Failed to fetch patterns" }, { status: 500 });
    }

    const dedupedPatterns = await filterPatternsWithUsableScores(
      dedupeFailurePatterns((patterns || []) as FailurePattern[]),
      loadUsableScoreMap
    );

    if (!patterns || patterns.length === 0) {
      after(async () => {
        try {
          await detectAndStorePatterns(workspaceId);
        } catch (refreshError) {
          console.error("Background pattern refresh failed:", refreshError);
        }
      });
    }

    return NextResponse.json({ patterns: dedupedPatterns });
  } catch (error) {
    console.error("Patterns API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/patterns
 * Re-run pattern detection against recent conversations.
 */
export async function POST() {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await detectAndStorePatterns(ctx.workspace.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Pattern detection error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function detectAndStorePatterns(workspaceId: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: convs } = await supabaseAdmin
    .from("conversations")
    .select("id, created_at, quality_scores:quality_scores(*)")
    .eq("workspace_id", workspaceId)
    .gte("created_at", thirtyDaysAgo.toISOString())
    .not("quality_scores", "is", null);

  if (!convs || convs.length < 3) return;

  const scoredConversations = convs
    .filter((c) =>
      isAggregateEligibleScore(
        c.quality_scores as {
          overall_score?: number;
          flags?: string[] | null;
          claim_analysis?: QualityScore["claim_analysis"];
          confidence_level?: "high" | "medium" | "low";
          scoring_model_version?: string | null;
          structural_metrics?: { confidence_level?: "high" | "medium" | "low" };
        } | null
      )
    )
    .map((c) => {
      const qs = (c.quality_scores as unknown) as {
        overall_score: number;
        hallucination_score?: number;
        flags?: string[];
        claim_analysis?: unknown[];
        prompt_improvements?: unknown[];
        knowledge_gaps?: unknown[];
      };
      return {
        id: c.id,
        platform: "workspace",
        created_at: c.created_at,
        quality_score: {
          overall_score: qs.overall_score,
          hallucination_score: qs.hallucination_score,
          flags: qs.flags || [],
          claim_analysis: qs.claim_analysis || [],
          prompt_improvements: qs.prompt_improvements || [],
          knowledge_gaps: qs.knowledge_gaps || [],
        },
        was_escalated: false,
      };
    });

  if (scoredConversations.length < 3) return;

  const newPatterns = dedupeFailurePatterns(
    detectPatterns(
      scoredConversations as unknown as Parameters<typeof detectPatterns>[0]
    ).map((pattern) => ({
      workspace_id: workspaceId,
      ...pattern,
    }))
  );
  await syncFailurePatterns(workspaceId, newPatterns);
}
