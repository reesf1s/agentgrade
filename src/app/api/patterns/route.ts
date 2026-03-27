import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";
import { detectPatterns } from "@/lib/scoring";

/**
 * GET /api/patterns
 * Returns unresolved failure patterns. Auto-detects from recent conversations if none exist.
 */
export async function GET() {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = ctx.workspace.id;

    const { data: patterns, error } = await supabaseAdmin
      .from("ag_failure_patterns")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("is_resolved", false)
      .order("detected_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: "Failed to fetch patterns" }, { status: 500 });
    }

    // Auto-detect from recent conversations if none exist
    if (!patterns || patterns.length === 0) {
      await detectAndStorePatterns(workspaceId);
      const { data: freshPatterns } = await supabaseAdmin
        .from("ag_failure_patterns")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("is_resolved", false)
        .order("detected_at", { ascending: false });
      return NextResponse.json({ patterns: freshPatterns || [] });
    }

    return NextResponse.json({ patterns });
  } catch (error) {
    console.error("Patterns API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/patterns
 * Re-runs pattern detection against recent conversations.
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

// Shared pattern detection helper used by GET (auto-detect) and POST (manual trigger)
export async function detectAndStorePatterns(workspaceId: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: convs } = await supabaseAdmin
    .from("ag_conversations")
    .select("id, created_at, was_escalated, ag_quality_scores(*)")
    .eq("workspace_id", workspaceId)
    .gte("created_at", thirtyDaysAgo.toISOString())
    .not("ag_quality_scores", "is", null);

  if (!convs || convs.length < 3) return;

  const scoredConversations = convs
    .filter((c) => c.ag_quality_scores)
    .map((c) => {
      const qs = (c.ag_quality_scores as unknown) as {
        overall_score: number;
        hallucination_score?: number;
        flags?: string[];
        claim_analysis?: unknown[];
        prompt_improvements?: unknown[];
        knowledge_gaps?: unknown[];
      };
      return {
        id: c.id,
        created_at: c.created_at,
        was_escalated: c.was_escalated,
        quality_score: {
          overall_score: qs.overall_score,
          hallucination_score: qs.hallucination_score,
          flags: qs.flags || [],
          claim_analysis: qs.claim_analysis || [],
          prompt_improvements: qs.prompt_improvements || [],
          knowledge_gaps: qs.knowledge_gaps || [],
        },
      };
    });

  if (scoredConversations.length < 3) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const newPatterns = detectPatterns(scoredConversations as any);

  for (const pattern of newPatterns) {
    // Upsert by title — avoid creating duplicates for the same pattern
    const { data: existing } = await supabaseAdmin
      .from("ag_failure_patterns")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("title", pattern.title)
      .eq("is_resolved", false)
      .single();

    if (!existing) {
      await supabaseAdmin.from("ag_failure_patterns").insert({
        workspace_id: workspaceId,
        pattern_type: pattern.pattern_type,
        title: pattern.title,
        description: pattern.description,
        affected_conversation_ids: pattern.affected_conversation_ids,
        severity: pattern.severity,
        recommendation: pattern.recommendation,
        prompt_fix: pattern.prompt_fix,
        knowledge_base_suggestion: pattern.knowledge_base_suggestion,
      });
    }
  }
}
