import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/reports/patterns
 * Returns detected failure patterns with aggregated fix suggestions.
 * Combines failure_patterns with associated ag_suggested_fixes.
 */
export async function GET() {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = ctx.workspace.id;

    const [patternsRes, fixesRes] = await Promise.all([
      supabaseAdmin
        .from("failure_patterns")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("is_resolved", false)
        .order("detected_at", { ascending: false }),

      supabaseAdmin
        .from("ag_suggested_fixes")
        .select("*")
        .eq("workspace_id", workspaceId)
        .in("status", ["pending", "approved"])
        .order("occurrence_count", { ascending: false }),
    ]);

    const patterns = patternsRes.data || [];
    const fixes = fixesRes.data || [];

    // Attach relevant fixes to each pattern by matching source conversation IDs
    const patternsWithFixes = patterns.map((pattern) => {
      const relatedFixes = fixes.filter((fix) => {
        const sourcedIds = (fix.source_conversation_ids || []) as string[];
        const affectedIds = (pattern.affected_conversation_ids || []) as string[];
        return sourcedIds.some((id: string) => affectedIds.includes(id));
      });

      return {
        ...pattern,
        fixes: relatedFixes,
      };
    });

    return NextResponse.json({
      patterns: patternsWithFixes,
      unattached_fixes: fixes.filter((fix) => {
        const sourcedIds = (fix.source_conversation_ids || []) as string[];
        const allPatternIds = patterns.flatMap((p) => (p.affected_conversation_ids || []) as string[]);
        return !sourcedIds.some((id: string) => allPatternIds.includes(id));
      }),
      stats: {
        total_patterns: patterns.length,
        critical: patterns.filter((p) => p.severity === "critical").length,
        high: patterns.filter((p) => p.severity === "high").length,
        pending_fixes: fixes.filter((f) => f.status === "pending").length,
      },
    });
  } catch (error) {
    console.error("Patterns report error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
