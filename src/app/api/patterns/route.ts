import { after, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";
import { detectPatterns } from "@/lib/scoring";
import type { FailurePattern } from "@/lib/db/types";
import {
  dedupeFailurePatterns,
  getPatternFingerprint,
  mergePatternGroup,
} from "@/lib/patterns/normalize";

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

    const dedupedPatterns = dedupeFailurePatterns((patterns || []) as FailurePattern[]);

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
    .filter((c) => c.quality_scores)
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

  const { data: existingPatterns } = await supabaseAdmin
    .from("failure_patterns")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("is_resolved", false);

  const existingByFingerprint = new Map<string, FailurePattern[]>();

  for (const rawPattern of ((existingPatterns || []) as FailurePattern[])) {
    const fingerprint = getPatternFingerprint(rawPattern);
    const current = existingByFingerprint.get(fingerprint) || [];
    current.push(rawPattern);
    existingByFingerprint.set(fingerprint, current);
  }

  for (const pattern of newPatterns) {
    const fingerprint = getPatternFingerprint(pattern);
    const existingGroup = existingByFingerprint.get(fingerprint) || [];

    if (existingGroup.length === 0) {
      await supabaseAdmin.from("failure_patterns").insert({
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
      continue;
    }

    const canonical = mergePatternGroup(existingGroup);
    const primary = existingGroup.find((candidate) => candidate.id === canonical.id) || existingGroup[0];

    await supabaseAdmin
      .from("failure_patterns")
      .update({
        title: pattern.title,
        description: pattern.description,
        affected_conversation_ids: [...new Set([...(primary.affected_conversation_ids || []), ...pattern.affected_conversation_ids])],
        severity: pattern.severity,
        recommendation: pattern.recommendation,
        prompt_fix: pattern.prompt_fix,
        knowledge_base_suggestion: pattern.knowledge_base_suggestion,
        detected_at: new Date().toISOString(),
      })
      .eq("id", primary.id);

    const duplicateIds = existingGroup
      .filter((candidate) => candidate.id !== primary.id)
      .map((candidate) => candidate.id);

    if (duplicateIds.length > 0) {
      await supabaseAdmin
        .from("failure_patterns")
        .update({
          is_resolved: true,
          resolved_at: new Date().toISOString(),
        })
        .in("id", duplicateIds);
    }
  }
}
