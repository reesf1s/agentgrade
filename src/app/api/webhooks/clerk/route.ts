import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 48)
    + "-" + Math.random().toString(36).substring(2, 7);
}

/**
 * Clerk webhook for user lifecycle events.
 * Creates workspace + owner membership on first sign-up.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const eventType = body.type;

    if (eventType === "user.created") {
      const user = body.data;
      const firstName = user.first_name || "";
      const lastName = user.last_name || "";
      const fullName = [firstName, lastName].filter(Boolean).join(" ") || "My";
      const workspaceName = `${fullName}'s Workspace`;
      const slug = generateSlug(fullName + "-workspace");

      // Create workspace
      const { data: workspace, error: wsError } = await supabaseAdmin
        .from("workspaces")
        .insert({
          name: workspaceName,
          slug,
          plan: "starter",
          monthly_conversation_limit: 5000,
        })
        .select("id")
        .single();

      if (wsError || !workspace) {
        console.error("Failed to create workspace:", wsError);
        return NextResponse.json({ error: "Failed to create workspace" }, { status: 500 });
      }

      // Create owner membership
      const { error: memberError } = await supabaseAdmin
        .from("workspace_members")
        .insert({
          workspace_id: workspace.id,
          clerk_user_id: user.id,
          role: "owner",
        });

      if (memberError) {
        console.error("Failed to create workspace member:", memberError);
        // Rollback workspace creation
        await supabaseAdmin.from("workspaces").delete().eq("id", workspace.id);
        return NextResponse.json({ error: "Failed to create workspace member" }, { status: 500 });
      }

      console.log(`Created workspace ${workspace.id} for user ${user.id}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Clerk webhook error:", error);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
