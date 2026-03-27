import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/knowledge-base/:id
 * Returns a single knowledge base item with its content.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from("knowledge_base")
      .select("id, title, content, chunk_index, source_file, source_url, source_type, created_at")
      .eq("id", id)
      .eq("workspace_id", ctx.workspace.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Knowledge base item not found" }, { status: 404 });
    }

    return NextResponse.json({ item: data });
  } catch (error) {
    console.error("KB item GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/knowledge-base/:id
 * Removes a knowledge base item.
 * If the item has a source_file, deletes ALL chunks from that file.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Get the item to check for source_file
    const { data: item, error: fetchError } = await supabaseAdmin
      .from("knowledge_base")
      .select("id, source_file, source_url")
      .eq("id", id)
      .eq("workspace_id", ctx.workspace.id)
      .single();

    if (fetchError || !item) {
      return NextResponse.json({ error: "Knowledge base item not found" }, { status: 404 });
    }

    let deletedCount = 1;

    // Delete all chunks from the same source file/URL
    if (item.source_file) {
      const { count } = await supabaseAdmin
        .from("knowledge_base")
        .delete({ count: "exact" })
        .eq("workspace_id", ctx.workspace.id)
        .eq("source_file", item.source_file);
      deletedCount = count || 1;
    } else if (item.source_url) {
      const { count } = await supabaseAdmin
        .from("knowledge_base")
        .delete({ count: "exact" })
        .eq("workspace_id", ctx.workspace.id)
        .eq("source_url", item.source_url);
      deletedCount = count || 1;
    } else {
      await supabaseAdmin
        .from("knowledge_base")
        .delete()
        .eq("id", id)
        .eq("workspace_id", ctx.workspace.id);
    }

    return NextResponse.json({
      success: true,
      deleted_chunks: deletedCount,
      message: deletedCount > 1 ? `Deleted all ${deletedCount} chunks from this source.` : "Deleted knowledge base item.",
    });
  } catch (error) {
    console.error("KB item DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
