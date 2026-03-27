import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/workspaces
 * Returns the current workspace details.
 */
export async function GET() {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    return NextResponse.json({ workspace: ctx.workspace });
  } catch (err) {
    console.error("workspaces GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/workspaces
 * Updates the workspace name and/or slug.
 * Body: { name, slug? }
 */
export async function PATCH(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Only owners can rename the workspace
    if (ctx.member.role !== "owner") {
      return NextResponse.json({ error: "Only workspace owners can rename the workspace" }, { status: 403 });
    }

    const body = await request.json();
    const { name, slug } = body;

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json({ error: "Workspace name must be at least 2 characters" }, { status: 400 });
    }

    const updates: Record<string, string> = {
      name: name.trim(),
    };

    // Auto-generate slug from name if not provided
    if (slug) {
      updates.slug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    } else {
      updates.slug = name.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    }

    const { data, error } = await supabaseAdmin
      .from("workspaces")
      .update(updates)
      .eq("id", ctx.workspace.id)
      .select()
      .single();

    if (error) {
      console.error("workspace PATCH error:", error);
      return NextResponse.json({ error: "Failed to update workspace" }, { status: 500 });
    }

    return NextResponse.json({ workspace: data });
  } catch (err) {
    console.error("workspaces PATCH error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
