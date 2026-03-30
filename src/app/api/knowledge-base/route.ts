import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/knowledge-base
 * Returns all knowledge base items for the workspace.
 * Items are grouped by source_file where applicable.
 */
export async function GET() {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from("ag_knowledge_base_items")
      .select("id, title, chunk_index, source_file, created_at")
      .eq("workspace_id", ctx.workspace.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: "Failed to fetch knowledge base" }, { status: 500 });
    }

    // Group by source_file for display
    const grouped = new Map<string, { source: string; source_type: string; chunks: number; created_at: string; id: string }>();

    for (const item of data || []) {
      const key = item.source_file || item.title;
      const sourceType = key.startsWith("intercom_article_")
        ? "intercom"
        : key.startsWith("zendesk_article_")
          ? "zendesk"
          : key.endsWith(".url.txt")
            ? "url"
            : "upload";
      if (!grouped.has(key)) {
        grouped.set(key, {
          source: key,
          source_type: sourceType,
          chunks: 1,
          created_at: item.created_at,
          id: item.id,
        });
      } else {
        grouped.get(key)!.chunks++;
      }
    }

    return NextResponse.json({
      items: data || [],
      sources: Array.from(grouped.values()),
      total: data?.length || 0,
    });
  } catch (error) {
    console.error("Knowledge base GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
