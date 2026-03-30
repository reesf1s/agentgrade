import { NextRequest, NextResponse } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
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
    const event = await verifyWebhook(request, {
      signingSecret: process.env.CLERK_WEBHOOK_SIGNING_SECRET,
    });
    const eventType = event.type;

    if (eventType === "user.created") {
      const user = event.data;
      const primaryEmail = extractPrimaryEmail(user);

      const { data: existingMember } = await supabaseAdmin
        .from("ag_workspace_members")
        .select("id")
        .eq("clerk_user_id", user.id)
        .maybeSingle();

      if (existingMember) {
        if (primaryEmail) {
          await supabaseAdmin
            .from("ag_workspace_members")
            .update({ email: primaryEmail })
            .eq("id", existingMember.id);
        }

        return NextResponse.json({ received: true, deduplicated: true });
      }

      const firstName = user.first_name || "";
      const lastName = user.last_name || "";
      const fullName = [firstName, lastName].filter(Boolean).join(" ") || "My";
      const workspaceName = `${fullName}'s Workspace`;
      const slug = generateSlug(fullName + "-workspace");

      // Create workspace
      const { data: workspace, error: wsError } = await supabaseAdmin
        .from("ag_workspaces")
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
        .from("ag_workspace_members")
        .insert({
          workspace_id: workspace.id,
          clerk_user_id: user.id,
          email: primaryEmail,
          role: "owner",
        });

      if (memberError) {
        console.error("Failed to create workspace member:", memberError);
        // Rollback workspace creation
        await supabaseAdmin.from("ag_workspaces").delete().eq("id", workspace.id);
        return NextResponse.json({ error: "Failed to create workspace member" }, { status: 500 });
      }

      console.log(`Created workspace ${workspace.id} for user ${user.id}`);
    }

    if (eventType === "user.updated") {
      const user = event.data;
      const primaryEmail = extractPrimaryEmail(user);

      if (primaryEmail) {
        await supabaseAdmin
          .from("ag_workspace_members")
          .update({ email: primaryEmail })
          .eq("clerk_user_id", user.id);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Clerk webhook error:", error);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

function extractPrimaryEmail(user: {
  email_addresses?: Array<{ id: string; email_address?: string }>;
  primary_email_address_id?: string | null;
}): string | null {
  const primaryEmailId = user.primary_email_address_id;
  if (primaryEmailId) {
    const primary = user.email_addresses?.find((email) => email.id === primaryEmailId);
    if (primary?.email_address) {
      return primary.email_address;
    }
  }

  return user.email_addresses?.[0]?.email_address ?? null;
}
