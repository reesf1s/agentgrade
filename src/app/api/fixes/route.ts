import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";
import type { PromptImprovement, KnowledgeGap } from "@/lib/db/types";
import { buildDerivedFixFromPattern, classifyInterventionType } from "@/lib/fixes/derived";

function isMissingTableError(error: { code?: string } | null | undefined) {
  return error?.code === "PGRST205";
}

/**
 * GET /api/fixes
 * Returns suggested fixes for the workspace, derived from quality score analysis.
 * Fixes are synthesized from prompt_improvements and knowledge_gaps across scored conversations.
 *
 * Query params:
 *   status    — 'draft' | 'approved' | 'pushed' | 'verified' | 'dismissed' | 'all' (default: draft)
 *   fix_type  — 'prompt_improvement' | 'knowledge_gap'
 *   priority  — 'high' | 'medium' | 'low'
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = ctx.workspace.id;
    const { searchParams } = new URL(request.url);
    const rawStatus = searchParams.get("status") || "draft";
    const status = rawStatus === "pending" ? "draft" : rawStatus;
    const fixType = searchParams.get("fix_type");
    const priority = searchParams.get("priority");

    // Synthesize fixes from recent quality scores if the table is empty
    await ensureFixesSynthesized(workspaceId);

    let query = supabaseAdmin
      .from("suggested_fixes")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("occurrence_count", { ascending: false })
      .order("created_at", { ascending: false });

    if (status !== "all") {
      query = query.eq("status", status);
    }
    if (fixType) {
      query = query.eq("fix_type", fixType);
    }
    if (priority) {
      query = query.eq("priority", priority);
    }

    const { data, error } = await query;

    if (isMissingTableError(error)) {
      const { data: patterns, error: patternsError } = await supabaseAdmin
        .from("failure_patterns")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("is_resolved", false)
        .order("detected_at", { ascending: false });

      if (patternsError) {
        return NextResponse.json({ error: "Failed to fetch fallback fixes" }, { status: 500 });
      }

      let fixes = (patterns || []).map((pattern) =>
        buildDerivedFixFromPattern(pattern, workspaceId)
      );

      if (status !== "all") {
        fixes = fixes.filter((fix) => fix.status === status);
      }
      if (fixType) {
        fixes = fixes.filter((fix) => fix.fix_type === fixType);
      }
      if (priority) {
        fixes = fixes.filter((fix) => fix.priority === priority);
      }

      return NextResponse.json({
        fixes,
        note: "Showing fixes derived from failure patterns. Apply the suggested_fixes migration to enable approval, push, and verification persistence.",
      });
    }

    if (error) {
      return NextResponse.json({ error: "Failed to fetch fixes" }, { status: 500 });
    }

    return NextResponse.json({ fixes: data || [] });
  } catch (error) {
    console.error("Fixes GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── Synthesis helper ─────────────────────────────────────────────────────────

/**
 * Synthesize suggested fixes from recent quality scores.
 * Groups similar prompt improvements and knowledge gaps from the last 30 days.
 * Only runs if the fixes table is empty for this workspace.
 */
async function ensureFixesSynthesized(workspaceId: string) {
  const { data: existing } = await supabaseAdmin
    .from("suggested_fixes")
    .select("id")
    .eq("workspace_id", workspaceId)
    .limit(1);

  // The current live schema may not have suggested_fixes yet.
  // Degrade cleanly instead of throwing from every GET.
  if (!existing) {
    const { error: tableError } = await supabaseAdmin
      .from("suggested_fixes")
      .select("id", { count: "exact", head: true })
      .limit(1);

    if (isMissingTableError(tableError)) return;
  }

  if (existing && existing.length > 0) return; // already synthesized

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: conversations } = await supabaseAdmin
    .from("conversations")
    .select("id, quality_scores:quality_scores(prompt_improvements, knowledge_gaps)")
    .eq("workspace_id", workspaceId)
    .gte("created_at", thirtyDaysAgo.toISOString())
    .not("quality_scores", "is", null);

  if (!conversations || conversations.length === 0) return;

  // Aggregate prompt improvements by issue
  const improvementMap = new Map<string, { imp: PromptImprovement; count: number; convIds: string[] }>();
  // Aggregate knowledge gaps by topic
  const gapMap = new Map<string, { gap: KnowledgeGap; count: number; convIds: string[] }>();

  for (const conv of conversations) {
    const qs = conv.quality_scores as { prompt_improvements?: PromptImprovement[]; knowledge_gaps?: KnowledgeGap[] } | null;
    const convId = conv.id as string;

    for (const imp of qs?.prompt_improvements || []) {
      const key = imp.issue.toLowerCase().substring(0, 80);
      if (improvementMap.has(key)) {
        const entry = improvementMap.get(key)!;
        entry.count++;
        if (!entry.convIds.includes(convId)) entry.convIds.push(convId);
      } else {
        improvementMap.set(key, { imp, count: 1, convIds: [convId] });
      }
    }

    for (const gap of qs?.knowledge_gaps || []) {
      const key = gap.topic.toLowerCase().substring(0, 80);
      if (gapMap.has(key)) {
        const entry = gapMap.get(key)!;
        entry.count++;
        if (!entry.convIds.includes(convId)) entry.convIds.push(convId);
      } else {
        gapMap.set(key, { gap, count: 1, convIds: [convId] });
      }
    }
  }

  // Insert prompt improvement fixes (top 20 by frequency)
  const improvements = [...improvementMap.values()].sort((a, b) => b.count - a.count).slice(0, 20);
  const gaps = [...gapMap.values()].sort((a, b) => b.count - a.count).slice(0, 20);

  const fixesToInsert = [
    ...improvements.map(({ imp, count, convIds }) => ({
      workspace_id: workspaceId,
      fix_type: "prompt_improvement" as const,
      intervention_type: classifyInterventionType({
        pattern_type: "prompt_improvement",
        title: imp.issue,
        description: imp.current_behavior,
        prompt_fix: imp.recommended_prompt_change,
      }),
      title: imp.issue,
      description: imp.current_behavior,
      current_behavior: imp.current_behavior,
      recommended_change: imp.recommended_prompt_change,
      expected_impact: imp.expected_impact,
      priority: imp.priority,
      source_conversation_ids: convIds,
      occurrence_count: count,
      status: "draft" as const,
    })),
    ...gaps.map(({ gap, count, convIds }) => ({
      workspace_id: workspaceId,
      fix_type: "knowledge_gap" as const,
      intervention_type: classifyInterventionType({
        pattern_type: "knowledge_gap",
        title: gap.topic,
        description: gap.description,
        knowledge_base_suggestion: gap.suggested_content,
      }),
      title: gap.topic,
      description: gap.description,
      recommended_change: gap.suggested_content,
      expected_impact: `Affects ${count} conversation${count > 1 ? "s" : ""}`,
      priority: count >= 5 ? "high" : count >= 2 ? "medium" : "low",
      source_conversation_ids: convIds,
      occurrence_count: count,
      status: "draft" as const,
    })),
  ];

  if (fixesToInsert.length > 0) {
    const { error } = await supabaseAdmin.from("suggested_fixes").insert(fixesToInsert);
    if (isMissingTableError(error)) return;
  }
}
