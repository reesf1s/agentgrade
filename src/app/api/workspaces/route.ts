import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";

/**
 * POST /api/workspaces
 * Creates a new workspace for the authenticated user.
 * Called during onboarding if a workspace doesn't already exist.
 *
 * Body: { name: string, slug?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user already has a workspace
    const existing = await getWorkspaceContext();
    if (existing) {
      return NextResponse.json(
        { error: "User already has a workspace", workspace: existing.workspace },
        { status: 409 }
      );
    }

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    // Generate a URL-safe slug from the name
    const baseSlug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .substring(0, 48);
    const slug = body.slug || `${baseSlug}-${Math.random().toString(36).substring(2, 7)}`;

    // Create workspace
    const { data: workspace, error: wsError } = await supabaseAdmin
      .from("ag_workspaces")
      .insert({
        name: name.trim(),
        slug,
        plan: "starter",
        monthly_conversation_limit: 5000,
      })
      .select("*")
      .single();

    if (wsError || !workspace) {
      console.error("Failed to create workspace:", wsError);
      return NextResponse.json({ error: "Failed to create workspace" }, { status: 500 });
    }

    // Create owner membership
    const { error: memberError } = await supabaseAdmin
      .from("ag_workspace_members")
      .insert({
        workspace_id: workspace.id,
        clerk_user_id: userId,
        role: "owner",
      });

    if (memberError) {
      // Rollback workspace
      await supabaseAdmin.from("ag_workspaces").delete().eq("id", workspace.id);
      console.error("Failed to create workspace member:", memberError);
      return NextResponse.json({ error: "Failed to create workspace" }, { status: 500 });
    }

    // Seed default alert thresholds
    await supabaseAdmin.from("ag_alert_configs").insert([
      { workspace_id: workspace.id, dimension: "overall", threshold: 0.5 },
      { workspace_id: workspace.id, dimension: "hallucination", threshold: 0.6 },
      { workspace_id: workspace.id, dimension: "accuracy", threshold: 0.6 },
    ]);

    return NextResponse.json({ workspace }, { status: 201 });
  } catch (error) {
    console.error("Workspace POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
